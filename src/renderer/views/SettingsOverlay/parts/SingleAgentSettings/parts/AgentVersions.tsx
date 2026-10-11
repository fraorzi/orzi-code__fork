import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Input } from "@/renderer/components/common";
import { readBridge } from "@/renderer/bridge";
import {
  exactAgentVersionSchema,
  type AgentVersionsState,
  type ManageAgentVersionPayload,
} from "@/shared/contracts";
import { SettingRow } from "../../SettingsForm";

export function AgentVersions({ agentKind }: { agentKind: string }) {
  const { t } = useLingui();
  const [state, setState] = useState<AgentVersionsState>({ supported: false });
  const [version, setVersion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void readBridge()
      .getAgentVersions({ agentKind })
      .then((result) => {
        if (active) setState(result);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [agentKind]);
  if (!state.supported) return null;

  const run = async (payload: ManageAgentVersionPayload) => {
    setPending(true);
    setError(null);
    try {
      const result = await readBridge().manageAgentVersion(payload);
      setState(result.state);
      if (!result.ok) setError(result.error ?? t`Unable to change the runtime version.`);
    } catch {
      setError(t`Unable to change the runtime version.`);
    } finally {
      setPending(false);
    }
  };
  return (
    <div data-agent-versions>
      <SettingRow
        title={t`Runtime version`}
        description={
          <Trans>
            Install and pin an exact CLI version in the app's own folder. Native profiles share it.
            Automatic updates stay paused while pinned. Active sessions must close before switching.
            The system installation and login are preserved.
          </Trans>
        }
      >
        <span className="text-sm text-muted">
          {state.active ? t`Pinned: ${state.active}` : t`System installation`}
        </span>
      </SettingRow>
      <div className="flex flex-wrap items-center gap-2 py-2">
        <Input
          className="w-36"
          aria-label={t`Exact CLI version`}
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          disabled={pending || Boolean(state.error)}
        />
        <Button
          size="sm"
          variant="secondary"
          isDisabled={
            pending || Boolean(state.error) || !exactAgentVersionSchema.safeParse(version).success
          }
          onPress={() => void run({ agentKind, action: "install", version })}
        >
          <Trans>Install and pin</Trans>
        </Button>
        {state.previous && (
          <Button
            size="sm"
            variant="secondary"
            isDisabled={pending || Boolean(state.error)}
            onPress={() => void run({ agentKind, action: "rollback" })}
          >
            <Trans>Restore {state.previous}</Trans>
          </Button>
        )}
        {state.active && (
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={pending || Boolean(state.error)}
            onPress={() => void run({ agentKind, action: "system" })}
          >
            <Trans>Use system installation</Trans>
          </Button>
        )}
      </div>
      {pending && (
        <p role="status" className="text-sm text-muted">
          <Trans>Verifying the runtime...</Trans>
        </p>
      )}
      {(error || state.error) && (
        <p role="alert" className="text-sm text-danger">
          {error || state.error}
        </p>
      )}
    </div>
  );
}
