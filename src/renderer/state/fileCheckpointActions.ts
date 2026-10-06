// Modified for the orzi-code__fork personal fork by Franciszek Orzechowski on 2026-10-06.
import { isHomeProjectId } from "@/shared/homeScope";
import { resolveProjectLocation } from "@/shared/worktree";
import type { ProjectLocation } from "@/shared/contracts";
import { readBridge } from "@/renderer/bridge";
import { useAppStore } from "./appStore";

const pendingFinalizations = new Map<string, Promise<void>>();

export async function captureFileCheckpoint(input: {
  threadId: string;
  checkpointItemId: string;
  projectLocation: ProjectLocation;
}): Promise<void> {
  try {
    await Promise.all(
      [...pendingFinalizations.entries()]
        .filter(([key]) => key.startsWith(`${input.threadId}\0`))
        .map(([, pending]) => pending),
    );
    const result = await readBridge().createFileCheckpoint(input);
    useAppStore.getState().upsertThreadFileCheckpoint(input.threadId, result.checkpoint);
  } catch (error) {
    console.warn("[checkpoint] failed to capture file checkpoint", error);
  }
}

export async function hydrateFileCheckpoints(input: {
  threadId: string;
  projectLocation: ProjectLocation;
}): Promise<void> {
  try {
    const result = await readBridge().listFileCheckpoints(input);
    useAppStore
      .getState()
      .hydrateThreadFileCheckpoints(input.threadId, result.checkpoints, result.turns);
  } catch (error) {
    console.warn("[checkpoint] failed to hydrate file checkpoints", error);
  }
}

export async function finalizeFileCheckpoint(input: {
  threadId: string;
  checkpointItemId: string;
  baseCheckpointItemId: string;
  projectLocation: ProjectLocation;
}): Promise<void> {
  try {
    const result = await readBridge().finalizeFileCheckpoint(input);
    useAppStore.getState().upsertThreadFileCheckpointTurn(input.threadId, result.checkpoint);
  } catch (error) {
    console.warn("[checkpoint] failed to finalize file checkpoint", error);
  }
}

/** Called from the live event stream, including threads with no mounted chat pane. */
export function finalizeLatestPromptChanges(threadId: string): Promise<void> {
  const state = useAppStore.getState();
  const turn = state.runtimeCompletedTurnsByThread[threadId]?.at(-1);
  const checkpointItemId = turn?.anchorItemId;
  if (!checkpointItemId || state.fileCheckpointTurnsByThread[threadId]?.[checkpointItemId])
    return Promise.resolve();
  const key = `${threadId}\0${checkpointItemId}`;
  const pending = pendingFinalizations.get(key);
  if (pending) return pending;
  const thread = state.threads.find((entry) => entry.id === threadId);
  if (!thread || thread.remoteServerId || isHomeProjectId(thread.projectId))
    return Promise.resolve();
  const project = state.projects.find((entry) => entry.id === thread.projectId);
  if (!project) return Promise.resolve();
  const ids = state.runtimeItemIdsByThread[threadId] ?? [];
  let baseCheckpointItemId: string | undefined;
  for (let index = ids.indexOf(checkpointItemId); index >= 0; index--) {
    const id = ids[index];
    if (id && state.runtimeItemsByIdByThread[threadId]?.[id]?.type === "user_message") {
      baseCheckpointItemId = id;
      break;
    }
  }
  if (!baseCheckpointItemId || !state.fileCheckpointsByThread[threadId]?.[baseCheckpointItemId])
    return Promise.resolve();
  const work = finalizeFileCheckpoint({
    threadId,
    checkpointItemId,
    baseCheckpointItemId,
    projectLocation: resolveProjectLocation(project.location, thread.worktreePath),
  }).finally(() => pendingFinalizations.delete(key));
  pendingFinalizations.set(key, work);
  return work;
}
