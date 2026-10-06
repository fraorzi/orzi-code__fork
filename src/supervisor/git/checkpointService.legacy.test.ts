import { expect, it, vi } from "vitest";
import { GitCheckpointService } from "./checkpointService";

const execGit = vi.hoisted(() => vi.fn<typeof import("./exec").execGit>());
vi.mock("./exec", () => ({ execGit }));

it("reads pre-v2 commit-backed metadata without requiring the new storageVersion field", async () => {
  const ref = "refs/poracode/checkpoints/thread/assistant";
  execGit.mockImplementation(async (_location, args) => {
    if (args[0] === "for-each-ref") return ref;
    if (args[0] === "cat-file") return "commit";
    if (args[0] === "rev-parse") return "legacy-commit";
    if (args[0] === "log")
      return `Poracode checkpoint\n\n${JSON.stringify({
        threadId: "thread",
        checkpointItemId: "assistant",
        capturedAt: "2026-10-01T00:00:00Z",
        ref,
        baseCheckpointItemId: "user",
        baseRef: "base",
        changedFiles: [{ path: "file.txt", status: "M" }],
      })}\n`;
    throw new Error(`Unexpected Git operation: ${args[0]}`);
  });
  const result = await new GitCheckpointService().list({
    threadId: "thread",
    projectLocation: { kind: "posix", path: "/project" },
  });
  expect(result.turns).toHaveLength(1);
  expect(result.turns[0]).toMatchObject({
    commit: "legacy-commit",
    baseRef: "base",
    changedFiles: [{ path: "file.txt", status: "M" }],
  });
  expect(result.turns[0]?.storageVersion).toBeUndefined();
});
