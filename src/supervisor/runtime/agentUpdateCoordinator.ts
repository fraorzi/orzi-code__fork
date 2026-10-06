import type { UpdateAgentBinaryResult } from "@/shared/contracts";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RETRY_INTERVAL_MS = 15 * 60 * 1000;

export interface AgentUpdateTask {
  id: string;
  isOutdated(): Promise<boolean>;
  update(): Promise<UpdateAgentBinaryResult>;
}

/** Serializes installation with process launches, including background agents. */
export class AgentUpdateCoordinator {
  private launches = 0;
  private mutation: Promise<UpdateAgentBinaryResult> | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;
  private sweeping = false;
  private readonly nextCheck = new Map<string, number>();

  constructor(
    private readonly deps: {
      enabled(): boolean;
      hasSessions(): boolean;
      tasks(): Promise<AgentUpdateTask[]>;
      report(id: string, result: UpdateAgentBinaryResult): void;
    },
  ) {}

  start(): void {
    if (this.timer) return;
    this.stopped = false;
    this.timer = setInterval(() => void this.sweep(), 60_000);
    this.timer.unref?.();
    void this.sweep();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async acquireLaunch(): Promise<() => void> {
    // Reserve before waiting so another installer cannot win the next turn.
    this.launches += 1;
    await this.mutation;
    return () => {
      this.launches -= 1;
    };
  }

  install(run: () => Promise<UpdateAgentBinaryResult>): Promise<UpdateAgentBinaryResult> {
    if (this.mutation || this.launches > 0 || this.deps.hasSessions()) {
      return Promise.resolve({ ok: false, output: "Update deferred until agent sessions close." });
    }
    // Set the barrier before invoking async provider code.
    const mutation = Promise.resolve()
      .then(run)
      .catch((error: unknown) => ({
        ok: false,
        output: error instanceof Error ? error.message : String(error),
      }));
    this.mutation = mutation;
    void mutation.finally(() => {
      if (this.mutation === mutation) this.mutation = undefined;
    });
    return mutation;
  }

  async sweep(now = Date.now()): Promise<void> {
    if (this.stopped || this.sweeping || !this.deps.enabled()) return;
    this.sweeping = true;
    try {
      for (const task of await this.deps.tasks()) {
        if (this.stopped || !this.deps.enabled()) break;
        if (now < (this.nextCheck.get(task.id) ?? 0)) continue;
        // Leave the task due when busy; the next minute retries without a dialog.
        if (this.mutation || this.launches > 0 || this.deps.hasSessions()) continue;
        try {
          if (!(await task.isOutdated())) {
            this.nextCheck.set(task.id, now + CHECK_INTERVAL_MS);
            continue;
          }
          if (this.stopped || !this.deps.enabled()) break;
          if (this.mutation || this.launches > 0 || this.deps.hasSessions()) continue;
          const result = await task.update();
          this.nextCheck.set(task.id, now + (result.ok ? CHECK_INTERVAL_MS : RETRY_INTERVAL_MS));
          this.deps.report(task.id, result);
        } catch (error) {
          this.nextCheck.set(task.id, now + RETRY_INTERVAL_MS);
          this.deps.report(task.id, {
            ok: false,
            output: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      this.deps.report("discovery", { ok: false, output: String(error) });
    } finally {
      this.sweeping = false;
    }
  }
}
