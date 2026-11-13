import { afterEach, describe, expect, it, vi } from "vitest";
import type { UsageSnapshot } from "@/shared/contracts";
import { createFollowUpQueueHarness } from "./threadSessionManager.followUpQueueTestHarness";
import type { ThreadSessionManager } from "./threadSessionManager";

vi.mock("node-pty", () => ({ spawn: vi.fn<() => never>() }));
const managers: ThreadSessionManager[] = [];
afterEach(async () => {
  await Promise.all(managers.splice(0).map((manager) => manager.dispose()));
});
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function harness(exhausted = true) {
  const snapshot: UsageSnapshot = {
    providerId: "test-account",
    status: "ok",
    fetchedAt: Date.now() - 1_000,
    windows: [{ id: "session-5h", label: "5h", usedPercent: exhausted ? 100 : 10 }],
  };
  const h = createFollowUpQueueHarness(undefined, { readUsageSnapshot: () => snapshot });
  h.session.config.autoResumeAfterLimit = true;
  h.session.adapter.usageProviderId = "test-account";
  h.session.adapter.usageRecovery = {
    isLimitError: (message) => message === "quota exhausted",
    windowIds: () => ["session-5h"],
  };
  managers.push(h.manager);
  const recover = () =>
    h.manager.acceptUsageSnapshot({
      ...snapshot,
      fetchedAt: Date.now() + 1_000,
      windows: [{ id: "session-5h", label: "5h", usedPercent: 10 }],
    });
  return { ...h, snapshot, recover };
}

describe("input through the real supervisor manager and queue", () => {
  it("persists the entire pending payload and dispatches exactly once after quota returns", async () => {
    const h = harness();
    const segments = [{ kind: "text", content: "waiting task" }] as const;
    await h.manager.sendThreadInput({
      threadId: h.session.threadId,
      prompt: "waiting task",
      config: h.session.config,
      segments: [...segments],
    });
    await flush();
    expect(h.startTurn).not.toHaveBeenCalled();
    expect(h.manager.getThreadFollowUpQueue(h.session.threadId)).toMatchObject({
      waitingForLimit: true,
      items: [{ prompt: "waiting task", segments }],
    });
    h.snapshot.windows[0]!.usedPercent = 10;
    h.snapshot.fetchedAt += 1_000;
    h.recover();
    h.recover();
    await flush();
    expect(h.startTurn).toHaveBeenCalledTimes(1);
    expect(h.startTurn.mock.calls[0]?.[0]).toBe("waiting task");
  });

  it("resumes an interrupted direct turn before later queued messages", async () => {
    const h = harness(false);
    h.startTurn.mockRejectedValueOnce(new Error("quota exhausted"));
    await h.manager.sendThreadInput({
      threadId: h.session.threadId,
      prompt: "original task",
      config: h.session.config,
    });
    await flush();
    await h.manager.queueThreadFollowUp({
      threadId: h.session.threadId,
      prompt: "later task",
      config: h.session.config,
    });
    const queue = h.manager.getThreadFollowUpQueue(h.session.threadId);
    expect(queue?.waitingForLimit).toBe(true);
    expect(queue?.items).toHaveLength(2);
    expect(queue?.items[1]?.prompt).toBe("later task");
    h.recover();
    await flush();
    expect(h.startTurn).toHaveBeenCalledTimes(2);
    expect(h.startTurn.mock.calls[1]?.[0]).toContain("interrupted");
    expect(h.manager.getThreadFollowUpQueue(h.session.threadId)?.items[0]?.prompt).toBe(
      "later task",
    );
  });

  it("Stop wins when fresh quota already scheduled a pending resume", async () => {
    const h = harness();
    await h.manager.sendThreadInput({
      threadId: h.session.threadId,
      prompt: "waiting",
      config: h.session.config,
    });
    h.snapshot.windows[0]!.usedPercent = 10;
    h.recover();
    await h.manager.interruptThread({ threadId: h.session.threadId });
    await flush();
    expect(h.startTurn).not.toHaveBeenCalled();
    expect(h.manager.getThreadFollowUpQueue(h.session.threadId)?.paused).toBe(true);
  });

  it("cancels waiting after the last queued message is removed", async () => {
    const h = harness();
    await h.manager.sendThreadInput({
      threadId: h.session.threadId,
      prompt: "waiting",
      config: h.session.config,
    });
    const item = h.manager.getThreadFollowUpQueue(h.session.threadId)?.items[0];
    if (!item) throw new Error("Expected queued message");
    await h.manager.removeQueuedThreadFollowUp({ threadId: h.session.threadId, id: item.id });
    h.recover();
    await flush();
    expect(h.startTurn).not.toHaveBeenCalled();
    expect(h.manager.getThreadFollowUpQueue(h.session.threadId)).toBeNull();
  });

  it("does not auto-send after the real Stop procedure", async () => {
    const h = harness();
    await h.manager.sendThreadInput({
      threadId: h.session.threadId,
      prompt: "waiting",
      config: h.session.config,
    });
    await h.manager.interruptThread({ threadId: h.session.threadId });
    h.recover();
    await flush();
    expect(h.startTurn).not.toHaveBeenCalled();
    expect(h.manager.getThreadFollowUpQueue(h.session.threadId)).toMatchObject({
      paused: true,
      items: [{ prompt: "waiting" }],
    });
  });
});
