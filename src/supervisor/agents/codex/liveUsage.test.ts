import { describe, expect, it } from "vitest";
import { normalizeCodexLiveUsage } from "./liveUsage";

describe("Codex live account usage", () => {
  it("normalizes the installed app-server window format and duration", () => {
    expect(
      normalizeCodexLiveUsage(
        {
          rateLimits: {
            limitId: "codex",
            planType: "plus",
            primary: { usedPercent: 38, windowDurationMins: 10_080, resetsAt: 1_800_000_000 },
            secondary: null,
          },
        },
        123,
      ),
    ).toEqual({
      providerId: "codex",
      status: "ok",
      plan: "ChatGPT Plus",
      windows: [
        {
          id: "weekly",
          label: "Weekly",
          unit: "percent",
          usedPercent: 38,
          resetsAt: 1_800_000_000_000,
        },
      ],
      fetchedAt: 123,
    });
  });
  it("ignores malformed or metadata-only rolling updates", () => {
    expect(
      normalizeCodexLiveUsage({ rateLimits: { primary: null, secondary: null } }, 123),
    ).toBeUndefined();
    expect(
      normalizeCodexLiveUsage({ rateLimits: { primary: { usedPercent: "30" } } }, 123),
    ).toBeUndefined();
  });
});
