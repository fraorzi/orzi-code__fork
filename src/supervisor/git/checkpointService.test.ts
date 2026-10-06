// Modified for the orzi-code__fork personal fork by Franciszek Orzechowski on 2026-10-06.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectLocation } from "@/shared/contracts";
import { GitCheckpointService } from "./checkpointService";

function hasGit(): boolean {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    try {
      await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // Windows can briefly lock temp git repos while subprocesses exit.
    }
  }
});

function makeRepo(): { dir: string; location: ProjectLocation } {
  mkdirSync(join(process.cwd(), ".tmp"), { recursive: true });
  const dir = mkdtempSync(join(process.cwd(), ".tmp/poracode-checkpoints-"));
  tempDirs.push(dir);
  git(dir, "clone", "--shared", "--quiet", process.cwd(), dir);
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Poracode Test");
  git(dir, "config", "core.autocrlf", "false");
  writeFileSync(join(dir, "README.md"), "before\n");

  const location: ProjectLocation =
    process.platform === "win32" ? { kind: "windows", path: dir } : { kind: "posix", path: dir };
  return { dir, location };
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/**
 * Hide the developer's own global/system git identity so the repository really
 * has none, mirroring a fresh machine. Returns a restore callback.
 */
function hideGitIdentityConfig(dir: string): () => void {
  const previous = {
    GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL,
    GIT_CONFIG_SYSTEM: process.env.GIT_CONFIG_SYSTEM,
    GIT_CONFIG_NOSYSTEM: process.env.GIT_CONFIG_NOSYSTEM,
  };
  process.env.GIT_CONFIG_GLOBAL = join(dir, "absent-global-config");
  process.env.GIT_CONFIG_SYSTEM = join(dir, "absent-system-config");
  process.env.GIT_CONFIG_NOSYSTEM = "1";
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

describe.skipIf(!hasGit())("GitCheckpointService", () => {
  it("captures turn snapshots and restores tracked plus untracked files", async () => {
    const { dir, location } = makeRepo();
    const service = new GitCheckpointService();

    const before = await service.create({
      threadId: "thread-1",
      checkpointItemId: "user-1",
      projectLocation: location,
    });

    writeFileSync(join(dir, "README.md"), "after\n");
    writeFileSync(join(dir, "new.txt"), "new\n");

    const after = await service.finalize({
      threadId: "thread-1",
      checkpointItemId: "assistant-1",
      baseCheckpointItemId: "user-1",
      projectLocation: location,
    });

    expect(after.baseRef).toBe(before.ref);
    expect(after.changedFiles.map((file) => file.path).sort()).toEqual(["README.md", "new.txt"]);
    expect(git(dir, "cat-file", "-t", before.ref).trim()).toBe("tree");

    await service.restore({
      threadId: "thread-1",
      checkpointItemId: "user-1",
      projectLocation: location,
    });

    expect(readFileSync(join(dir, "README.md"), "utf8")).toBe("before\n");
    expect(existsSync(join(dir, "new.txt"))).toBe(false);
    expect(git(dir, "status", "--porcelain").trim()).toBe("M README.md");

    await service.restore({
      threadId: "thread-1",
      checkpointItemId: "assistant-1",
      projectLocation: location,
    });

    expect(readFileSync(join(dir, "README.md"), "utf8")).toBe("after\n");
    expect(readFileSync(join(dir, "new.txt"), "utf8")).toBe("new\n");
    expect(git(dir, "status", "--porcelain").split(/\r?\n/).filter(Boolean).sort()).toEqual([
      " M README.md",
      "?? new.txt",
    ]);
  }, 45_000);

  it("snapshots a repository that has no configured git identity", async () => {
    const { dir, location } = makeRepo();
    // Simulate a machine with no user.name/user.email anywhere: dropping the
    // local values plus `user.useConfigOnly` makes git refuse to auto-detect,
    // which is exactly the "Author identity unknown" failure reported in the wild.
    git(dir, "config", "--unset", "user.email");
    git(dir, "config", "--unset", "user.name");
    git(dir, "config", "user.useConfigOnly", "true");
    const service = new GitCheckpointService();
    const restoreEnv = hideGitIdentityConfig(dir);

    try {
      writeFileSync(join(dir, "new.txt"), "new\n");
      const checkpoint = await service.create({
        threadId: "thread-1",
        checkpointItemId: "user-1",
        projectLocation: location,
      });

      expect(git(dir, "cat-file", "-t", checkpoint.ref).trim()).toBe("tree");
      await expect(
        service.list({ threadId: "thread-1", projectLocation: location }),
      ).resolves.toMatchObject({ checkpoints: [{ ref: checkpoint.ref }] });
    } finally {
      restoreEnv();
    }
  }, 45_000);

  it("freezes each prompt diff and excludes pre-existing changes and later prompts", async () => {
    const { dir, location } = makeRepo();
    const service = new GitCheckpointService();
    const head = git(dir, "rev-parse", "HEAD");
    await service.create({
      threadId: "thread-1",
      checkpointItemId: "user-1",
      projectLocation: location,
    });
    writeFileSync(join(dir, "first.txt"), "first prompt\n");
    await service.finalize({
      threadId: "thread-1",
      checkpointItemId: "assistant-1",
      baseCheckpointItemId: "user-1",
      projectLocation: location,
    });
    await service.create({
      threadId: "thread-1",
      checkpointItemId: "user-2",
      projectLocation: location,
    });
    writeFileSync(join(dir, "second.txt"), "second prompt\n");
    await service.finalize({
      threadId: "thread-1",
      checkpointItemId: "assistant-2",
      baseCheckpointItemId: "user-2",
      projectLocation: location,
    });
    const first = await service.diff({
      threadId: "thread-1",
      checkpointItemId: "assistant-1",
      projectLocation: location,
    });
    expect(first.diff).toContain("first prompt");
    expect(first.diff).not.toContain("README.md");
    expect(first.diff).not.toContain("second.txt");
    const second = await service.diff({
      threadId: "thread-1",
      checkpointItemId: "assistant-2",
      projectLocation: location,
    });
    expect(second.diff).toContain("second prompt");
    expect(second.diff).not.toContain("first.txt");
    await service.finalize({
      threadId: "thread-1",
      checkpointItemId: "assistant-1",
      baseCheckpointItemId: "user-1",
      projectLocation: location,
    });
    expect(
      await service.diff({
        threadId: "thread-1",
        checkpointItemId: "assistant-1",
        projectLocation: location,
      }),
    ).toEqual(first);
    expect(git(dir, "rev-parse", "HEAD")).toBe(head);
    await expect(
      service.diff({
        threadId: "thread-1",
        checkpointItemId: "assistant-1",
        filePath: "README.md",
        projectLocation: location,
      }),
    ).rejects.toThrow("File is not part");
  }, 45_000);

  it("reports a missing base checkpoint without surfacing raw git ref errors", async () => {
    const { location } = makeRepo();
    const service = new GitCheckpointService();

    await expect(
      service.finalize({
        threadId: "thread-1",
        checkpointItemId: "assistant-1",
        baseCheckpointItemId: "user-1",
        projectLocation: location,
      }),
    ).rejects.toThrow("No file checkpoint exists for item user-1.");
  });

  it("reads and restores checkpoints created under the legacy ref namespace", async () => {
    const { dir, location } = makeRepo();
    const service = new GitCheckpointService();
    const checkpoint = await service.create({
      threadId: "thread-1",
      checkpointItemId: "user-1",
      projectLocation: location,
    });
    const legacyRef = checkpoint.ref.replace("refs/poracode/", "refs/lightcode/");
    git(dir, "update-ref", legacyRef, checkpoint.commit);
    const metadataRef = checkpoint.ref.replace("/checkpoints/", "/checkpoint-metadata/");
    git(
      dir,
      "update-ref",
      metadataRef.replace("refs/poracode/", "refs/lightcode/"),
      git(dir, "rev-parse", metadataRef).trim(),
    );
    git(dir, "update-ref", "-d", checkpoint.ref);

    writeFileSync(join(dir, "README.md"), "after\n");
    await service.restore({
      threadId: "thread-1",
      checkpointItemId: "user-1",
      projectLocation: location,
    });

    expect(readFileSync(join(dir, "README.md"), "utf8")).toBe("before\n");
    await expect(
      service.list({ threadId: "thread-1", projectLocation: location }),
    ).resolves.toMatchObject({ checkpoints: [{ ref: legacyRef }] });
  });
});
