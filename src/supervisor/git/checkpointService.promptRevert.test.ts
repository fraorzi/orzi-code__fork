import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
    await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/** Repo with a prompt that edits `a.txt`, deletes `b.txt` and creates `[c].txt`. */
async function repoWithPrompt() {
  mkdirSync(join(process.cwd(), ".tmp"), { recursive: true });
  const dir = mkdtempSync(join(process.cwd(), ".tmp/poracode-prompt-revert-"));
  tempDirs.push(dir);
  git(dir, "init", "--quiet");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Poracode Test");
  git(dir, "config", "core.autocrlf", "false");
  writeFileSync(join(dir, "a.txt"), "one\n");
  writeFileSync(join(dir, "b.txt"), "keep\n");
  git(dir, "add", ".");
  git(dir, "commit", "--quiet", "-m", "init");

  const projectLocation: ProjectLocation = { kind: "posix", path: dir };
  const service = new GitCheckpointService();
  const ids = { threadId: "thread-1", projectLocation };
  await service.create({ ...ids, checkpointItemId: "user-1" });
  writeFileSync(join(dir, "a.txt"), "two\n");
  rmSync(join(dir, "b.txt"));
  writeFileSync(join(dir, "[c].txt"), "new\n");
  await service.finalize({ ...ids, checkpointItemId: "turn-1", baseCheckpointItemId: "user-1" });
  return { dir, service, prompt: { ...ids, checkpointItemId: "turn-1" } };
}

const read = (dir: string, path: string) =>
  existsSync(join(dir, path)) ? readFileSync(join(dir, path), "utf8") : null;

function states(result: { files: { path: string; state: string }[] }) {
  return Object.fromEntries(result.files.map((file) => [file.path, file.state]));
}

describe.skipIf(!hasGit() || process.platform === "win32")("prompt change revert", () => {
  it("reverts and reapplies one prompt without touching the index", async () => {
    const { dir, service, prompt } = await repoWithPrompt();
    expect(states(await service.promptStatus(prompt))).toEqual({
      "a.txt": "applied",
      "b.txt": "applied",
      "[c].txt": "applied",
    });

    const reverted = await service.revertPrompt(prompt);
    expect(states(reverted)).toEqual({
      "a.txt": "reverted",
      "b.txt": "reverted",
      "[c].txt": "reverted",
    });
    expect(read(dir, "a.txt")).toBe("one\n");
    expect(read(dir, "b.txt")).toBe("keep\n");
    expect(read(dir, "[c].txt")).toBeNull();
    expect(git(dir, "diff", "--cached", "--name-only")).toBe("");

    await service.reapplyPrompt(prompt);
    expect(read(dir, "a.txt")).toBe("two\n");
    expect(read(dir, "b.txt")).toBeNull();
    expect(read(dir, "[c].txt")).toBe("new\n");
  });

  it("refuses files changed after the prompt but reverts the others", async () => {
    const { dir, service, prompt } = await repoWithPrompt();
    writeFileSync(join(dir, "a.txt"), "three\n");

    expect(states(await service.promptStatus(prompt))["a.txt"]).toBe("conflict");
    await expect(service.revertPrompt(prompt)).rejects.toThrow("a.txt");
    expect(read(dir, "[c].txt")).toBe("new\n");

    const partial = await service.revertPrompt({ ...prompt, paths: ["[c].txt", "b.txt"] });
    expect(states(partial)).toEqual({
      "a.txt": "conflict",
      "b.txt": "reverted",
      "[c].txt": "reverted",
    });
    expect(read(dir, "a.txt")).toBe("three\n");
  });

  it("tracks symlinks the prompt created, including links to directories", async () => {
    const { dir, service, prompt } = await repoWithPrompt();
    mkdirSync(join(dir, "skills"));
    writeFileSync(join(dir, "skills", "SKILL.md"), "skill\n");
    git(dir, "add", "skills");
    git(dir, "commit", "--quiet", "-m", "skills");
    const ids = { threadId: prompt.threadId, projectLocation: prompt.projectLocation };
    await service.create({ ...ids, checkpointItemId: "user-2" });
    symlinkSync(join(dir, "skills"), join(dir, "linked-skills"), "dir");
    symlinkSync("a.txt", join(dir, "a-link"));
    await service.finalize({ ...ids, checkpointItemId: "turn-2", baseCheckpointItemId: "user-2" });
    const linkPrompt = { ...ids, checkpointItemId: "turn-2" };

    expect(states(await service.promptStatus(linkPrompt))).toEqual({
      "a-link": "applied",
      "linked-skills": "applied",
    });
    await service.revertPrompt(linkPrompt);
    expect(existsSync(join(dir, "linked-skills"))).toBe(false);
    await service.reapplyPrompt(linkPrompt);
    expect(lstatSync(join(dir, "linked-skills")).isSymbolicLink()).toBe(true);
    expect(states(await service.promptStatus(linkPrompt))).toEqual({
      "a-link": "applied",
      "linked-skills": "applied",
    });
  });

  it("rejects paths outside the prompt", async () => {
    const { service, prompt } = await repoWithPrompt();
    await expect(service.revertPrompt({ ...prompt, paths: ["other.txt"] })).rejects.toThrow(
      "not part of this prompt",
    );
  });
});
