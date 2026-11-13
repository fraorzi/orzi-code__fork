import type { ThreadConfig, UsageSnapshot } from "@/shared/contracts";
import type { SessionRuntime } from "../sessionTypes";

interface QuotaWait {
  session: SessionRuntime;
  config: ThreadConfig;
  after: number;
  blockedIds: Set<string>;
  nextPollAt: number;
}

interface UsageRecoveryContext {
  readSnapshot(providerId: string): UsageSnapshot | undefined;
  refresh(providerId: string): Promise<UsageSnapshot | undefined>;
  isCurrentSession(session: SessionRuntime): boolean;
  stageContinuation(session: SessionRuntime): void;
  resume(threadId: string, canResume: () => boolean): Promise<void>;
  changed(threadId: string): void;
}

/** Quota recovery belongs to the supervisor, independent of the active renderer/chat. */
export class UsageRecoveryCoordinator {
  private readonly waits = new Map<string, QuotaWait>();
  private readonly failures = new WeakMap<SessionRuntime, string>();
  private readonly stagedFailures = new WeakSet<SessionRuntime>();
  private readonly stopped = new WeakSet<SessionRuntime>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  constructor(private readonly ctx: UsageRecoveryContext) {}

  isWaiting(threadId: string): boolean {
    return this.waits.has(threadId);
  }

  shouldWait(session: SessionRuntime, config: ThreadConfig): boolean {
    if (!this.enabled(session, config) || this.stopped.has(session)) return false;
    if (this.waits.has(session.threadId)) return true;
    const providerId = session.adapter.usageProviderId;
    if (!providerId) return false;
    const snapshot = this.ctx.readSnapshot(providerId);
    const windows = this.windows(session, config, snapshot);
    if (!windows.some((window) => window.usedPercent >= 100)) return false;
    this.arm(session, config, snapshot?.fetchedAt ?? Date.now());
    return true;
  }

  onFailure(session: SessionRuntime, message: string): void {
    if (!session.adapter.usageRecovery?.isLimitError(message)) {
      this.failures.delete(session);
      this.stop(session);
      return;
    }
    this.failures.set(session, message);
    if (!this.enabled(session, session.config) || this.stopped.has(session)) return;
    this.arm(session, session.config, Date.now());
    if (!this.stagedFailures.has(session)) {
      this.stagedFailures.add(session);
      this.ctx.stageContinuation(session);
    }
  }

  beginTurn(session: SessionRuntime): void {
    this.stopped.delete(session);
    this.failures.delete(session);
    this.stagedFailures.delete(session);
  }

  setEnabled(session: SessionRuntime, enabled: boolean): void {
    session.config = { ...session.config, autoResumeAfterLimit: enabled };
    if (!enabled) this.stop(session);
    else {
      this.stopped.delete(session);
      const failure = this.failures.get(session);
      if (failure && session.status === "error") this.onFailure(session, failure);
    }
  }

  stop(session: SessionRuntime): void {
    this.stopped.add(session);
    this.cancel(session.threadId);
  }

  cancel(threadId: string): void {
    if (this.waits.delete(threadId)) this.ctx.changed(threadId);
    this.schedule();
  }

  acceptSnapshot(snapshot: UsageSnapshot): void {
    for (const [threadId, wait] of this.waits) {
      if (wait.session.adapter.usageProviderId !== snapshot.providerId) continue;
      if (
        !this.enabled(wait.session, wait.session.config) ||
        !this.ctx.isCurrentSession(wait.session)
      ) {
        this.cancel(threadId);
        continue;
      }
      if (snapshot.status !== "ok" || snapshot.fetchedAt <= wait.after) continue;
      const windows = this.windows(wait.session, wait.config, snapshot);
      if (!windows.length) continue;
      for (const window of windows) {
        if (window.usedPercent >= 100) wait.blockedIds.add(window.id);
      }
      // A partial live update or missing weekly window cannot prove recovery.
      if ([...wait.blockedIds].some((id) => !windows.some((window) => window.id === id))) continue;
      if (windows.some((window) => window.usedPercent >= 100)) continue;
      this.waits.delete(threadId);
      this.ctx.changed(threadId);
      void this.ctx
        .resume(
          threadId,
          () =>
            this.enabled(wait.session, wait.session.config) &&
            this.ctx.isCurrentSession(wait.session) &&
            !this.stopped.has(wait.session),
        )
        .catch((error: unknown) => {
          console.error("[supervisor] quota recovery could not resume follow-ups", {
            threadId,
            error,
          });
        });
    }
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.waits.clear();
  }

  private enabled(session: SessionRuntime, config: ThreadConfig): boolean {
    return (
      !this.disposed &&
      session.presentationMode === "gui" &&
      config.autoResumeAfterLimit === true &&
      Boolean(session.adapter.usageProviderId && session.adapter.usageRecovery)
    );
  }

  private windows(
    session: SessionRuntime,
    config: ThreadConfig,
    snapshot: UsageSnapshot | undefined,
  ) {
    const ids = session.adapter.usageRecovery?.windowIds(config) ?? [];
    return snapshot?.windows.filter((window) => ids.includes(window.id)) ?? [];
  }

  private arm(session: SessionRuntime, config: ThreadConfig, after: number): void {
    if (this.waits.has(session.threadId)) return;
    const providerId = session.adapter.usageProviderId;
    if (!providerId) return;
    const snapshot = this.ctx.readSnapshot(providerId);
    const windows = this.windows(session, config, snapshot);
    const now = Date.now();
    const reset = windows.flatMap((window) =>
      window.usedPercent >= 100 && window.resetsAt !== undefined && window.resetsAt > now
        ? [window.resetsAt]
        : [],
    );
    this.waits.set(session.threadId, {
      session,
      config: { ...config },
      after,
      blockedIds: new Set(
        windows.filter((window) => window.usedPercent >= 100).map((window) => window.id),
      ),
      nextPollAt: Math.max(
        now + 1_000,
        Math.min(now + 120_000, ...reset),
        snapshot?.rateLimitedUntil ?? 0,
      ),
    });
    this.ctx.changed(session.threadId);
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.disposed || !this.waits.size) return;
    this.timer = setTimeout(
      () => {
        void this.poll();
      },
      Math.max(
        1_000,
        Math.min(...[...this.waits.values()].map((wait) => wait.nextPollAt)) - Date.now(),
      ),
    );
    this.timer.unref?.();
  }

  private async poll(): Promise<void> {
    const providerIds = new Set<string>();
    for (const [threadId, wait] of this.waits) {
      if (
        !this.ctx.isCurrentSession(wait.session) ||
        !this.enabled(wait.session, wait.session.config)
      ) {
        this.cancel(threadId);
      } else if (wait.nextPollAt <= Date.now()) {
        wait.nextPollAt = Date.now() + 120_000;
        if (wait.session.adapter.usageProviderId)
          providerIds.add(wait.session.adapter.usageProviderId);
      }
    }
    await Promise.allSettled(
      [...providerIds].map(async (providerId) => {
        const snapshot = await this.ctx.refresh(providerId);
        if (!this.disposed && snapshot) this.acceptSnapshot(snapshot);
      }),
    );
    this.schedule();
  }
}
