import { it, expect, vi } from "vitest";
import type { RuntimeEvent } from "@/shared/contracts";
import { createAcpStructuredSession } from "../acp/sessionFactory";
import { classifyAntigravityPromptFailure } from "./acpPromptRecovery";
import { usageRecovery } from "./usageRecovery";

// A real stdio child reproduces the server's observed wire behavior. It also
// rejects a changed/duplicated prompt, so recovery must resend the full input.
const server = String.raw`
const { createInterface } = require("node:readline");
let prompts = 0;
let original;
const initialFailure = process.argv[1] ?? "Agent execution error: trajectory converted to zero chat messages";
const send = (data) => process.stdout.write(JSON.stringify(data) + "\n");
createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  let result = {};
  if (request.method === "initialize") result = { protocolVersion: 1, agentCapabilities: {} };
  if (request.method === "session/new") result = { sessionId: "fixture-session" };
  if (request.method === "session/prompt") {
    prompts++;
    const input = JSON.stringify(request.params.prompt);
    if (prompts === 1) original = input;
    const text = prompts === 1
      ? initialFailure
      : prompts === 2 && input === original ? "RECOVERED_ORIGINAL_PROMPT" : "FOLLOW_UP_OK";
    send({ jsonrpc: "2.0", method: "session/update", params: {
      sessionId: "fixture-session", update: {
        sessionUpdate: "agent_message_chunk", content: { type: "text", text }
      }
    }});
    result = { stopReason: "end_turn" };
  }
  if (request.id !== undefined) send({ jsonrpc: "2.0", id: request.id, result });
});
`;

it.each([false, true])(
  "handles first-prompt ACP stdio with recovery enabled=%s",
  async (enabled) => {
    const session = createAcpStructuredSession(
      { command: process.execPath, args: ["-e", server] },
      {
        threadId: "recovery-wire-test",
        projectLocation: { kind: "posix", path: process.cwd() },
        config: { model: "" },
        presentationMode: "gui",
      },
      enabled ? { promptFailureClassifier: classifyAntigravityPromptFailure } : {},
    );
    if (!session) throw new Error("Expected a GUI structured session");
    const events: RuntimeEvent[] = [];
    const onError = vi.fn<(message: string) => void>();
    session.setListener({
      onClose: vi.fn<() => void>(),
      onError,
      onUpdate: vi.fn<() => void>(),
      onRuntimeEvent: (event) => events.push(event),
    });
    try {
      await session.activate();
      await session.openThread({ model: "" });
      await session.startTurn("Original user task", { model: "" }, undefined, {
        inlineInstructions: "Keep these original instructions too.",
      });
      await session.startTurn("Follow-up", { model: "" });
      const text = JSON.stringify(events);
      expect(text.includes("RECOVERED_ORIGINAL_PROMPT")).toBe(enabled);
      expect(
        text.includes("Agent execution error: trajectory converted to zero chat messages"),
      ).toBe(!enabled);
      expect(text).toContain("FOLLOW_UP_OK");
      expect(
        events.filter(
          (event) => event.type === "item.started" && event.itemType === "user_message",
        ),
      ).toHaveLength(2);
      expect(
        events.filter((event) => event.type === "turn.completed" && event.state === "completed"),
      ).toHaveLength(2);
      expect(events.filter((event) => event.type === "error")).toEqual([]);
      expect(onError).not.toHaveBeenCalled();
    } finally {
      await session.dispose();
    }
  },
);

it.each([
  {
    label: "MCP startup",
    failure:
      'The MCP server \'figma\' failed to initialize: calling "initialize": sending "initialize": Unauthorized. Fix the MCP server, or remove it from your configuration and start a new session, to continue.',
  },
  {
    label: "quota",
    failure:
      "Usage Limit Reached\n\nYou have reached your current quota for this period. Your limit will reset in 4 days, 11 hours.",
  },
])(
  "fails a streamed $label error through ACP stdio without replaying the prompt",
  async ({ failure, label }) => {
    const session = createAcpStructuredSession(
      { command: process.execPath, args: ["-e", server, failure] },
      {
        threadId: "fatal-diagnostic-wire-test",
        projectLocation: { kind: "posix", path: process.cwd() },
        config: { model: "" },
        presentationMode: "gui",
      },
      { promptFailureClassifier: classifyAntigravityPromptFailure },
    );
    if (!session) throw new Error("Expected a GUI structured session");
    const events: RuntimeEvent[] = [];
    session.setListener({
      onClose: vi.fn<() => void>(),
      onError: vi.fn<(message: string) => void>(),
      onUpdate: vi.fn<() => void>(),
      onRuntimeEvent: (event) => events.push(event),
    });
    try {
      await session.activate();
      await session.openThread({ model: "" });
      await session.startTurn("Original user task", { model: "" });
      expect(events.filter((event) => event.type === "error")).toEqual([
        { type: "error", threadId: "fatal-diagnostic-wire-test", message: failure },
      ]);
      expect(
        events
          .filter((event) => event.type === "error")
          .map((event) => usageRecovery.isLimitError(event.message)),
      ).toEqual([label === "quota"]);
      expect(
        events.filter((event) => event.type === "turn.completed").map((event) => event.state),
      ).toEqual(["failed"]);
      expect(
        events.filter(
          (event) => event.type === "item.started" && event.itemType === "assistant_message",
        ),
      ).toEqual([]);
      expect(JSON.stringify(events)).not.toContain("RECOVERED_ORIGINAL_PROMPT");
    } finally {
      await session.dispose();
    }
  },
);
