import { describe, expect, it } from "vitest";
import { isThreadConfigEqual, threadConfigSchema } from "./config";

describe("thread execution environment", () => {
  it("keeps pre-recovery configs valid and defaults automatic sending to opt-out", () => {
    expect(threadConfigSchema.parse({ model: "model" }).autoResumeAfterLimit).toBeUndefined();
    expect(
      threadConfigSchema.parse({ model: "model", autoResumeAfterLimit: true }).autoResumeAfterLimit,
    ).toBe(true);
    expect(
      isThreadConfigEqual({ model: "model" }, { model: "model", autoResumeAfterLimit: true }),
    ).toBe(false);
  });

  it("persists a selected WSL distro", () => {
    expect(
      threadConfigSchema.parse({
        model: "model",
        executionEnvironment: { kind: "wsl", distro: "Ubuntu" },
      }),
    ).toEqual({
      model: "model",
      executionEnvironment: { kind: "wsl", distro: "Ubuntu" },
    });
  });

  it("treats a distro change as a config change", () => {
    expect(
      isThreadConfigEqual(
        { model: "model", executionEnvironment: { kind: "wsl", distro: "Ubuntu" } },
        { model: "model", executionEnvironment: { kind: "wsl", distro: "Debian" } },
      ),
    ).toBe(false);
  });
});
