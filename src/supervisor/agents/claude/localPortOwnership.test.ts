import { expect, it, vi } from "vitest";
import { createClaudeProfileAdapter } from "./index";
import { ClaudeSdkSession } from "./sdkSession";

it("preserves runtime process ownership alongside the profile environment", async () => {
  const create = vi.spyOn(ClaudeSdkSession, "create");
  try {
    const adapter = createClaudeProfileAdapter({
      id: "work",
      driver: "claude",
      config: { configDir: "/profiles/work" },
    });
    await adapter.createStructuredSession?.({
      threadId: "ownership-fixture",
      projectLocation: { kind: "posix", path: "/fixture" },
      config: { model: "fixture" },
      presentationMode: "gui",
      env: { PORACODE_PROCESS_OWNER: "owned-fixture", CLAUDE_CONFIG_DIR: "/ignored" },
    });
    expect(create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        env: expect.objectContaining({
          PORACODE_PROCESS_OWNER: "owned-fixture",
          CLAUDE_CONFIG_DIR: "/profiles/work",
        }),
      }),
    );
  } finally {
    create.mockRestore();
  }
});
