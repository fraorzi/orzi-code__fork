import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: vi.fn<typeof actual.readFileSync>(actual.readFileSync) };
});
import { claudeHeadlessEnvironment } from "./headlessEnvironment";
import { createClaudeAdapter } from "./index";

describe("Claude headless client identity", () => {
  let configDir: string;
  beforeEach(() => {
    configDir = fs.mkdtempSync(join(tmpdir(), "orzi-claude-env-"));
    vi.stubEnv("CLAUDE_CONFIG_DIR", configDir);
    vi.stubEnv("CLAUDE_CODE_ENTRYPOINT", "sdk-ts");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(configDir, { recursive: true, force: true });
  });
  it("replaces an inherited host label without mutating the host or profile", () => {
    const overrides = { ANTHROPIC_BASE_URL: "http://localhost:1234", OTHER: "kept" };
    expect(claudeHeadlessEnvironment(undefined, overrides)).toEqual({
      ...overrides,
      CLAUDE_CODE_ENTRYPOINT: "orzi-code",
    });
    expect(overrides).not.toHaveProperty("CLAUDE_CODE_ENTRYPOINT");
    expect(process.env.CLAUDE_CODE_ENTRYPOINT).toBe("sdk-ts");
  });
  it("respects explicit profile identity and then the profile settings override", () => {
    expect(
      claudeHeadlessEnvironment(undefined, { CLAUDE_CODE_ENTRYPOINT: "profile" })
        .CLAUDE_CODE_ENTRYPOINT,
    ).toBe("profile");
    fs.writeFileSync(
      join(configDir, "settings.json"),
      JSON.stringify({
        env: { CLAUDE_CODE_ENTRYPOINT: "configured", UNRELATED_SECRET: "not copied" },
      }),
    );
    expect(
      claudeHeadlessEnvironment(undefined, {
        CLAUDE_CONFIG_DIR: configDir,
        CLAUDE_CODE_ENTRYPOINT: "profile",
      }),
    ).toEqual({ CLAUDE_CONFIG_DIR: configDir, CLAUDE_CODE_ENTRYPOINT: "configured" });
  });
  it("does not rewrite malformed settings and rereads edits on a later launch", () => {
    const file = join(configDir, "settings.json");
    fs.writeFileSync(file, "{");
    expect(claudeHeadlessEnvironment().CLAUDE_CODE_ENTRYPOINT).toBe("orzi-code");
    expect(fs.readFileSync(file, "utf8")).toBe("{");
    fs.writeFileSync(file, JSON.stringify({ env: { CLAUDE_CODE_ENTRYPOINT: "updated" } }));
    expect(claudeHeadlessEnvironment().CLAUDE_CODE_ENTRYPOINT).toBe("updated");
  });
  it("reads WSL profile settings from its distro, not the Windows host", () => {
    const read = vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        env: { CLAUDE_CODE_ENTRYPOINT: "linux-profile" },
      }),
    );
    expect(
      claudeHeadlessEnvironment(
        {
          kind: "wsl",
          distro: "Ubuntu",
          linuxPath: "/repo",
          uncPath: "\\\\wsl.localhost\\Ubuntu\\repo",
        },
        { CLAUDE_CONFIG_DIR: "/home/demo/.profile" },
      ).CLAUDE_CODE_ENTRYPOINT,
    ).toBe("linux-profile");
    expect(read).toHaveBeenCalledWith(
      "\\\\wsl.localhost\\Ubuntu\\home\\demo\\.profile\\settings.json",
      "utf8",
    );
  });
  it("labels print/extraction calls while preserving interactive launch and resume", () => {
    const adapter = createClaudeAdapter();
    const location = { kind: "posix", path: configDir } as const;
    expect(
      adapter.buildOneShotCommand?.("haiku", "low", "title", location)?.env?.CLAUDE_CODE_ENTRYPOINT,
    ).toBe("orzi-code");
    expect(
      adapter.buildTextOnlyOneShotCommand?.("haiku", "low", "title", location)?.env
        ?.CLAUDE_CODE_ENTRYPOINT,
    ).toBe("orzi-code");
    const ref = { providerSessionId: "session", discoveredAt: "2026-11-11T00:00:00Z" };
    expect(
      adapter.buildContextExtractionCommand?.(ref, location)?.env?.CLAUDE_CODE_ENTRYPOINT,
    ).toBe("orzi-code");
    expect(adapter.buildLaunchArgv(location, { model: "haiku" }, "hello").env).not.toHaveProperty(
      "CLAUDE_CODE_ENTRYPOINT",
    );
    expect(
      adapter.buildResumeArgv(location, { model: "haiku" }, "hello", ref).env,
    ).not.toHaveProperty("CLAUDE_CODE_ENTRYPOINT");
  });
});
