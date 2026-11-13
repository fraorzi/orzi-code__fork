import { expect, it } from "vitest";
import { usageRecovery } from "./usageRecovery";

it.each([
  "You've hit your limit \u00b7 resets 2pm (Europe/Warsaw)",
  "You've hit your 5-hour limit · resets 8:50pm (Europe/Warsaw)",
  "You've hit your weekly limit",
  "rate_limit_error",
])("recognizes account quota failure: %s", (message) => {
  expect(usageRecovery.isLimitError(message)).toBe(true);
});

it.each(["Authentication failed", "Connection closed", "Tool execution failed"])(
  "does not retry unrelated failures: %s",
  (message) => {
    expect(usageRecovery.isLimitError(message)).toBe(false);
  },
);

it("selects only the current model's additional weekly pool", () => {
  expect(usageRecovery.windowIds({ model: "claude-sonnet-5-5" })).toContain("weekly-sonnet");
  expect(usageRecovery.windowIds({ model: "claude-sonnet-5-5" })).not.toContain("weekly-opus");
});
