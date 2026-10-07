// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FollowUpQueueStore } from "./followUpQueueStore";
import { createFollowUpQueueHarness } from "./followUpQueueTestHarness";
import type { FollowUpQueueCoordinator } from "./followUpQueueCoordinator";
import type { ThreadStatus } from "@/shared/contracts";

const queues: FollowUpQueueCoordinator[] = [];
let directory: string;
function harness(status: ThreadStatus = "working") {
  const h = createFollowUpQueueHarness(status, new FollowUpQueueStore(directory));
  queues.push(h.queue);
  return h;
}
function saved() {
  return new FollowUpQueueStore(directory).load();
}
beforeEach(() => {
  directory = mkdtempSync(join(process.cwd(), ".tmp/follow-up-persistence-"));
});
afterEach(() => {
  queues.splice(0).forEach((queue) => queue.dispose());
  rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("durable follow-ups", () => {
  it("opens a profile from the previous release without a queue store", () => {
    rmSync(directory, { recursive: true });
    expect(harness().state()).toBeNull();
  });

  it("saves raw input, attachments, config and stable identities before acknowledging receipt", async () => {
    const h = harness();
    await h.queue.queueThreadFollowUp({
      threadId: "thread",
      prompt: "Next task",
      segments: [{ kind: "attachment", path: "/tmp/reference.png", mimeType: "image/png" }],
      config: {
        model: "next-model",
        effort: "high",
        executionEnvironment: { kind: "wsl", distro: "test" },
      },
    });
    expect(saved()[0]?.items[0]).toMatchObject({
      id: h.item().id,
      stagedAt: h.state()?.items[0]?.stagedAt,
      payload: {
        prompt: "Next task",
        segments: [{ kind: "attachment", path: "/tmp/reference.png", mimeType: "image/png" }],
        config: {
          model: "next-model",
          effort: "high",
          executionEnvironment: { kind: "wsl", distro: "test" },
        },
      },
      userMessageItemId: expect.stringMatching(/^user-/),
    });
    expect(h.prepare).not.toHaveBeenCalled();
  });

  it("recovers edits, ordering and removals after a supervisor restart, paused until explicitly resumed", async () => {
    const first = harness();
    await first.add("first");
    await first.add("second");
    await first.add("third");
    const second = first.item(1);
    await first.queue.editQueuedThreadFollowUp({ ...second, prompt: "edited second" });
    await first.queue.reorderQueuedThreadFollowUp({ ...second, beforeId: first.item().id });
    await first.queue.removeQueuedThreadFollowUp(first.item(2));
    const state = first.state();
    first.queue.dispose();
    const restarted = harness("idle");
    expect(restarted.state()).toEqual({ ...state, paused: true });
    expect(restarted.start).not.toHaveBeenCalled();
    await restarted.queue.resumeThreadFollowUps("thread");
    await vi.waitFor(() => expect(restarted.start).toHaveBeenCalledOnce());
    expect(restarted.start.mock.calls[0]?.[1].prompt).toBe("edited second");
  });

  it("retains a dispatched item if the process dies before provider admission", async () => {
    const first = harness("idle");
    await first.add("in transit");
    await vi.waitFor(() => expect(first.start).toHaveBeenCalledOnce());
    await first.add("next");
    const stableId = first.start.mock.calls[0]?.[1].userMessageItemId;
    expect(saved()[0]?.items[0]?.userMessageItemId).toBe(stableId);
    first.queue.dispose();
    const restarted = harness("idle");
    expect(restarted.state()?.items.map((item) => item.prompt)).toEqual(["in transit", "next"]);
    expect(restarted.state()?.paused).toBe(true);
  });

  it.each(["turn-start", "working-status"])(
    "does not replay an admitted item after %s, even before turn completion",
    async (signal) => {
      const h = harness("idle");
      await h.add("admitted");
      await vi.waitFor(() => expect(h.start).toHaveBeenCalledOnce());
      await h.add("waiting");
      if (signal === "turn-start") h.begin("queued-turn");
      else h.status("working");
      expect(saved()[0]?.items.map((entry) => entry.payload.prompt)).toEqual(["waiting"]);
      h.queue.dispose();
      expect(
        harness("idle")
          .state()
          ?.items.map((item) => item.prompt),
      ).toEqual(["waiting"]);
    },
  );

  it("persists rejected dispatches for retry and removes cancelled pending input permanently", async () => {
    const h = harness();
    await h.add("retry");
    h.start.mockRejectedValueOnce(new Error("provider unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.complete("initial");
    await vi.waitFor(() => expect(h.state()?.paused).toBe(true));
    expect(saved()[0]?.items[0]?.payload.prompt).toBe("retry");
    await h.queue.removeQueuedThreadFollowUp(h.item());
    expect(saved()).toEqual([]);
    expect(harness("idle").state()).toBeNull();
  });

  it("fails receipt and pauses delivery when disk writes fail, then allows explicit retry", async () => {
    const h = harness();
    writeFileSync(join(directory, "blocker"), "preserve");
    renameSync(directory, `${directory}-saved`);
    writeFileSync(directory, "not a directory");
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(h.add("must survive")).rejects.toThrow("Unable to save queued follow-ups");
      h.complete("initial");
      expect(h.state()?.paused).toBe(true);
      expect(h.start).not.toHaveBeenCalled();
    } finally {
      rmSync(directory);
      renameSync(`${directory}-saved`, directory);
    }
    await h.queue.resumeThreadFollowUps("thread");
    await vi.waitFor(() => expect(h.start).toHaveBeenCalledOnce());
    expect(saved()[0]?.items[0]?.payload.prompt).toBe("must survive");
  });

  it.each(["corrupt", "future-version"])(
    "preserves a %s file and refuses to overwrite it",
    async (kind) => {
      const h = harness();
      await h.add("important");
      const file = join(
        directory,
        readdirSync(directory).find((name) => name.endsWith(".json"))!,
      );
      const contents =
        kind === "corrupt"
          ? "{broken"
          : readFileSync(file, "utf8").replace('"version":1', '"version":2');
      writeFileSync(file, contents);
      vi.spyOn(console, "error").mockImplementation(() => {});
      const restarted = harness();
      await expect(restarted.add("replacement")).rejects.toThrow(
        "Unable to save queued follow-ups",
      );
      expect(readFileSync(file, "utf8")).toBe(contents);
      expect(restarted.state()?.paused).toBe(true);
    },
  );
});
