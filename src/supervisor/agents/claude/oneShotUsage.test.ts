import { describe, expect, it } from "vitest";
import { parseClaudeOneShotOutput } from "./oneShotUsage";

const aggregate = {
  input_tokens: 10,
  output_tokens: 5,
  cache_read_input_tokens: 30,
  cache_creation_input_tokens: 20,
};

describe("parseClaudeOneShotOutput", () => {
  it("counts model usage once even when aggregate usage repeats it", () => {
    const result = parseClaudeOneShotOutput(
      JSON.stringify({
        type: "result",
        result: "A title",
        usage: aggregate,
        total_cost_usd: 0.05,
        modelUsage: {
          fast: {
            inputTokens: 10,
            outputTokens: 5,
            cacheReadInputTokens: 30,
            cacheCreationInputTokens: 20,
            costUSD: 0.05,
          },
          fallback: {
            inputTokens: 1,
            outputTokens: 2,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
            costUSD: 0,
          },
        },
      }),
    );
    expect(result).toEqual({
      text: "A title",
      usage: [
        { model: "fast", totalTokens: 65, costUsd: 0.05 },
        { model: "fallback", totalTokens: 3, costUsd: 0 },
      ],
    });
  });

  it("falls back to aggregate usage when model reports are incomplete", () => {
    expect(
      parseClaudeOneShotOutput(
        JSON.stringify({
          type: "result",
          result: "text",
          usage: aggregate,
          modelUsage: { unknown: {} },
          total_cost_usd: 0,
        }),
      ),
    ).toEqual({ text: "text", usage: [{ totalTokens: 65, costUsd: 0 }] });
  });

  it("retains aggregate cost without duplicating partially reported model costs", () => {
    expect(
      parseClaudeOneShotOutput(
        JSON.stringify({
          type: "result",
          result: "text",
          total_cost_usd: 0.5,
          modelUsage: {
            first: {
              inputTokens: 1,
              outputTokens: 2,
              cacheReadInputTokens: 0,
              cacheCreationInputTokens: 0,
              costUSD: 0.1,
            },
            second: {
              inputTokens: 3,
              outputTokens: 4,
              cacheReadInputTokens: 0,
              cacheCreationInputTokens: 0,
            },
          },
        }),
      ),
    ).toEqual({
      text: "text",
      usage: [
        { model: "first", totalTokens: 3 },
        { model: "second", totalTokens: 7 },
        { costUsd: 0.5 },
      ],
    });
  });

  it("keeps missing and partial tokens unknown, including cost-only reports", () => {
    expect(parseClaudeOneShotOutput('{"type":"result","result":"text"}')).toEqual({ text: "text" });
    expect(
      parseClaudeOneShotOutput(
        JSON.stringify({
          type: "result",
          result: "text",
          usage: { input_tokens: 12 },
          total_cost_usd: 0.1,
        }),
      ),
    ).toEqual({ text: "text", usage: [{ costUsd: 0.1 }] });
  });

  it("preserves measured zero and error-result usage", () => {
    expect(
      parseClaudeOneShotOutput(
        JSON.stringify({
          type: "result",
          is_error: true,
          errors: ["rate limited"],
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        }),
      ),
    ).toEqual({ text: "", usage: [{ totalTokens: 0 }], error: "rate limited" });
  });

  it("rejects malformed output without inventing consumption", () => {
    expect(() => parseClaudeOneShotOutput("not json")).toThrow(/Unexpected|JSON/);
    expect(() => parseClaudeOneShotOutput('{"type":"system"}')).toThrow(/result/);
  });
});
