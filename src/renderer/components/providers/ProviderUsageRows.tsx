import { UsageResetCredits } from "./UsageResetCredits";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { formatResetCountdown, usageWindowDisplayLabel } from "@poracode/agents-usage/formatters";
import { useProviderUsage } from "@/renderer/state/providerUsageStore";
import { openUsagePanel } from "@/renderer/actions/panelActions";
import { ProviderIcon } from "./ProviderIcon";
import { usageStatusText } from "./usageFormat";
import { usageToneColor } from "./usageTone";
import type { UsageProvider } from "./usageProviders";

function ProviderUsageRow({ provider, now }: { provider: UsageProvider; now: number }) {
  const { t } = useLingui();
  const snapshot = useProviderUsage(provider.id);
  const stale = snapshot !== undefined && now - snapshot.fetchedAt > 15 * 60_000;
  return (
    <Button
      variant="ghost"
      className="h-auto w-full justify-start rounded-md px-2 py-1.5 text-left"
      onPress={() => openUsagePanel()}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5 text-xs">
          <ProviderIcon
            kind={provider.id}
            fallbackLabel={provider.label}
            className="size-3.5 shrink-0"
          />
          <span className="min-w-0 flex-1 truncate font-medium">{provider.label}</span>
          {stale && <span className="text-[10px] text-warning">{t`Stale data`}</span>}
        </div>
        {snapshot?.status === "ok" && snapshot.windows.length > 0 ? (
          snapshot.windows.map((window) => {
            const remaining = Math.max(0, Math.min(100, 100 - window.usedPercent));
            return (
              <div key={window.id} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums">
                  <span className="min-w-0 truncate text-muted">
                    {usageWindowDisplayLabel(window)}
                  </span>
                  <span className="shrink-0">{Math.round(remaining)}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-default">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${remaining}%`,
                      backgroundColor: usageToneColor(window.usedPercent),
                    }}
                  />
                </div>
                {window.resetsAt !== undefined && (
                  <div className="text-right text-[10px] text-muted">
                    {formatResetCountdown(window.resetsAt, now)}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-[10px] text-muted">
            {usageStatusText(snapshot, provider.label, provider.id, now)}
          </div>
        )}
        {snapshot?.resetCredits && <UsageResetCredits credits={snapshot.resetCredits} now={now} />}
      </div>
    </Button>
  );
}

export function ProviderUsageRows({ providers }: { providers: readonly UsageProvider[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="max-h-64 overflow-y-auto border-t border-[var(--hairline)] pt-2">
      <div className="px-2 pb-1 text-[10px] font-medium text-muted">
        <Trans>Remaining limits</Trans>
      </div>
      {providers.map((provider) => (
        <ProviderUsageRow key={provider.id} provider={provider} now={now} />
      ))}
    </div>
  );
}
