import { expect, it } from "vitest";
import { usageRecovery } from "./usageRecovery";

it.each(["You have hit your usage limit.", "rate_limit_exceeded"])(
  "recognizes account quota failure: %s",
  (message) => {
    expect(usageRecovery.isLimitError(message)).toBe(true);
  },
);

it.each(["Authentication failed", "Connection closed", "Tool execution failed"])(
  "does not retry unrelated failures: %s",
  (message) => {
    expect(usageRecovery.isLimitError(message)).toBe(false);
  },
);
