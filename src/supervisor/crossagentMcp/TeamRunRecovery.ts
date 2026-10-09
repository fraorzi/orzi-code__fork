import { realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { ProjectLocation, ThreadConfig } from "@/shared/contracts";
import type { PreparedSubagentRun } from "./spawnPlan";
import type { TeamWorkspace } from "./TeamWorktreeService";
import type { SubagentRunManagerDeps } from "./SubagentRunManager";
import type { SpawnAgentRequest, SubagentRunStatus } from "./types";
import { SubagentSpawnError } from "./errors";
import type { TeamWorkspaceSummary } from "@/shared/teamWorkspaces";

type Parent = { projectLocation: ProjectLocation; config: ThreadConfig };
interface TeamRecoveryDeps {
  service: SubagentRunManagerDeps["teamWorktrees"];
  status: (runId: string) => SubagentRunStatus | undefined;
  parent: (parentThreadId: string) => Parent;
  activeCount: (parentThreadId: string) => number;
  prepare: (parent: Parent, request: SpawnAgentRequest) => PreparedSubagentRun;
  start: (
    parentThreadId: string,
    plan: PreparedSubagentRun,
    request: SpawnAgentRequest,
    workspace: TeamWorkspace,
  ) => { runId: string };
}

/** Recovery never replays a task automatically or integrates unfinished work. */
export class TeamRunRecovery {
  constructor(private readonly deps: TeamRecoveryDeps) {}
  async listAll(): Promise<TeamWorkspaceSummary[]> {
    return ((await this.deps.service?.list?.()) ?? []).map((entry): TeamWorkspaceSummary => {
      if ("error" in entry) return { kind: "invalid", runId: entry.runId, error: entry.error };
      return {
        kind: "workspace",
        runId: entry.runId,
        path: entry.workspace.root,
        parentRoot: entry.workspace.parentRoot,
        state:
          this.deps.status(entry.runId) === "running"
            ? "active"
            : entry.integration?.state === "applied" || entry.integration?.state === "no_changes"
              ? "integrated"
              : "retained",
      };
    });
  }

  async cleanup(runId: string, discardChanges: boolean): Promise<void> {
    if (this.deps.status(runId) === "running")
      throw new SubagentSpawnError("Team run is still active");
    if (!this.deps.service?.remove) throw new SubagentSpawnError("Team cleanup is unavailable");
    await this.deps.service.remove(runId, discardChanges);
  }
  async list(parentThreadId: string) {
    const saved = (await this.deps.service?.list?.()) ?? [];
    return saved
      .filter((entry) => "error" in entry || entry.run?.parentThreadId === parentThreadId)
      .map((entry) => {
        if ("error" in entry) return { run_id: entry.runId, error: entry.error };
        const run = entry.run;
        if (!run) throw new SubagentSpawnError("Missing team task metadata");
        return {
          run_id: entry.runId,
          path: entry.workspace.root,
          project_path: entry.workspace.projectPath,
          status:
            this.deps.status(entry.runId) ??
            (run.status === "running" ? "interrupted" : run.status),
          provider: run.request.agent,
          model: run.request.model,
          output: run.output.slice(-16_000),
          integration: entry.integration?.state,
        };
      });
  }

  async resume(parentThreadId: string, runId: string): Promise<{ runId: string }> {
    const service = this.deps.service;
    if (!service?.load) throw new SubagentSpawnError("Team recovery is unavailable");
    const { workspace, run, integration } = await service.load(runId);
    if (!run || run.parentThreadId !== parentThreadId)
      throw new SubagentSpawnError("Unknown team run");
    if (this.deps.status(runId) === "running")
      throw new SubagentSpawnError("Team run is already active");
    if (integration?.state === "applied" || integration?.state === "no_changes")
      throw new SubagentSpawnError("Team run is already integrated");
    if (integration?.state === "prepared")
      throw new SubagentSpawnError("Finish the pending integration before resuming work");
    const parent = this.deps.parent(parentThreadId);
    if (
      !parent.config.teamMode ||
      parent.projectLocation.kind !== "posix" ||
      parent.config.executionEnvironment
    )
      throw new SubagentSpawnError("Team recovery requires local Teamwork mode");
    if (
      (await realpath(parent.projectLocation.path)) !==
      resolve(workspace.parentRoot, relative(workspace.root, workspace.projectPath))
    )
      throw new SubagentSpawnError("Team workspace belongs to another project");
    if (this.deps.status(runId) === "running")
      throw new SubagentSpawnError("Team run is already active");
    if (this.deps.activeCount(parentThreadId) >= 2)
      throw new SubagentSpawnError("Too many concurrent team workers");
    const plan = this.deps.prepare(parent, run.request);
    plan.prompt = [
      "This team task was interrupted by an application restart. Inspect the existing worktree before continuing the original task below. Preserve completed work and do not blindly repeat commands or external side effects. Report any uncertainty that prevents safe continuation.",
      run.output ? `Previous worker report:\n${run.output.slice(-16_000)}` : "",
      plan.prompt,
    ]
      .filter(Boolean)
      .join("\n\n");
    return this.deps.start(parentThreadId, plan, run.request, workspace);
  }

  async integrate(parentThreadId: string, runId: string) {
    const service = this.deps.service;
    if (!service?.load || !service.saveRun)
      throw new SubagentSpawnError("Team recovery is unavailable");
    const { workspace, run, integration } = await service.load(runId);
    if (!run || run.parentThreadId !== parentThreadId)
      throw new SubagentSpawnError("Unknown team run");
    if (this.deps.status(runId) === "running")
      throw new SubagentSpawnError("Team run is still active");
    if (!integration && run.status !== "completed")
      throw new SubagentSpawnError("Unfinished work must be resumed before integration");
    const result = await service.integrate(workspace, () => false);
    service.saveRun(workspace, { ...run, status: "completed" });
    return result;
  }

  async remove(parentThreadId: string, runId: string, discardChanges: boolean) {
    const service = this.deps.service;
    if (!service?.load || !service.remove)
      throw new SubagentSpawnError("Team cleanup is unavailable");
    const { run } = await service.load(runId);
    if (!run || run.parentThreadId !== parentThreadId)
      throw new SubagentSpawnError("Unknown team run");
    if (this.deps.status(runId) === "running")
      throw new SubagentSpawnError("Team run is still active");
    await service.remove(runId, discardChanges);
  }
}
