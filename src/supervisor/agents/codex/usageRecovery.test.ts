import { expect, it } from "vitest";
import { usageRecovery } from "./usageRecovery";

it.each([
  "You've hit your usage limit. Visit https://chatgpt.com/codex/settings/usage to purchase more credits.",
  "usage_limit_reached",
])("recognizes account quota failure: %s", (message) => {
  expect(usageRecovery.isLimitError(message)).toBe(true);
});

it.each(["Authentication failed", "Connection closed", "Tool execution failed"])(
  "does not retry unrelated failures: %s",
  (message) => {
    expect(usageRecovery.isLimitError(message)).toBe(false);
  },
);
