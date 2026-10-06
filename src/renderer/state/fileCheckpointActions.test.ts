import { beforeEach, expect, it, vi } from "vitest";
import type { FileCheckpointTurn, Project, Thread } from "@/shared/contracts";
import type { PoracodeBridge } from "@/shared/ipc";
import { useAppStore } from "./appStore";
import { captureFileCheckpoint, finalizeLatestPromptChanges } from "./fileCheckpointActions";

const bridge = vi.hoisted(() => ({
  createFileCheckpoint: vi.fn<PoracodeBridge["createFileCheckpoint"]>(),
  finalizeFileCheckpoint: vi.fn<PoracodeBridge["finalizeFileCheckpoint"]>(),
}));
vi.mock("@/renderer/bridge", () => ({ readBridge: () => bridge }));

const project: Project = {
  id: "project",
  name: "Project",
  location: { kind: "posix", path: "/project" },
  createdAt: "2026-10-05T00:00:00Z",
};
const thread: Thread = {
  id: "thread",
  projectId: project.id,
  title: "Thread",
  agentKind: "codex",
  config: { model: "test" },
  status: "idle",
  attention: "none",
  canResumeWithConfig: false,
  archived: false,
  done: false,
  starred: false,
  createdAt: project.createdAt,
  updatedAt: project.createdAt,
};
const base = {
  threadId: thread.id,
  checkpointItemId: "user",
  ref: "base",
  commit: "base-tree",
  capturedAt: project.createdAt,
};
const finished: FileCheckpointTurn = {
  ...base,
  checkpointItemId: "assistant",
  ref: "after",
  commit: "after-tree",
  baseCheckpointItemId: "user",
  baseRef: "base",
  changedFiles: [{ path: "file.txt", status: "M" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    projects: [project],
    threads: [thread],
    runtimeItemIdsByThread: { [thread.id]: ["user", "assistant"] },
    runtimeItemsByIdByThread: {
      [thread.id]: {
        user: {
          id: "user",
          type: "user_message",
          state: "completed",
          payload: {},
          streams: {},
          observedLive: true,
        },
        assistant: {
          id: "assistant",
          type: "assistant_message",
          state: "completed",
          payload: {},
          streams: {},
          observedLive: true,
        },
      },
    },
    runtimeCompletedTurnsByThread: {
      [thread.id]: [{ startedAt: 1, endedAt: 2, anchorItemId: "assistant" }],
    },
    fileCheckpointsByThread: { [thread.id]: { user: base } },
    fileCheckpointTurnsByThread: {},
  });
  bridge.finalizeFileCheckpoint.mockResolvedValue({ checkpoint: finished });
  bridge.createFileCheckpoint.mockResolvedValue({
    checkpoint: { ...base, checkpointItemId: "user-2" },
  });
});

it("finalizes a background thread without mounting a chat and deduplicates the result", async () => {
  await finalizeLatestPromptChanges(thread.id);
  await finalizeLatestPromptChanges(thread.id);
  expect(bridge.finalizeFileCheckpoint).toHaveBeenCalledExactlyOnceWith({
    threadId: thread.id,
    checkpointItemId: "assistant",
    baseCheckpointItemId: "user",
    projectLocation: project.location,
  });
  expect(useAppStore.getState().fileCheckpointTurnsByThread[thread.id]?.assistant).toEqual(
    finished,
  );
});

it("finishes the previous snapshot before capturing the next prompt baseline", async () => {
  let finish: (result: { checkpoint: FileCheckpointTurn }) => void = () => {};
  bridge.finalizeFileCheckpoint.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const pending = finalizeLatestPromptChanges(thread.id);
  const capture = captureFileCheckpoint({
    threadId: thread.id,
    checkpointItemId: "user-2",
    projectLocation: project.location,
  });
  await Promise.resolve();
  expect(bridge.createFileCheckpoint).not.toHaveBeenCalled();
  finish({ checkpoint: finished });
  await Promise.all([pending, capture]);
  expect(bridge.createFileCheckpoint).toHaveBeenCalledOnce();
});

it("does not fabricate a diff without the before-prompt snapshot", async () => {
  useAppStore.setState({ fileCheckpointsByThread: {} });
  await finalizeLatestPromptChanges(thread.id);
  expect(bridge.finalizeFileCheckpoint).not.toHaveBeenCalled();
});
