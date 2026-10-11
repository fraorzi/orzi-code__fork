import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { PoracodeBridge } from "@/shared/ipc";
import { useAppStore } from "@/renderer/state/appStore";
import { renderWithI18n } from "@/renderer/testUtils/i18n";
import { PromptChanges } from "./PromptChanges";

const bridge = vi.hoisted(() => ({
  getFileCheckpointDiff: vi.fn<PoracodeBridge["getFileCheckpointDiff"]>(),
  getPromptChangesStatus: vi.fn<PoracodeBridge["getPromptChangesStatus"]>(),
  revertPromptChanges: vi.fn<PoracodeBridge["revertPromptChanges"]>(),
  reapplyPromptChanges: vi.fn<PoracodeBridge["reapplyPromptChanges"]>(),
}));
vi.mock("@/renderer/bridge", () => ({ readBridge: () => bridge }));
vi.mock("./items/LazyInlineDiffView", () => ({
  LazyInlineDiffView: ({ diffText }: { diffText: string }) => <pre>{diffText}</pre>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    projects: [
      {
        id: "project",
        name: "Project",
        location: { kind: "posix", path: "/project" },
        createdAt: "2026-10-05",
      },
    ],
    threads: [
      {
        id: "thread",
        projectId: "project",
        title: "Thread",
        agentKind: "codex",
        config: { model: "test" },
        status: "idle",
        attention: "none",
        canResumeWithConfig: false,
        archived: false,
        done: false,
        starred: false,
        createdAt: "2026-10-05",
        updatedAt: "2026-10-05",
      },
    ],
    fileCheckpointTurnsByThread: {
      thread: {
        assistant: {
          threadId: "thread",
          checkpointItemId: "assistant",
          ref: "after",
          commit: "tree",
          capturedAt: "2026-10-05",
          baseRef: "before",
          baseCheckpointItemId: "user",
          changedFiles: [
            { path: "src/one.txt", status: "M" },
            { path: "two.txt", status: "A" },
          ],
        },
      },
    },
  });
  bridge.getFileCheckpointDiff.mockImplementation(async ({ filePath }) => ({
    diff: filePath
      ? `+only ${filePath}`
      : [
          "diff --git a/src/one.txt b/src/one.txt",
          "@@ -1 +1,2 @@",
          "-old",
          "+new",
          "+more",
          "diff --git a/two.txt b/two.txt",
          "@@ -0,0 +1 @@",
          "+added",
        ].join("\n"),
  }));
  bridge.getPromptChangesStatus.mockResolvedValue({
    files: [
      { path: "src/one.txt", state: "applied" },
      { path: "two.txt", state: "applied" },
    ],
  });
});

const prompt = { threadId: "thread", checkpointItemId: "assistant" };
const location = { projectLocation: { kind: "posix" as const, path: "/project" } };

it("summarizes the prompt's files and line counts", async () => {
  renderWithI18n(<PromptChanges {...prompt} />);
  expect(screen.getByText("Changes in this prompt")).toBeInTheDocument();
  expect(screen.getByText("2 files")).toBeInTheDocument();
  expect(await screen.findByText("+3")).toBeInTheDocument();
  expect(screen.getByText("-1")).toBeInTheDocument();
});

it("undoes the prompt in one click and restores it from the undone state", async () => {
  bridge.revertPromptChanges.mockResolvedValue({
    files: [
      { path: "src/one.txt", state: "reverted" },
      { path: "two.txt", state: "reverted" },
    ],
  });
  bridge.reapplyPromptChanges.mockResolvedValue({
    files: [
      { path: "src/one.txt", state: "applied" },
      { path: "two.txt", state: "applied" },
    ],
  });
  renderWithI18n(<PromptChanges {...prompt} />);
  const undo = screen.getByRole("button", { name: "Undo" });
  await waitFor(() => expect(undo).toBeEnabled());
  fireEvent.click(undo);
  await screen.findByText("Changes from this prompt were undone");
  expect(bridge.revertPromptChanges).toHaveBeenCalledWith({ ...prompt, ...location });

  fireEvent.click(screen.getByRole("button", { name: "Restore changes" }));
  await screen.findByText("Changes in this prompt");
  expect(bridge.reapplyPromptChanges).toHaveBeenCalledWith({ ...prompt, ...location });
});

it("blocks a full undo when a later prompt changed a file and offers the rest", async () => {
  bridge.getPromptChangesStatus.mockResolvedValue({
    files: [
      { path: "src/one.txt", state: "conflict" },
      { path: "two.txt", state: "applied" },
    ],
  });
  bridge.revertPromptChanges.mockResolvedValue({
    files: [
      { path: "src/one.txt", state: "conflict" },
      { path: "two.txt", state: "reverted" },
    ],
  });
  renderWithI18n(<PromptChanges {...prompt} />);
  fireEvent.click(await screen.findByRole("button", { name: "Undo the other files" }));
  expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  await waitFor(() =>
    expect(bridge.revertPromptChanges).toHaveBeenCalledWith({
      ...prompt,
      ...location,
      paths: ["two.txt"],
    }),
  );
});

it("loads one file's diff when it is selected in the review list", async () => {
  renderWithI18n(<PromptChanges {...prompt} />);
  fireEvent.click(screen.getByRole("button", { name: "Review" }));
  fireEvent.click(screen.getByRole("button", { name: /two\.txt/ }));
  await screen.findByText("+only two.txt");
  expect(bridge.getFileCheckpointDiff).toHaveBeenCalledWith({
    ...prompt,
    ...location,
    filePath: "two.txt",
  });
});
