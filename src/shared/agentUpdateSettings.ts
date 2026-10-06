import { parseAgentProfileKind } from "./contracts";
import type { SharedSettings } from "./settings";

/** Profiles share the provider's installed binaries and update preference. */
export function agentUpdateOwner(agentKind: string): string {
  return parseAgentProfileKind(agentKind)?.driver ?? agentKind;
}

export function allowsAutomaticAgentUpdate(
  settings: Pick<SharedSettings, "automaticAgentUpdates" | "automaticAgentUpdatesDisabled">,
  agentKind: string,
): boolean {
  return (
    settings.automaticAgentUpdates &&
    !settings.automaticAgentUpdatesDisabled.includes(agentUpdateOwner(agentKind))
  );
}
