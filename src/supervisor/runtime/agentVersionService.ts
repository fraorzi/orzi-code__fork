import type {
  AgentKind,
  AgentVersionsState,
  GetAgentVersionsPayload,
  ManageAgentVersionPayload,
  ManageAgentVersionResult,
} from "@/shared/contracts";
import type { AgentAdapter } from "../agents/base";
import { invalidateExecutablePathCache } from "../agents/base/processRuntime";
import { clearAgentBinaryPathCache } from "../agents/binaryResolver";
import { ManagedAgentVersions } from "./managedAgentVersions";
import type { AgentUpdateCoordinator } from "./agentUpdateCoordinator";

/** Coordinates version activation with all runtime launches and sessions. */
export class AgentVersionService {
  private loadedStore: ManagedAgentVersions | undefined;
  constructor(
    private readonly deps: {
      baseDir: string;
      adapters(): ReadonlyMap<AgentKind, Pick<AgentAdapter, "kind" | "managedVersions">>;
      updates: AgentUpdateCoordinator;
      refresh(kinds: AgentKind[]): Promise<void>;
    },
  ) {}

  /** Supervisor boot calls this after building adapters and before detection or launch. */
  initialize(): void {
    void this.store;
  }

  private get store(): ManagedAgentVersions {
    return (this.loadedStore ??= new ManagedAgentVersions(
      this.deps.baseDir,
      [...this.deps.adapters().values()].flatMap((adapter) =>
        adapter.managedVersions ? [adapter.managedVersions] : [],
      ),
    ));
  }

  getState({ agentKind }: GetAgentVersionsPayload): AgentVersionsState {
    return this.store.state(this.deps.adapters().get(agentKind)?.managedVersions);
  }

  isPinned(capability: AgentAdapter["managedVersions"]): boolean {
    return this.store.isPinned(capability);
  }

  async manage(payload: ManageAgentVersionPayload): Promise<ManageAgentVersionResult> {
    const capability = this.deps.adapters().get(payload.agentKind)?.managedVersions;
    if (!capability || !this.store.state(capability).supported) {
      return { ok: false, state: { supported: false } };
    }
    const result = await this.deps.updates.install(async () => {
      switch (payload.action) {
        case "install":
          await this.store.install(capability, payload.version);
          break;
        case "rollback":
          await this.store.rollback(capability);
          break;
        case "system":
          this.store.useSystem(capability);
          break;
      }
      clearAgentBinaryPathCache();
      invalidateExecutablePathCache();
      const kinds = [...this.deps.adapters().values()]
        .filter((adapter) => adapter.managedVersions?.npmPackage === capability.npmPackage)
        .map((adapter) => adapter.kind);
      try {
        await this.deps.refresh(kinds);
      } catch (error) {
        console.warn(
          "[agent-versions] activation committed; status refresh failed",
          error instanceof Error ? error.message : String(error),
        );
      }
      return { ok: true };
    });
    return {
      ok: result.ok,
      state: this.store.state(capability),
      ...(!result.ok && result.output ? { error: result.output } : {}),
    };
  }
}
