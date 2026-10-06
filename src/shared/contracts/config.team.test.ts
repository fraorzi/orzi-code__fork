import { describe, expect, it } from "vitest";
import { isThreadConfigEqual, projectDraftConfigSchema, threadConfigSchema } from "./config";

describe("optional team mode compatibility", () => {
  it("keeps previous thread and draft configs valid without enabling teamwork", () => {
    expect(
      threadConfigSchema.parse({ model: "existing", crossagentMcp: true }).teamMode,
    ).toBeUndefined();
    expect(
      projectDraftConfigSchema.parse({ agentKind: "codex", model: "existing" }).teamMode,
    ).toBeUndefined();
  });

  it("preserves the opt-in and notices changes to it", () => {
    expect(threadConfigSchema.parse({ model: "existing", teamMode: true }).teamMode).toBe(true);
    expect(isThreadConfigEqual({ model: "existing" }, { model: "existing", teamMode: true })).toBe(
      false,
    );
  });
});
