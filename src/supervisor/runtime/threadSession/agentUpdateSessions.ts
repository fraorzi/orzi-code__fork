import type { SessionRuntime } from "../sessionTypes";

/** A saved, settled GUI process can be recreated on the next prompt. */
export function canCloseAgentSessionForUpdate(
  session: SessionRuntime,
  work: { hasPendingWork: boolean; hasActiveRuns: boolean },
): boolean {
  return (
    (session.status === "inactive" ||
      (session.presentationMode === "gui" &&
        session.sessionRef !== undefined &&
        (session.status === "idle" ||
          session.status === "finished" ||
          session.status === "error"))) &&
    !session.pendingLaunchPrompt &&
    !session.pendingSteer &&
    (session.structuredSession?.getBackgroundTasks?.().length ?? 0) === 0 &&
    !work.hasActiveRuns &&
    !work.hasPendingWork
  );
}
