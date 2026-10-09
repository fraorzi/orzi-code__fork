import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TeamWorktreeService } from "./TeamWorktreeService";

const exec = promisify(execFile);
let directory: string;
let root: string;
let service: TeamWorktreeService;

async function git(...args: string[]): Promise<string> {
  return (await exec("git", args, { cwd: root })).stdout;
}

beforeEach(async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  directory = await mkdtemp(resolve(".tmp/team-test-"));
  root = join(directory, "project");
  // Reuse existing history. These tests never create commits.
  await exec("git", ["clone", "--shared", "--no-checkout", "--quiet", process.cwd(), root]);
  await writeFile(join(root, "README.md"), "staged user content\n");
  await git("add", "README.md");
  await writeFile(join(root, "README.md"), "unstaged user content\n");
  await writeFile(join(root, "task.txt"), "baseline\n");
  service = new TeamWorktreeService(join(directory, "teams"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("team worktree integration", () => {
  it("recovers a prior-release workspace without inventing a task to replay", async () => {
    const workspace = await service.create("111111111111", { kind: "posix", path: root });
    const restarted = new TeamWorktreeService(join(directory, "teams"));
    expect(await restarted.load(workspace.runId)).toEqual({ workspace });
    expect(await restarted.list()).toEqual([{ runId: workspace.runId, workspace }]);
  });

  it("persists the task and report across restarts and preserves corrupt metadata", async () => {
    const workspace = await service.create("222222222222", { kind: "posix", path: root });
    const run = {
      version: 2 as const,
      parentThreadId: "parent",
      request: { agent: "worker", prompt: "finish task" },
      status: "running" as const,
      output: "",
    };
    service.saveRun(workspace, run);
    const restarted = new TeamWorktreeService(join(directory, "teams"));
    expect((await restarted.load(workspace.runId)).run).toEqual(run);
    const path = join(directory, "teams", workspace.runId, "run.json");
    await writeFile(path, JSON.stringify({ ...run, version: 1 }));
    expect((await restarted.load(workspace.runId)).run).toEqual(run);
    restarted.saveRun(workspace, { ...run, request: { ...run.request, execution: "one-shot" } });
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({
      version: 2,
      request: { execution: "one-shot" },
    });
    await writeFile(path, '{"version":99}');
    expect(() => restarted.saveRun(workspace, run)).toThrow("version");
    expect(await readFile(path, "utf8")).toBe('{"version":99}');
    expect(await restarted.list()).toMatchObject([
      { runId: workspace.runId, error: expect.any(String) },
    ]);
  });

  it("never re-applies an integrated task after a restart or overwrites later parent changes", async () => {
    const workspace = await service.create("333333333333", { kind: "posix", path: root });
    await writeFile(join(workspace.root, "task.txt"), "worker result\n");
    const result = await service.integrate(workspace, () => false);
    await writeFile(join(root, "task.txt"), "later parent work\n");
    const restarted = new TeamWorktreeService(join(directory, "teams"));
    expect(await restarted.integrate(workspace, () => false)).toEqual(result);
    expect(await readFile(join(root, "task.txt"), "utf8")).toBe("later parent work\n");
  });

  it("recognizes a patch applied before a crash prevented saving its receipt", async () => {
    const workspace = await service.create("444444444444", { kind: "posix", path: root });
    await writeFile(join(workspace.root, "task.txt"), "worker result\n");
    await service.integrate(workspace, () => false);
    const path = join(directory, "teams", workspace.runId, "integration.json");
    await writeFile(path, JSON.stringify({ version: 1, state: "prepared", files: ["task.txt"] }));
    const restarted = new TeamWorktreeService(join(directory, "teams"));
    expect(await restarted.integrate(workspace, () => false)).toEqual({
      status: "applied",
      files: ["task.txt"],
    });
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ state: "applied" });
  });

  it("removes integrated worktrees and Git refs while protecting unintegrated files", async () => {
    const workspace = await service.create("555555555555", { kind: "posix", path: root });
    await writeFile(join(workspace.root, "task.txt"), "worker result\n");
    await expect(service.remove(workspace.runId)).rejects.toThrow("explicit discard");
    expect(await readFile(join(workspace.root, "task.txt"), "utf8")).toBe("worker result\n");
    await service.integrate(workspace, () => false);
    await service.remove(workspace.runId);
    expect(await service.list()).toEqual([]);
    expect(await git("worktree", "list", "--porcelain")).not.toContain(workspace.root);
    expect(await git("for-each-ref", workspace.baselineRef)).toBe("");
    expect(await readFile(join(root, "task.txt"), "utf8")).toBe("worker result\n");
  });

  it("rejects a manifest redirecting cleanup outside the owned run directory", async () => {
    const workspace = await service.create("666666666666", { kind: "posix", path: root });
    await writeFile(
      join(directory, "teams", workspace.runId, "workspace.json"),
      JSON.stringify({ ...workspace, root }),
    );
    await expect(service.remove(workspace.runId, true)).rejects.toThrow("identity mismatch");
    expect(await readFile(join(root, "task.txt"), "utf8")).toBe("baseline\n");
  });
  it("snapshots dirty and untracked files and applies only child changes without changing HEAD or the parent index", async () => {
    const head = await git("rev-parse", "HEAD");
    const index = await readFile(join(root, ".git/index"));
    const workspace = await service.create("aaaaaaaaaaaa", { kind: "posix", path: root });
    expect(await readFile(join(workspace.root, "README.md"), "utf8")).toBe(
      "unstaged user content\n",
    );
    expect(await readFile(join(workspace.root, "task.txt"), "utf8")).toBe("baseline\n");
    await writeFile(join(workspace.root, "task.txt"), "worker result\n");
    await writeFile(join(workspace.root, "image.bin"), Buffer.from([0, 255, 0, 128]));
    await writeFile(join(root, "README.md"), "lead continued here\n");
    expect(await service.integrate(workspace, () => false)).toEqual({
      status: "applied",
      files: ["image.bin", "task.txt"],
    });
    expect(await readFile(join(root, "task.txt"), "utf8")).toBe("worker result\n");
    expect(await readFile(join(root, "README.md"), "utf8")).toBe("lead continued here\n");
    expect(await readFile(join(root, "image.bin"))).toEqual(Buffer.from([0, 255, 0, 128]));
    expect(await readFile(join(root, ".git/index"))).toEqual(index);
    expect(await git("rev-parse", "HEAD")).toBe(head);
  });

  it("leaves the whole parent patch unapplied on conflict and retains recovery files", async () => {
    const workspace = await service.create("bbbbbbbbbbbb", { kind: "posix", path: root });
    await writeFile(join(workspace.root, "task.txt"), "worker conflict\n");
    await writeFile(join(workspace.root, "new.txt"), "must not be partially applied\n");
    await writeFile(join(root, "task.txt"), "lead conflict\n");
    const result = await service.integrate(workspace, () => false);
    expect(result.status).toBe("needs_resolution");
    expect(await readFile(join(root, "task.txt"), "utf8")).toBe("lead conflict\n");
    await expect(readFile(join(root, "new.txt"))).rejects.toThrow("ENOENT");
    expect(await readFile(workspace.patchPath, "utf8")).toContain("worker conflict");
    expect(await readFile(join(workspace.root, "new.txt"), "utf8")).toContain("must not");
  });

  it("integrates independent siblings without overwriting either result", async () => {
    const first = await service.create("cccccccccccc", { kind: "posix", path: root });
    const second = await service.create("dddddddddddd", { kind: "posix", path: root });
    await writeFile(join(first.root, "first.txt"), "first\n");
    await writeFile(join(second.root, "second.txt"), "second\n");
    const results = await Promise.all([
      service.integrate(first, () => false),
      service.integrate(second, () => false),
    ]);
    expect(results.map((result) => result.status)).toEqual(["applied", "applied"]);
    expect(await readFile(join(root, "first.txt"), "utf8")).toBe("first\n");
    expect(await readFile(join(root, "second.txt"), "utf8")).toBe("second\n");
  });

  it("does not apply cancelled work", async () => {
    const workspace = await service.create("eeeeeeeeeeee", { kind: "posix", path: root });
    await writeFile(join(workspace.root, "task.txt"), "cancelled result\n");
    expect((await service.integrate(workspace, () => true)).status).toBe("cancelled");
    expect(await readFile(join(root, "task.txt"), "utf8")).toBe("baseline\n");
  });

  it("preserves nested project cwd and handles a task that changed no files", async () => {
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "nested/context.txt"), "context\n");
    const workspace = await service.create("ffffffffffff", {
      kind: "posix",
      path: join(root, "nested"),
    });
    expect(workspace.projectPath).toBe(join(workspace.root, "nested"));
    expect(await service.integrate(workspace, () => false)).toEqual({
      status: "no_changes",
      files: [],
    });
  });

  it("rejects an unborn repository instead of falling back to shared editing", async () => {
    const empty = join(directory, "empty");
    await mkdir(empty);
    await exec("git", ["init", "--quiet"], { cwd: empty });
    await expect(service.create("0123456789ab", { kind: "posix", path: empty })).rejects.toThrow(
      "HEAD",
    );
  });
});
