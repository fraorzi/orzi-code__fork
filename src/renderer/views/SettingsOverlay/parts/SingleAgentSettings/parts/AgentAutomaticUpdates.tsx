import { Trans, useLingui } from "@lingui/react/macro";
import { ToggleSwitch } from "@/renderer/components/common";
import { useSharedSettings } from "@/renderer/state/sharedSettingsStore";
import { allowsAutomaticAgentUpdate } from "@/shared/agentUpdateSettings";
import { SettingRow } from "../../SettingsForm";

export function AgentAutomaticUpdates({ agentKind }: { agentKind: string }) {
  const { t } = useLingui();
  const automaticAgentUpdates = useSharedSettings((s) => s.automaticAgentUpdates);
  const automaticAgentUpdatesDisabled = useSharedSettings((s) => s.automaticAgentUpdatesDisabled);
  const setAgentAutomaticUpdates = useSharedSettings((s) => s.setAgentAutomaticUpdates);
  return (
    <SettingRow
      title={t`Automatic agent updates`}
      description={
        automaticAgentUpdates ? (
          <Trans>
            Install updates for this agent automatically. Applies to all of its profiles and
            runtimes.
          </Trans>
        ) : (
          <Trans>Enable automatic agent updates in General settings first.</Trans>
        )
      }
    >
      <ToggleSwitch
        aria-label={t`Automatic agent updates`}
        isSelected={allowsAutomaticAgentUpdate(
          { automaticAgentUpdates, automaticAgentUpdatesDisabled },
          agentKind,
        )}
        isDisabled={!automaticAgentUpdates}
        onChange={(enabled) => setAgentAutomaticUpdates(agentKind, enabled)}
      />
    </SettingRow>
  );
}
