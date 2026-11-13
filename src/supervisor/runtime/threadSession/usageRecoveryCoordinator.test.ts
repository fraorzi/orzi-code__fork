import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UsageSnapshot } from "@/shared/contracts";
import { createFollowUpQueueHarness } from "./followUpQueueTestHarness";
import { UsageRecoveryCoordinator } from "./usageRecoveryCoordinator";

const coordinators: UsageRecoveryCoordinator[] = [];

function harness() {
  const { session } = createFollowUpQueueHarness("idle");
  session.config.autoResumeAfterLimit = true;
  session.adapter = {
    ...session.adapter,
    usageProviderId: "test-account",
    usageRecovery: {
      isLimitError: (message) => message === "quota exhausted",
      windowIds: () => ["session-5h", "weekly"],
    },
  };
  let snapshot: UsageSnapshot = {
    providerId: "test-account",
    status: "ok",
    fetchedAt: Date.now(),
    windows: [
      { id: "session-5h", label: "5h", usedPercent: 100, resetsAt: Date.now() + 30_000 },
      { id: "weekly", label: "Week", usedPercent: 10 },
    ],
  };
  const resume = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const stageContinuation = vi.fn<() => void>();
  const changed = vi.fn<() => void>();
  const refresh = vi.fn<() => Promise<UsageSnapshot>>().mockImplementation(async () => snapshot);
  const recovery = new UsageRecoveryCoordinator({
    readSnapshot: () => snapshot,
    refresh,
    resume,
    stageContinuation,
    changed,
    isCurrentSession: (candidate) => candidate === session,
  });
  coordinators.push(recovery);
  function update(usedPercent = 0, weekly = 10) {
    snapshot = {
      ...snapshot,
      fetchedAt: Date.now(),
      windows: [
        { id: "session-5h", label: "5h", usedPercent },
        { id: "weekly", label: "Week", usedPercent: weekly },
      ],
    };
    return snapshot;
  }
  return {
    session,
    recovery,
    resume,
    stageContinuation,
    refresh,
    changed,
    update,
    snapshot: () => snapshot,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  coordinators.splice(0).forEach((recovery) => recovery.dispose());
  vi.useRealTimers();
});

describe("supervisor quota recovery", () => {
  it("holds input without submitting a provider probe, then wakes once on fresh available quota", async () => {
    const h = harness();
    expect(h.recovery.shouldWait(h.session, h.session.config)).toBe(true);
    expect(h.refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(h.resume).not.toHaveBeenCalled();
    vi.setSystemTime(Date.now() + 1);
    h.recovery.acceptSnapshot(h.update());
    h.recovery.acceptSnapshot(h.snapshot());
    expect(h.resume).toHaveBeenCalledTimes(1);
    expect(h.stageContinuation).not.toHaveBeenCalled();
  });

  it("waits for every blocking window, rejects stale, partial, and failed snapshots", () => {
    const h = harness();
    h.update(100, 100);
    h.recovery.shouldWait(h.session, h.session.config);
    h.recovery.acceptSnapshot({ ...h.snapshot(), windows: [] });
    vi.setSystemTime(Date.now() + 1);
    h.recovery.acceptSnapshot(h.update(0, 100));
    h.recovery.acceptSnapshot({ ...h.update(), status: "rate-limited" });
    h.recovery.acceptSnapshot({ ...h.snapshot(), windows: [h.snapshot().windows[0]!] });
    expect(h.resume).not.toHaveBeenCalled();
    h.recovery.acceptSnapshot(h.update());
    expect(h.resume).toHaveBeenCalledTimes(1);
  });

  it("stages one continuation despite duplicate failure channels and supports late opt-in", () => {
    const h = harness();
    h.session.config.autoResumeAfterLimit = false;
    h.session.status = "error";
    h.recovery.onFailure(h.session, "quota exhausted");
    expect(h.stageContinuation).not.toHaveBeenCalled();
    h.recovery.setEnabled(h.session, true);
    h.recovery.onFailure(h.session, "quota exhausted");
    expect(h.stageContinuation).toHaveBeenCalledTimes(1);
    h.recovery.setEnabled(h.session, false);
    h.recovery.setEnabled(h.session, true);
    expect(h.recovery.isWaiting(h.session.threadId)).toBe(true);
    expect(h.stageContinuation).toHaveBeenCalledTimes(1);
  });

  it.each(["stop", "disable", "unrelated error"])(
    "cancels automatic sending after %s",
    async (action) => {
      const h = harness();
      h.recovery.onFailure(h.session, "quota exhausted");
      if (action === "stop") h.recovery.stop(h.session);
      if (action === "disable") h.recovery.setEnabled(h.session, false);
      if (action === "unrelated error") h.recovery.onFailure(h.session, "Authentication failed");
      h.recovery.onFailure(h.session, "quota exhausted");
      vi.setSystemTime(Date.now() + 1);
      h.recovery.acceptSnapshot(h.update());
      await vi.advanceTimersByTimeAsync(300_000);
      expect(h.resume).not.toHaveBeenCalled();
      expect(h.refresh).not.toHaveBeenCalled();
    },
  );

  it("does not send a response from an in-flight refresh after Stop", async () => {
    const h = harness();
    let resolve!: (snapshot: UsageSnapshot) => void;
    h.refresh.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    h.recovery.shouldWait(h.session, h.session.config);
    await vi.advanceTimersByTimeAsync(30_000);
    h.recovery.stop(h.session);
    resolve(h.update());
    await vi.advanceTimersByTimeAsync(1);
    expect(h.resume).not.toHaveBeenCalled();
  });

  it("leaves opt-out and terminal sessions alone", () => {
    const h = harness();
    expect(h.recovery.shouldWait(h.session, { model: "model" })).toBe(false);
    h.session.presentationMode = "terminal";
    expect(h.recovery.shouldWait(h.session, h.session.config)).toBe(false);
  });
});
