import { expect, it } from "vitest";
import { usageRecovery } from "./usageRecovery";

it.each([
  "Individual quota reached. Resets in 1h33m48s.",
  "Rate limit exceeded (HTTP 429)",
  "Usage Limit Reached\n\nYou have reached your current quota for this period. Your limit will reset in 4 days, 11 hours.",
  "Usage Limit Reached\n\nYou have reached your current quota for this period.",
])("recognizes account quota failure: %s", (message) => {
  expect(usageRecovery.isLimitError(message)).toBe(true);
});

it.each([
  "Authentication failed",
  "Connection closed",
  "Tool execution failed",
  "Usage Limit Reached is an error message from the service.",
])("does not retry unrelated failures: %s", (message) => {
  expect(usageRecovery.isLimitError(message)).toBe(false);
});

it("keeps model groups separate and supports the legacy pool", () => {
  expect(usageRecovery.windowIds({ model: "gemini-3-pro" })).toEqual([
    "antigravity:gemini:session-5h",
    "antigravity:gemini:weekly",
    "antigravity:gemini-pro",
  ]);
  expect(usageRecovery.windowIds({ model: "claude-sonnet-5-5" })).toEqual([
    "antigravity:claude:session-5h",
    "antigravity:claude:weekly",
    "antigravity:claude",
  ]);
});
