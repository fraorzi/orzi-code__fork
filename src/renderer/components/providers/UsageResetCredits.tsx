import { Button } from "@heroui/react";
import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { UsageResetCredits as ResetCredits } from "@poracode/agents-usage/types";
import { KeyRound, PanelTop } from "lucide-react";
import { readBridge, isRemoteSession } from "@/renderer/bridge";
import { friendlyError } from "@/shared/messages";
import { useHasStoredSession } from "@/renderer/state/usageLoginStateStore";
import { UsageResetGrant } from "./UsageResetGrant";
import { useUsageProviderLogin } from "./useUsageProviderLogin";
import { getProviderManifest } from "./providerManifest";
import { activeResetGrants } from "./usageResetFormat";

export function UsageResetCredits({
  credits,
  now,
  allowNavigation = false,
  manageUrl,
  providerId,
}: {
  credits: ResetCredits;
  now: number;
  allowNavigation?: boolean;
  manageUrl?: string;
  providerId?: string;
}) {
  const { t } = useLingui();
  const [error, setError] = useState<string>();
  const login = useUsageProviderLogin(providerId ?? "");
  const hasStoredSession = useHasStoredSession(providerId ?? "");
  const manifest = providerId ? getProviderManifest(providerId) : undefined;
  // Profile aliases do not inherit the base account's mutation or login route.
  const nativeProviderId = manifest?.kind === providerId ? providerId : undefined;
  const browserLogin = nativeProviderId && manifest?.usageResetBrowserLogin && !isRemoteSession();
  const openUsage = async () => {
    if (!manageUrl) return;
    await readBridge().browserCreateTab({ url: manageUrl, activate: true, reveal: true });
  };
  if (credits.status === "unknown")
    return (
      <div className="space-y-2 text-xs text-muted">
        <p>
          {credits.reason === "account-mismatch"
            ? t`Connect the same account used by your agent.`
            : browserLogin
              ? hasStoredSession
                ? t`Account connected, but saved resets could not be read. Try refreshing or open usage in Orzi.`
                : t`Connect your account to view and activate saved resets here.`
              : t`Reset availability could not be read. Try refreshing.`}
        </p>
        {browserLogin ? (
          <Button
            size="sm"
            variant="secondary"
            isDisabled={login.signingIn}
            onPress={() => {
              setError(undefined);
              void login
                .handleSignIn()
                .then((outcome) => {
                  if (!outcome.ok && outcome.error) setError(friendlyError(outcome.error));
                })
                .catch((cause) => setError(friendlyError(cause)));
            }}
          >
            <KeyRound className="size-3.5" />
            {hasStoredSession ? <Trans>Reconnect account</Trans> : <Trans>Connect account</Trans>}
          </Button>
        ) : null}
        {allowNavigation && manageUrl && !isRemoteSession() ? (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setError(undefined);
              void openUsage().catch((cause) => setError(friendlyError(cause)));
            }}
          >
            <PanelTop className="size-3.5" />
            <Trans>Open usage in Orzi</Trans>
          </Button>
        ) : null}
        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  const grants = activeResetGrants(credits, now);
  if (!grants.length)
    return (
      <p className="text-xs text-muted">
        <Trans>No saved resets</Trans>
      </p>
    );
  return (
    <div>
      {grants.map((grant) => (
        <UsageResetGrant
          key={grant.id}
          grant={grant}
          now={now}
          {...(nativeProviderId ? { providerId: nativeProviderId } : {})}
        />
      ))}
    </div>
  );
}
