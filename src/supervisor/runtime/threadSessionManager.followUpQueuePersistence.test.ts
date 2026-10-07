// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createFollowUpQueueHarness } from "./threadSessionManager.followUpQueueTestHarness";

vi.mock("node-pty", () => ({ spawn: vi.fn<() => never>() }));

it("recovers follow-ups through a fresh manager and delivers the saved config only after Resume", async () => {
  const directory = mkdtempSync(join(process.cwd(), ".tmp/manager-follow-ups-"));
  const first = createFollowUpQueueHarness(directory);
  first.session.status = "working";
  try {
    await first.manager.queueThreadFollowUp({
      threadId: first.session.threadId,
      prompt: "after restart",
      config: { model: "saved-model", effort: "high" },
    });
    const state = first.manager.getThreadFollowUpQueue(first.session.threadId);
    first.finish();
    await first.manager.dispose();

    const restarted = createFollowUpQueueHarness(directory);
    try {
      expect(restarted.manager.getThreadFollowUpQueue(restarted.session.threadId)).toEqual({
        ...state,
        paused: true,
      });
      expect(restarted.startTurn).not.toHaveBeenCalled();
      await restarted.manager.resumeThreadFollowUps(restarted.session.threadId);
      await vi.waitFor(() => expect(restarted.startTurn).toHaveBeenCalledOnce());
      expect(restarted.startTurn.mock.calls[0]?.[0]).toBe("after restart");
      expect(restarted.startTurn.mock.calls[0]?.[1]).toEqual({
        model: "saved-model",
        effort: "high",
      });
    } finally {
      restarted.finish();
      await restarted.manager.dispose();
    }
  } finally {
    first.finish();
    await first.manager.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});
