// Hallmark - component: saved resets; existing Orzi tokens; P5 H5 E4 S5 R5 V4.
import { useId, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Button, Popover, Tooltip } from "@heroui/react";
import { ChevronRight, CircleHelp, ClockAlert, KeyRound, RefreshCw } from "lucide-react";
import { formatResetCountdown } from "@poracode/agents-usage/formatters";
import { useProviderUsage } from "@/renderer/state/providerUsageStore";
import { ProviderIcon } from "./ProviderIcon";
import { getProviderManifest } from "./providerManifest";
import { UsageResetCredits } from "./UsageResetCredits";
import { activeResetGrants } from "./usageResetFormat";
import type { UsageProvider } from "./usageProviders";
import { refreshAndMergeProviderUsage } from "./refreshProviderUsageSnapshot";

function ProviderResets({ provider, now }: { provider: UsageProvider; now: number }) {
  const { t, i18n } = useLingui();
  const descriptionId = useId();
  const { label } = provider;
  const snapshot = useProviderUsage(provider.id);
  const manifest = getProviderManifest(provider.id);
  const grants = activeResetGrants(snapshot?.resetCredits, now);
  const count = grants.reduce((sum, grant) => sum + grant.remaining, 0);
  const expiresAt = grants[0]?.expiresAt;
  const urgent = expiresAt !== undefined && expiresAt - now <= 3 * 86400000;
  const stale = snapshot !== undefined && now - snapshot.fetchedAt > 15 * 60_000;
  return (
    <Popover>
      <Button
        variant="ghost"
        size="sm"
        className="flex h-7 min-h-7 w-full justify-start gap-1.5 rounded-md px-2 text-xs"
        aria-label={t`Saved resets for ${label}`}
        aria-describedby={descriptionId}
      >
        <ProviderIcon kind={provider.id} fallbackLabel={label} className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left font-normal">{label}</span>
        {stale ? <CircleHelp className="size-3 text-warning" aria-label={t`Stale data`} /> : null}
        {snapshot?.resetCredits?.status === "known" ? (
          <>
            <span className="font-mono tabular-nums text-foreground">{count}</span>
            {expiresAt !== undefined ? (
              <span
                className={`ml-1 flex items-center gap-1 font-mono text-[10px] tabular-nums ${expiresAt - now <= 86400000 ? "text-danger" : urgent ? "text-warning" : "text-muted"}`}
              >
                {urgent ? (
                  <ClockAlert className="size-3 shrink-0" aria-label={t`Use before expiry`} />
                ) : null}
                {urgent
                  ? formatResetCountdown(expiresAt, now)
                  : new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "short" }).format(
                      expiresAt,
                    )}
              </span>
            ) : null}
          </>
        ) : manifest?.kind === provider.id && manifest.usageResetBrowserLogin ? (
          <KeyRound className="size-3 text-muted" aria-label={t`Connect account`} />
        ) : (
          <CircleHelp className="size-3 text-muted" aria-label={t`No data yet`} />
        )}
        <ChevronRight className="size-3 shrink-0 text-muted" />
        <span id={descriptionId} className="sr-only">
          {snapshot?.resetCredits?.status === "known" ? (
            <Trans>Additional resets: {count}</Trans>
          ) : (
            t`No data yet`
          )}
        </span>
      </Button>
      <Popover.Content placement="top start" className="w-72 max-w-[calc(100vw-1rem)]">
        <Popover.Dialog className="p-3">
          <Popover.Heading className="mb-2 flex items-center gap-2 text-sm font-medium">
            <ProviderIcon kind={provider.id} fallbackLabel={label} className="size-4" />
            {label}
            {snapshot?.resetCredits?.status === "known" ? (
              <span className="ml-auto text-xs text-muted">{count}</span>
            ) : null}
          </Popover.Heading>
          {stale ? <p className="mb-2 text-xs text-warning">{t`Stale data`}</p> : null}
          <UsageResetCredits
            credits={snapshot?.resetCredits ?? { status: "unknown", reason: "unavailable" }}
            now={now}
            allowNavigation
            providerId={provider.id}
            {...(manifest?.usageResetUrl ? { manageUrl: manifest.usageResetUrl } : {})}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** One compact row per account. Inventory and confirmation stay in its popover. */
export function ProviderResetCreditsSection({
  providers,
  now,
}: {
  providers: readonly UsageProvider[];
  now: number;
}) {
  const { t } = useLingui();
  const [refreshing, setRefreshing] = useState(false);
  const resetProviders = providers.filter(
    (provider) => getProviderManifest(provider.id)?.usageResetUrl,
  );
  if (!resetProviders.length) return null;
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all(
        resetProviders.map((provider) => refreshAndMergeProviderUsage(provider.id)),
      );
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <section aria-label={t`Saved resets`} className="border-t border-[var(--separator)] px-2 py-1">
      <div className="flex h-6 items-center justify-between px-2 text-[11px] text-muted">
        <span>
          <Trans>Saved resets</Trans>
        </span>
        <Tooltip>
          <Tooltip.Trigger>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="size-5 min-w-5 text-muted"
              aria-label={t`Refresh resets`}
              isDisabled={refreshing}
              onPress={() => void refresh()}
            >
              <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>{t`Refresh resets`}</Tooltip.Content>
        </Tooltip>
      </div>
      {resetProviders.map((provider) => (
        <ProviderResets key={provider.id} provider={provider} now={now} />
      ))}
    </section>
  );
}
