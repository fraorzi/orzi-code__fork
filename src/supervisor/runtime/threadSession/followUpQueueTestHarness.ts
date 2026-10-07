import { vi } from "vitest";
import type { RuntimeEvent, SetPendingSteerPayload, ThreadStatus } from "@/shared/contracts";
import type { SupervisorEvent } from "@/shared/ipc";
import type { SessionRuntime, QueuedStructuredTurn } from "../sessionTypes";
import type { SteerSubmissionOptions } from "./steerCoordinator";
import { FollowUpQueueCoordinator } from "./followUpQueueCoordinator";
import type { FollowUpQueueStore } from "./followUpQueueStore";

export function createFollowUpQueueHarness(
  initial: ThreadStatus = "working",
  store?: FollowUpQueueStore,
) {
  const session = {
    threadId: "thread",
    instanceId: "instance",
    presentationMode: "gui",
    status: initial,
    config: { model: "model" },
    structuredSession: {
      startTurn: vi.fn<() => Promise<void>>(),
      steerTurn: vi.fn<() => Promise<void>>(),
    },
  } as unknown as SessionRuntime;
  const sessions = new Map([[session.threadId, session]]);
  const emit = vi.fn<(event: SupervisorEvent) => void>();
  const prepare = vi.fn<
    (session: SessionRuntime, payload: SetPendingSteerPayload) => Promise<QueuedStructuredTurn>
  >(
    async (
      _session: SessionRuntime,
      payload: SetPendingSteerPayload,
    ): Promise<QueuedStructuredTurn> => ({
      prompt: payload.prompt,
      config: payload.config,
      ...(payload.segments ? { segments: payload.segments } : {}),
    }),
  );
  const start = vi.fn<(session: SessionRuntime, turn: QueuedStructuredTurn) => Promise<void>>(
    (_session: SessionRuntime, _turn: QueuedStructuredTurn) => Promise.resolve(),
  );
  const restart = vi.fn<(session: SessionRuntime, turn: QueuedStructuredTurn) => Promise<void>>(
    async (_session: SessionRuntime, _turn: QueuedStructuredTurn) => {},
  );
  const steer = vi.fn<
    (payload: SetPendingSteerPayload, options?: SteerSubmissionOptions) => Promise<void>
  >(async () => {});
  const queue = new FollowUpQueueCoordinator({
    ...(store ? { store } : {}),
    sessions,
    emit,
    waitForPendingStart: async () => {},
    isCurrentSession: (candidate) => sessions.get(candidate.threadId) === candidate,
    prepareTurn: prepare,
    startStructuredTurn: start,
    restartStructuredTurn: restart,
    steer,
  });
  queue.onSessionAttached(session);
  function event(
    runtimeEvent:
      | Omit<Extract<RuntimeEvent, { type: "turn.started" }>, "threadId">
      | Omit<Extract<RuntimeEvent, { type: "turn.completed" }>, "threadId">,
  ) {
    queue.onStructuredRuntimeEvent(session, { ...runtimeEvent, threadId: session.threadId });
  }
  function status(value: ThreadStatus) {
    session.status = value;
    queue.onStructuredUpdate(session, value);
  }
  function begin(turnId: string) {
    event({ type: "turn.started", turnId });
    status("working");
  }
  function complete(turnId: string, state: "completed" | "cancelled" = "completed") {
    event({ type: "turn.completed", turnId, state });
    status("idle");
  }
  if (initial === "working") begin("initial");
  const add = (prompt: string) =>
    queue.queueThreadFollowUp({ threadId: "thread", prompt, config: session.config });
  const state = () => queue.getThreadFollowUpQueue("thread");
  const item = (index = 0) => ({ threadId: "thread", id: state()!.items[index]!.id });
  return {
    queue,
    session,
    ...(store ? { store } : {}),
    sessions,
    emit,
    prepare,
    start,
    restart,
    steer,
    status,
    event,
    begin,
    complete,
    add,
    state,
    item,
  };
}
