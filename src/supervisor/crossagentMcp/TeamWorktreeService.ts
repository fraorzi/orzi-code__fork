import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { promisify } from "node:util";
import type { ProjectLocation } from "@/shared/contracts";

const execFileAsync = promisify(execFile);

export interface TeamWorkspace {
  version: 1;
  runId: string;
  parentRoot: string;
  root: string;
  projectPath: string;
  baselineTree: string;
  baselineRef: string;
  patchPath: string;
}

export type TeamIntegration =
  | { status: "applied" | "no_changes"; files: string[] }
  | { status: "needs_resolution"; files: string[]; message: string }
  | { status: "cancelled"; files: string[] };

/** Native Git snapshots and patch integration, without commits or parent index writes. */
export class TeamWorktreeService {
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly directory: string) {}

  async create(runId: string, location: ProjectLocation): Promise<TeamWorkspace> {
    if (location.kind !== "posix") {
      throw new Error("Teamwork currently requires a native POSIX Git project.");
    }
    if (!/^[a-f0-9]{12}$/.test(runId)) throw new Error("Invalid team run id");
    const projectPath = await realpath(location.path);
    const parentRoot = await realpath(
      (await this.git(projectPath, ["rev-parse", "--show-toplevel"])).trim(),
    );
    return this.serial(parentRoot, async () => {
      await this.git(parentRoot, ["rev-parse", "--verify", "HEAD"]);
      const runDirectory = join(this.directory, runId);
      await mkdir(runDirectory, { recursive: true });
      const baselineTree = await this.snapshot(parentRoot, "HEAD", runDirectory);
      if (
        (await this.git(parentRoot, ["ls-tree", "-r", baselineTree]))
          .split("\n")
          .some((line) => line.startsWith("160000 "))
      ) {
        throw new Error("Teamwork does not yet support repositories with submodules.");
      }
      const root = join(runDirectory, "worktree");
      const projectRelative = relative(parentRoot, projectPath);
      if (projectRelative.startsWith("..") || isAbsolute(projectRelative))
        throw new Error("Project is outside its Git root");
      const workspace: TeamWorkspace = {
        version: 1,
        runId,
        parentRoot,
        root,
        projectPath: join(root, projectRelative),
        baselineTree,
        baselineRef: `refs/poracode-team/${runId}/baseline`,
        patchPath: join(runDirectory, "changes.patch"),
      };
      // Keep the snapshot reachable even if Git GC runs while the child works.
      await this.git(parentRoot, ["update-ref", workspace.baselineRef, baselineTree]);
      await writeFile(join(runDirectory, "workspace.json"), JSON.stringify(workspace, null, 2), {
        mode: 0o600,
      });
      await this.git(parentRoot, [
        "-c",
        "core.hooksPath=/dev/null",
        "worktree",
        "add",
        "--no-checkout",
        "--detach",
        root,
        "HEAD",
      ]);
      await this.git(root, ["read-tree", "--reset", "-u", baselineTree]);
      return workspace;
    });
  }

  async integrate(workspace: TeamWorkspace, isCancelled: () => boolean): Promise<TeamIntegration> {
    return this.serial(workspace.parentRoot, async () => {
      if (isCancelled()) return { status: "cancelled", files: [] };
      const finalTree = await this.snapshot(
        workspace.root,
        workspace.baselineTree,
        join(this.directory, workspace.runId),
      );
      const files = (
        await this.git(workspace.root, [
          "diff",
          "--name-only",
          "-z",
          workspace.baselineTree,
          finalTree,
        ])
      )
        .split("\0")
        .filter(Boolean);
      const patch = await this.git(workspace.root, [
        "diff",
        "--binary",
        "--full-index",
        "--no-ext-diff",
        "--no-textconv",
        workspace.baselineTree,
        finalTree,
      ]);
      await writeFile(workspace.patchPath, patch, { mode: 0o600 });
      if (isCancelled()) return { status: "cancelled", files };
      if (files.length === 0) return { status: "no_changes", files };
      try {
        // Git validates the whole patch before writing. No --index/--3way: the
        // user's staged state must survive both a successful apply and conflicts.
        await this.git(workspace.parentRoot, ["apply", "--whitespace=nowarn", workspace.patchPath]);
        return { status: "applied", files };
      } catch (error) {
        return {
          status: "needs_resolution",
          files,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    });
  }

  private async snapshot(root: string, base: string, directory: string): Promise<string> {
    const temporary = await mkdtemp(join(directory, "index-"));
    const indexFile = join(temporary, "index");
    try {
      await this.git(root, ["read-tree", base], indexFile);
      await this.git(root, ["add", "--all", "--", "."], indexFile);
      return (await this.git(root, ["write-tree"], indexFile)).trim();
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }

  private async git(cwd: string, args: string[], indexFile?: string): Promise<string> {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        ...(indexFile ? { GIT_INDEX_FILE: indexFile } : {}),
      },
      timeout: 60_000,
      maxBuffer: 64 * 1024 * 1024,
      encoding: "utf8",
    });
    return stdout;
  }

  private async serial<T>(root: string, action: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(root);
    const next = (previous ?? Promise.resolve()).catch(() => undefined).then(action);
    this.queues.set(root, next);
    try {
      return await next;
    } finally {
      if (this.queues.get(root) === next) this.queues.delete(root);
    }
  }
}
