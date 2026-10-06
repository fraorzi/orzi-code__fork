import { describe, expect, it } from "vitest";
import { normalizeSharedSettings } from "./settings";
import { allowsAutomaticAgentUpdate } from "./agentUpdateSettings";

describe("agent update preferences", () => {
  it("preserves pre-upgrade settings and defaults every agent to automatic updates", () => {
    const settings = normalizeSharedSettings({ automaticAgentUpdates: true, themeMode: "light" });
    expect(settings.automaticAgentUpdatesDisabled).toEqual([]);
    expect(settings.themeMode).toBe("light");
    expect(allowsAutomaticAgentUpdate(settings, "test-agent")).toBe(true);
  });

  it("shares update preferences across a provider's profiles", () => {
    const settings = normalizeSharedSettings({ automaticAgentUpdatesDisabled: ["claude"] });
    expect(allowsAutomaticAgentUpdate(settings, "claude:personal")).toBe(false);
    expect(allowsAutomaticAgentUpdate(settings, "codex")).toBe(true);
  });

  it("keeps independently installed generic ACP agents separate", () => {
    const settings = normalizeSharedSettings({
      automaticAgentUpdatesDisabled: ["acp-generic:one"],
    });
    expect(allowsAutomaticAgentUpdate(settings, "acp-generic:one")).toBe(false);
    expect(allowsAutomaticAgentUpdate(settings, "acp-generic:two")).toBe(true);
  });

  it("keeps the global switch authoritative without clearing per-agent preferences", () => {
    const settings = normalizeSharedSettings({
      automaticAgentUpdates: false,
      automaticAgentUpdatesDisabled: ["test-agent"],
    });
    expect(allowsAutomaticAgentUpdate(settings, "another-agent")).toBe(false);
    expect(settings.automaticAgentUpdatesDisabled).toEqual(["test-agent"]);
  });
});
