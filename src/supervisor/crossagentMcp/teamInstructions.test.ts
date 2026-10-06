import { expect, it } from "vitest";
import { teamInstructions } from "./teamInstructions";

it("authorizes teamwork only for an opted-in thread with Crossagents available", () => {
  expect(teamInstructions({ model: "test", crossagentMcp: true })).toBeUndefined();
  expect(teamInstructions({ model: "test", teamMode: true, crossagentMcp: false })).toBeUndefined();
  expect(teamInstructions({ model: "test", teamMode: true, crossagentMcp: true })).toContain(
    "without asking for approval",
  );
});
