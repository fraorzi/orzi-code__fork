import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import type { RuntimeEvent } from "@/shared/contracts";
import type { StructuredSessionUpdate } from "../../base";
import { MuseMspStructuredSession } from "./session";

const mocks = vi.hoisted(() => ({
  request: vi.fn<(method: string) => Promise<Record<string, unknown>>>(),
}));
let notify: (method: string, params: Record<string, unknown>) => void = () => {};
vi.mock("@/shared/processTree", () => ({ terminateChildProcessTree: () => {} }));
vi.mock("./client", () => ({
  spawnMuseServeHost: async () => ({
    child: new EventEmitter(),
    transport: {},
    hostCookie: "fixture",
  }),
  MuseMspClient: class {
    initialize = async () => ({ schema: { version: 1, fingerprint: "fixture" } });
    request = mocks.request;
    dispose() {}
    onError() {}
    onServerRequest() {}
    onNotification(handler: typeof notify) {
      notify = handler;
    }
  },
}));

it.each(["completed", "failed", "cancelled"])(
  "ignores stale %s completion while a newer turn is streaming",
  async (terminal) => {
    mocks.request.mockImplementation(async (method) =>
      method === "session/start"
        ? { session: { sessionId: "session-lifecycle", activeTurnId: null } }
        : { status: "accepted" },
    );
    const config = { model: "fixture-model" };
    const session = await MuseMspStructuredSession.create({
      threadId: "thread-lifecycle",
      projectLocation: { kind: "posix", path: "/repo" },
      presentationMode: "gui",
      config,
    });
    const events: RuntimeEvent[] = [];
    const updates: StructuredSessionUpdate[] = [];
    session.setListener({
      onClose() {},
      onError() {},
      onRuntimeEvent: (event) => events.push(event),
      onUpdate: (update) => updates.push(update),
    });
    try {
      await session.activate();
      await session.openThread(config);
      const sessionId = "session-lifecycle";
      notify("turn/started", { sessionId, turnId: "old-turn" });
      notify("turn/started", { sessionId, turnId: "new-turn" });
      notify("item/started", {
        sessionId,
        item: { itemId: "new-answer", kind: "agentMessage", status: "inProgress", text: "" },
      });
      notify("item/delta", {
        sessionId,
        itemId: "new-answer",
        field: "text",
        delta: "Still working",
      });
      notify("turn/completed", {
        sessionId,
        turnId: "old-turn",
        terminal,
        error: { message: "Old failure" },
      });
      expect(updates.at(-1)?.status).toBe("working");
      expect(events.filter((event) => event.type === "turn.completed")).toEqual([]);
      expect(events).not.toContainEqual(
        expect.objectContaining({ type: "item.completed", itemId: "new-answer" }),
      );
      expect(events.filter((event) => event.type === "error")).toEqual([]);
      notify("turn/completed", { sessionId, turnId: "new-turn", terminal: "completed" });
      expect(updates.at(-1)?.status).toBe("idle");
      expect(events).toContainEqual(
        expect.objectContaining({ type: "turn.completed", turnId: "new-turn", state: "completed" }),
      );
      notify("turn/completed", {
        sessionId,
        turnId: "old-turn",
        terminal,
        error: { message: "Old failure" },
      });
      expect(events.filter((event) => event.type === "error")).toEqual([]);
      expect(events.filter((event) => event.type === "turn.completed")).toHaveLength(1);
    } finally {
      await session.dispose();
    }
  },
);
