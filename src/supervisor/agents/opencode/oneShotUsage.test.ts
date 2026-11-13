import { describe, expect, it } from "vitest";
import { readOpenCodeOneShotUsage } from "./oneShotUsage";

describe("readOpenCodeOneShotUsage", () => {
  it("prefers authoritative total without double counting its buckets", () => {
    expect(
      readOpenCodeOneShotUsage({
        modelID: "model",
        cost: 0,
        tokens: {
          total: 50,
          input: 10,
          output: 5,
          reasoning: 4,
          cache: { read: 20, write: 10 },
        },
      }),
    ).toEqual({ model: "model", totalTokens: 50, costUsd: 0 });
  });

  it("requires complete buckets when total is absent", () => {
    expect(readOpenCodeOneShotUsage({ tokens: { input: 10 } })).toBeUndefined();
    expect(
      readOpenCodeOneShotUsage({
        tokens: { input: 10, output: 5, reasoning: 4, cache: { read: 20, write: 10 } },
      }),
    ).toEqual({ totalTokens: 49 });
  });

  it("distinguishes zero, unavailable and cost-only reports", () => {
    expect(readOpenCodeOneShotUsage({ tokens: { total: 0 } })).toEqual({ totalTokens: 0 });
    expect(readOpenCodeOneShotUsage({})).toBeUndefined();
    expect(readOpenCodeOneShotUsage({ cost: 0.25 })).toEqual({ costUsd: 0.25 });
    expect(readOpenCodeOneShotUsage({ tokens: { total: -1 } })).toBeUndefined();
  });
});
