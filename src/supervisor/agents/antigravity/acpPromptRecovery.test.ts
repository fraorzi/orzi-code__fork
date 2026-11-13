import type { SessionNotification } from "@agentclientprotocol/sdk";
import { describe, expect, it, vi } from "vitest";
import { AcpPromptRecovery } from "../acp/promptRecovery";
import { classifyAntigravityPromptFailure } from "./acpPromptRecovery";

const failure = "Agent execution error: trajectory converted to zero chat messages";
const mcpFailure =
  'The MCP server \'figma\' failed to initialize: calling "initialize": sending "initialize": Unauthorized. Fix the MCP server, or remove it from your configuration and start a new session, to continue.';
const quotaFailure =
  "Usage Limit Reached\n\nYou have reached your current quota for this period. Your limit will reset in 4 days, 11 hours.";
const message = (text: string): SessionNotification => ({
  sessionId: "session-1",
  update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
});

function setup() {
  const forward = vi.fn<(notification: SessionNotification) => void>();
  return { forward, recovery: new AcpPromptRecovery(classifyAntigravityPromptFailure, forward) };
}

describe("Antigravity empty trajectory recovery", () => {
  it("retries the observed assistant-text failure once and streams the real reply", async () => {
    const { recovery, forward } = setup();
    const send = vi.fn<() => Promise<{ stopReason: string }>>(async () => {
      recovery.accept(message(send.mock.calls.length === 1 ? failure : "OK"));
      return { stopReason: "end_turn" };
    });
    await recovery.run(send, () => true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(forward.mock.calls).toEqual([[message("OK")]]);
  });

  it("recognizes every possible split of the diagnostic", async () => {
    for (let i = 1; i < failure.length; i++) {
      const { recovery, forward } = setup();
      const send = vi.fn<() => Promise<{ stopReason: string }>>(async () => {
        if (send.mock.calls.length === 1) {
          recovery.accept(message(failure.slice(0, i)));
          recovery.accept(message(failure.slice(i)));
        }
        return { stopReason: "end_turn" };
      });
      await recovery.run(send, () => true);
      expect(send).toHaveBeenCalledTimes(2);
      expect(forward).not.toHaveBeenCalled();
    }
  });

  it("fails visibly after the second rejection instead of looping or completing successfully", async () => {
    const { recovery, forward } = setup();
    const send = vi.fn<() => Promise<{ stopReason: string }>>(async () => {
      recovery.accept(message(failure));
      return { stopReason: "end_turn" };
    });
    await expect(recovery.run(send, () => true)).rejects.toThrow(failure);
    expect(send).toHaveBeenCalledTimes(2);
    expect(forward).not.toHaveBeenCalled();
  });

  it.each(["cancelled", "max_tokens"])("does not retry stop reason %s", async (stopReason) => {
    const { recovery } = setup();
    const send = vi.fn<() => Promise<{ stopReason: string }>>(async () => {
      recovery.accept(message(failure));
      return { stopReason };
    });
    await recovery.run(send, () => true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("honors Stop or disposal before retry", async () => {
    const { recovery } = setup();
    const send = vi.fn<() => Promise<{ stopReason: string }>>(async () => {
      recovery.accept(message(failure));
      return { stopReason: "end_turn" };
    });
    await recovery.run(send, () => false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each(["reply", "thought", "tool", "request"])(
    "never replays work after %s activity",
    async (activity) => {
      const { recovery, forward } = setup();
      const send = vi.fn<() => Promise<{ stopReason: string }>>(async () => {
        if (activity === "request") recovery.markActivity();
        else
          recovery.accept(
            activity === "reply"
              ? message("Working")
              : {
                  sessionId: "session-1",
                  update:
                    activity === "thought"
                      ? {
                          sessionUpdate: "agent_thought_chunk",
                          content: { type: "text", text: "Thinking" },
                        }
                      : {
                          sessionUpdate: "tool_call",
                          toolCallId: "tool-1",
                          title: "Read",
                          status: "pending",
                        },
                },
          );
        recovery.accept(message(failure));
        return { stopReason: "end_turn" };
      });
      await expect(recovery.run(send, () => true)).rejects.toThrow(failure);
      expect(send).toHaveBeenCalledTimes(1);
      expect(forward).not.toHaveBeenCalledWith(message(failure));
    },
  );

  it("retries an exact RPC failure, but preserves unrelated transport errors", async () => {
    const { recovery } = setup();
    const send = vi
      .fn<() => Promise<{ stopReason: string }>>()
      .mockRejectedValueOnce(new Error(failure))
      .mockResolvedValueOnce({ stopReason: "end_turn" });
    await recovery.run(send, () => true);
    expect(send).toHaveBeenCalledTimes(2);
    const other = vi
      .fn<() => Promise<{ stopReason: string }>>()
      .mockRejectedValue(new Error("Unauthorized"));
    await expect(setup().recovery.run(other, () => true)).rejects.toThrow("Unauthorized");
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("flushes an ordinary response that happens to share the diagnostic prefix", async () => {
    const { recovery, forward } = setup();
    const send = async () => {
      recovery.accept(message("Agent execution "));
      recovery.accept(message("is complete"));
      return { stopReason: "end_turn" };
    };
    await recovery.run(send, () => true);
    expect(forward.mock.calls).toEqual([[message("Agent execution ")], [message("is complete")]]);
  });

  it("fails the observed MCP startup diagnostic without retrying a broken sign-in", async () => {
    const { recovery, forward } = setup();
    const send = vi.fn<() => Promise<{ stopReason: string }>>(async () => {
      recovery.accept(message(mcpFailure));
      return { stopReason: "end_turn" };
    });
    await expect(recovery.run(send, () => true)).rejects.toThrow(mcpFailure);
    expect(send).toHaveBeenCalledTimes(1);
    expect(forward).not.toHaveBeenCalled();
  });

  it("recognizes every split of the MCP startup diagnostic without retrying", async () => {
    for (let i = 1; i < mcpFailure.length; i++) {
      const { recovery, forward } = setup();
      const send = vi.fn<() => Promise<{ stopReason: string }>>(async () => {
        recovery.accept(message(mcpFailure.slice(0, i)));
        recovery.accept(message(mcpFailure.slice(i)));
        return { stopReason: "end_turn" };
      });
      await expect(recovery.run(send, () => true)).rejects.toThrow(mcpFailure);
      expect(send).toHaveBeenCalledTimes(1);
      expect(forward).not.toHaveBeenCalled();
    }
  });

  it("keeps ordinary prose with the MCP prefix visible", async () => {
    const { recovery, forward } = setup();
    const send = async () => {
      recovery.accept(message("The MCP server 'figma' "));
      recovery.accept(message("is connected."));
      return { stopReason: "end_turn" };
    };
    await recovery.run(send, () => true);
    expect(forward.mock.calls).toEqual([
      [message("The MCP server 'figma' ")],
      [message("is connected.")],
    ]);
  });

  it("keeps a failure explanation without the server diagnostic suffix visible", async () => {
    const { recovery, forward } = setup();
    const text = "The MCP server 'figma' failed to initialize: this happened yesterday.";
    const send = async () => {
      recovery.accept(message(text));
      return { stopReason: "end_turn" };
    };
    await recovery.run(send, () => true);
    expect(forward).toHaveBeenCalledWith(message(text));
  });

  it.each([
    quotaFailure,
    "Usage Limit Reached\n\nYou have reached your current quota for this period.",
    "Usage Limit Reached\n\nYou have reached your current quota for this period. Your limit will reset on Nov 12, 2026 10:15 UTC.",
  ])("fails a quota diagnostic without retrying: %s", async (text) => {
    const { recovery, forward } = setup();
    const send = vi.fn<() => Promise<{ stopReason: string }>>(async () => {
      recovery.accept(message(text));
      return { stopReason: "end_turn" };
    });
    await expect(recovery.run(send, () => true)).rejects.toThrow(text);
    expect(send).toHaveBeenCalledTimes(1);
    expect(forward).not.toHaveBeenCalled();
  });

  it("recognizes every split of the observed quota diagnostic without retrying", async () => {
    for (let i = 1; i < quotaFailure.length; i++) {
      const { recovery, forward } = setup();
      const send = vi.fn<() => Promise<{ stopReason: string }>>(async () => {
        recovery.accept(message(quotaFailure.slice(0, i)));
        recovery.accept(message(quotaFailure.slice(i)));
        return { stopReason: "end_turn" };
      });
      await expect(recovery.run(send, () => true)).rejects.toThrow(quotaFailure);
      expect(send).toHaveBeenCalledTimes(1);
      expect(forward).not.toHaveBeenCalled();
    }
  });

  it("keeps ordinary prose sharing the quota header visible", async () => {
    const { recovery, forward } = setup();
    const send = async () => {
      recovery.accept(message("Usage Limit "));
      recovery.accept(message("Reached is an error message from the service."));
      return { stopReason: "end_turn" };
    };
    await recovery.run(send, () => true);
    expect(forward.mock.calls).toEqual([
      [message("Usage Limit ")],
      [message("Reached is an error message from the service.")],
    ]);
  });
});
