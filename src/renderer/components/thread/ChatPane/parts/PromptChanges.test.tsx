import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { PoracodeBridge } from "@/shared/ipc";
import { useAppStore } from "@/renderer/state/appStore";
import { renderWithI18n } from "@/renderer/testUtils/i18n";
import { PromptChanges } from "./PromptChanges";

const getFileCheckpointDiff = vi.hoisted(() => vi.fn<PoracodeBridge["getFileCheckpointDiff"]>());
vi.mock("@/renderer/bridge", () => ({ readBridge: () => ({ getFileCheckpointDiff }) }));
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
          changedFiles: [{ path: "one.txt", status: "M" }],
        },
      },
    },
  });
  getFileCheckpointDiff.mockResolvedValue({ diff: "+only this prompt" });
});

it("loads the immutable prompt snapshot on demand and keeps it when collapsed and reopened", async () => {
  renderWithI18n(<PromptChanges threadId="thread" checkpointItemId="assistant" />);
  expect(getFileCheckpointDiff).not.toHaveBeenCalled();
  const button = screen.getByRole("button", { name: "Changes in this prompt (1)" });
  fireEvent.click(button);
  await screen.findByText("+only this prompt");
  expect(getFileCheckpointDiff).toHaveBeenCalledExactlyOnceWith({
    threadId: "thread",
    checkpointItemId: "assistant",
    projectLocation: { kind: "posix", path: "/project" },
  });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(getFileCheckpointDiff.mock.calls).toHaveLength(1);
});

it("reports a snapshot read failure without substituting the project-wide diff", async () => {
  getFileCheckpointDiff.mockRejectedValue(new Error("snapshot unavailable"));
  renderWithI18n(<PromptChanges threadId="thread" checkpointItemId="assistant" />);
  fireEvent.click(screen.getByRole("button", { name: "Changes in this prompt (1)" }));
  await waitFor(() => expect(screen.getByText("Could not load this diff.")).toBeInTheDocument());
});
