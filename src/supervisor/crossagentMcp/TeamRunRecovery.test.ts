import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamRunRecovery } from "./TeamRunRecovery";
import { TeamWorktreeService, type TeamWorkspace } from "./TeamWorktreeService";
import type { PreparedSubagentRun } from "./spawnPlan";
import type { SpawnAgentRequest, SubagentRunStatus } from "./types";

const exec = promisify(execFile);
let directory: string;
let root: string;
let workspace: TeamWorkspace;
let service: TeamWorktreeService;
const request = { agent: "worker", prompt: "Finish task.txt", model: "selected" };

beforeEach(async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  directory = await mkdtemp(resolve(".tmp/team-recovery-"));
  root = join(directory, "project");
  await exec("git", ["clone", "--shared", "--no-checkout", "--quiet", process.cwd(), root]);
  service = new TeamWorktreeService(join(directory, "teams"));
  workspace = await service.create("123456789abc", { kind: "posix", path: root });
  service.saveRun(workspace, {
    version: 2,
    parentThreadId: "parent",
    request,
    status: "running",
    output: "",
  });
  await writeFile(join(workspace.root, "task.txt"), "partial work\n");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function recovery(active?: SubagentRunStatus, projectPath = root) {
  const start = vi.fn<
    (
      parent: string,
      plan: PreparedSubagentRun,
      task: SpawnAgentRequest,
      retained: TeamWorkspace,
    ) => { runId: string }
  >(
    (
      _parent: string,
      _plan: PreparedSubagentRun,
      _request: SpawnAgentRequest,
      retained: TeamWorkspace,
    ) => ({ runId: retained.runId }),
  );
  return {
    start,
    recovery: new TeamRunRecovery({
      service: new TeamWorktreeService(join(directory, "teams")),
      status: () => active,
      parent: () => ({
        projectLocation: { kind: "posix", path: projectPath },
        config: { model: "parent", teamMode: true },
      }),
      activeCount: () => (active === "running" ? 1 : 0),
      prepare: (parent, task) => ({
        prompt: task.prompt,
        projectLocation: parent.projectLocation,
        background: false,
        teamMode: true,
        retryMode: "startup",
        attempts: [],
      }),
      start,
    }),
  };
}

describe("saved team task recovery", () => {
  it("exposes interrupted work only to its parent and resumes the same worktree", async () => {
    const run = recovery();
    expect(await run.recovery.list("other")).toEqual([]);
    expect(await run.recovery.list("parent")).toMatchObject([
      { run_id: workspace.runId, status: "interrupted" },
    ]);
    expect(await run.recovery.resume("parent", workspace.runId)).toEqual({
      runId: workspace.runId,
    });
    expect(run.start.mock.calls[0]?.[1].prompt).toContain("do not blindly repeat");
    expect(run.start.mock.calls[0]?.[2]).toEqual(request);
    expect(run.start.mock.calls[0]?.[3]).toEqual(workspace);
    expect(await readFile(join(workspace.root, "task.txt"), "utf8")).toBe("partial work\n");
  });

  it("refuses recovery by another parent, in another project, or while already running", async () => {
    await expect(recovery().recovery.resume("other", workspace.runId)).rejects.toThrow(
      "Unknown team run",
    );
    await expect(
      recovery(undefined, directory).recovery.resume("parent", workspace.runId),
    ).rejects.toThrow("another project");
    await expect(recovery("running").recovery.resume("parent", workspace.runId)).rejects.toThrow(
      "already active",
    );
  });

  it("integrates a completed worker after restart but never integrates interrupted work", async () => {
    const run = recovery();
    await expect(run.recovery.integrate("parent", workspace.runId)).rejects.toThrow(
      "must be resumed",
    );
    await expect(readFile(join(root, "task.txt"))).rejects.toThrow("ENOENT");
    service.saveRun(workspace, {
      version: 2,
      parentThreadId: "parent",
      request,
      status: "completed",
      output: "Done",
    });
    expect(await run.recovery.integrate("parent", workspace.runId)).toEqual({
      status: "applied",
      files: ["task.txt"],
    });
    expect(await readFile(join(root, "task.txt"), "utf8")).toBe("partial work\n");
    await expect(run.recovery.resume("parent", workspace.runId)).rejects.toThrow(
      "already integrated",
    );
  });

  it("guards cleanup ownership and requires explicit discard for unfinished work", async () => {
    const run = recovery();
    await expect(run.recovery.remove("other", workspace.runId, true)).rejects.toThrow(
      "Unknown team run",
    );
    await expect(
      recovery("running").recovery.remove("parent", workspace.runId, true),
    ).rejects.toThrow("still active");
    await expect(run.recovery.remove("parent", workspace.runId, false)).rejects.toThrow(
      "explicit discard",
    );
    await run.recovery.remove("parent", workspace.runId, true);
    expect(await run.recovery.list("parent")).toEqual([]);
  });
});
