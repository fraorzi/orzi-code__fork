import { describe, expect, it } from "vitest";
import type { SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk";
import { ClaudeTaskUsageTracker } from "./taskUsage";

function message(id: string, output: number, parent: string | null = null): SDKAssistantMessage {
  return {
    type: "assistant",
    uuid: id,
    session_id: "session",
    parent_tool_use_id: parent,
    message: {
      id,
      usage: {
        input_tokens: 10,
        output_tokens: output,
        cache_read_input_tokens: 1000,
        cache_creation_input_tokens: 50,
      },
    },
  } as unknown as SDKAssistantMessage;
}

describe("Claude task consumption", () => {
  it("counts API calls once across content blocks, updated output and replay, including children", () => {
    const tracker = new ClaudeTaskUsageTracker();
    tracker.begin("turn-1");
    tracker.setContextBaseline("turn-1", 25_000);
    tracker.record(message("call-1", 20));
    tracker.record(message("call-1", 40));
    tracker.record(message("call-1", 20));
    tracker.record(message("child-call", 30, "parent-tool"));
    expect(tracker.snapshot()).toEqual({
      turnId: "turn-1",
      calls: 2,
      inputTokens: 20,
      outputTokens: 70,
      cacheReadTokens: 2000,
      cacheWriteTokens: 100,
      contextTokensAtStart: 25_000,
    });
  });

  it("resets the current task without carrying a previous task's totals or stale baseline", () => {
    const tracker = new ClaudeTaskUsageTracker();
    tracker.begin("first");
    tracker.record(message("call", 100));
    tracker.begin("second");
    tracker.setContextBaseline("first", 90_000);
    expect(tracker.snapshot()).toEqual({
      turnId: "second",
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
  });
});
