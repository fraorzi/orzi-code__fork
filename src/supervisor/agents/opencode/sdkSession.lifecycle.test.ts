import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Event } from "./legacySdk";
import type { RuntimeEvent } from "@/shared/contracts";
import type { StructuredSessionUpdate } from "../base";
import { OpencodeSdkSession } from "./sdkSession";

const mocks = vi.hoisted(() => ({
  acquire: vi.fn<(input: unknown) => Promise<unknown>>(),
  subscribe: vi.fn<(input: { onEvent: (event: Event) => void }) => () => void>(),
}));
vi.mock("./sdkClient", async (importActual) => ({
  ...(await importActual<typeof import("./sdkClient")>()),
  acquireOpenCodeServer: mocks.acquire,
}));
vi.mock("./sdkEventHub", () => ({ subscribeOpenCodeServerEvents: mocks.subscribe }));

const config = { model: "opencode/test" };

async function fixture() {
  let event: (event: Event) => void = () => {};
  let exit: () => void = () => {};
  mocks.subscribe.mockImplementation((input) => {
    event = input.onEvent;
    return () => {};
  });
  const promptAsync = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const acquire = () => ({
    client: {
      command: { list: vi.fn<() => Promise<{ data: [] }>>().mockResolvedValue({ data: [] }) },
      session: {
        create: vi
          .fn<() => Promise<{ data: { id: string } }>>()
          .mockResolvedValue({ data: { id: "ses_lifecycle" } }),
        promptAsync,
      },
    },
    eventClient: {},
    baseUrl: "http://127.0.0.1:1",
    handle: { formatOutput: () => "" },
    dispose: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    onServerExit(callback: () => void) {
      exit = callback;
      return () => {};
    },
  });
  mocks.acquire.mockImplementation(async () => acquire());
  const session = await OpencodeSdkSession.create({
    threadId: "thread-lifecycle",
    projectLocation: { kind: "posix", path: "/repo" },
    config,
    presentationMode: "gui",
  });
  const events: RuntimeEvent[] = [];
  const updates: StructuredSessionUpdate[] = [];
  session.setListener({
    onClose() {},
    onError() {},
    onRuntimeEvent: (value) => events.push(value),
    onUpdate: (value) => updates.push(value),
  });
  await session.activate();
  await session.openThread(config);
  return {
    session,
    events,
    updates,
    promptAsync,
    event: (value: Event) => event(value),
    exit: () => exit(),
  };
}

beforeEach(() => vi.resetAllMocks());

describe("OpenCode prompt and process lifecycle", () => {
  it("settles an idle event that arrives before promptAsync resolves", async () => {
    const f = await fixture();
    try {
      f.promptAsync.mockImplementationOnce(async () => {
        f.event({ id: "idle", type: "session.idle", properties: { sessionID: "ses_lifecycle" } });
      });
      await f.session.startTurn("first prompt", config);
      expect(f.events.filter((event) => event.type === "turn.completed")).toEqual([
        expect.objectContaining({ state: "completed" }),
      ]);
      f.session.forceCompleteTurn();
      expect(f.events.filter((event) => event.type === "turn.completed")).toHaveLength(1);
    } finally {
      await f.session.dispose();
    }
  });

  it("fails active work and cancels pending requests when its provider server exits", async () => {
    const f = await fixture();
    try {
      await f.session.startTurn("work", config);
      f.event({
        id: "permission",
        type: "permission.asked",
        properties: {
          id: "permission-1",
          sessionID: "ses_lifecycle",
          permission: "bash",
          patterns: ["pwd"],
          metadata: {},
          always: [],
        },
      });
      f.exit();
      await vi.waitFor(() => expect(mocks.acquire).toHaveBeenCalledTimes(2));
      expect(f.events).toContainEqual(
        expect.objectContaining({ type: "turn.completed", state: "failed" }),
      );
      expect(f.events).toContainEqual(
        expect.objectContaining({
          type: "request.resolved",
          requestId: "opencode-perm-permission-1",
          outcome: "cancelled",
        }),
      );
      expect(f.updates).toContainEqual(
        expect.objectContaining({ status: "error", attention: "error" }),
      );
      await f.session.startTurn("after recovery", config);
      f.event({ id: "idle-2", type: "session.idle", properties: { sessionID: "ses_lifecycle" } });
      expect(f.updates.at(-1)?.status).toBe("idle");
    } finally {
      await f.session.dispose();
    }
  });

  it("does not leave a ghost turn when promptAsync rejects", async () => {
    const f = await fixture();
    try {
      f.promptAsync.mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(f.session.startTurn("work", config)).rejects.toThrow("rejected authentication");
      f.event({ id: "idle", type: "session.idle", properties: { sessionID: "ses_lifecycle" } });
      expect(f.events.filter((event) => event.type === "turn.completed")).toEqual([]);
    } finally {
      await f.session.dispose();
    }
  });

  it.each([false, true])(
    "does not let an old request rejection clobber a newer turn, server exit=%s",
    async (serverExit) => {
      const f = await fixture();
      let rejectOld: (cause: Error) => void = () => {};
      f.promptAsync.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectOld = reject;
          }),
      );
      try {
        const oldRequest = f.session.startTurn("old", config);
        await vi.waitFor(() => expect(f.promptAsync).toHaveBeenCalledTimes(1));
        if (serverExit) {
          f.exit();
        } else {
          f.event({
            id: "old-idle",
            type: "session.idle",
            properties: { sessionID: "ses_lifecycle" },
          });
        }
        await vi.waitFor(() => expect(mocks.acquire).toHaveBeenCalledTimes(serverExit ? 2 : 1));
        await f.session.startTurn("new", config);
        rejectOld(new Error("late transport rejection"));
        await expect(oldRequest).resolves.toBeUndefined();
        f.event({
          id: "new-idle",
          type: "session.idle",
          properties: { sessionID: "ses_lifecycle" },
        });
        expect(f.events.filter((event) => event.type === "turn.completed")).toHaveLength(2);
        expect(f.events.at(-1)).toMatchObject({ type: "turn.completed", state: "completed" });
      } finally {
        await f.session.dispose();
      }
    },
  );

  it("does not replay a completed prompt as an attachment fallback after an early idle", async () => {
    const f = await fixture();
    try {
      f.promptAsync.mockImplementationOnce(async () => {
        f.event({ id: "idle", type: "session.idle", properties: { sessionID: "ses_lifecycle" } });
        throw new Error("file part media type image/bmp functionality not supported");
      });
      await f.session.startTurn("inspect", config, [
        { kind: "attachment", path: "/tmp/fixture.bmp", mimeType: "image/bmp" },
      ]);
      expect(f.promptAsync).toHaveBeenCalledTimes(1);
      expect(f.events.filter((event) => event.type === "turn.completed")).toHaveLength(1);
    } finally {
      await f.session.dispose();
    }
  });
});
