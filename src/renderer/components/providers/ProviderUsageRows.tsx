// Modified for the orzi-code__fork personal fork by Franciszek Orzechowski on 2026-10-06.
import { UsageResetCredits } from "./UsageResetCredits";
import { useEffect, useState } from "react";
import { ChevronUp, Gauge } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  formatResetCountdown,
  usageTone,
  usageWindowDisplayLabel,
} from "@poracode/agents-usage/formatters";
import { useProviderUsage } from "@/renderer/state/providerUsageStore";
import { useSidebarUiStore } from "@/renderer/state/sidebarUiStore";
import { openUsagePanel } from "@/renderer/actions/panelActions";
import { ProviderIcon } from "./ProviderIcon";
import { usageStatusText } from "./usageFormat";
import { usageToneColor } from "./usageTone";
import type { UsageProvider } from "./usageProviders";

/** Muted at rest; amber / red only when a window runs low. */
function remainingTextColor(usedPercent: number): string {
  return usageTone(usedPercent) === "normal" ? "var(--muted)" : usageToneColor(usedPercent);
}

function ProviderUsageChip({ provider }: { provider: UsageProvider }) {
  const snapshot = useProviderUsage(provider.id);
  if (snapshot?.status !== "ok" || snapshot.windows.length === 0) return null;
  const mostUsed = Math.max(...snapshot.windows.map((window) => window.usedPercent));
  const remaining = Math.max(0, Math.min(100, 100 - mostUsed));
  return (
    <span className="inline-flex items-center gap-1">
      <ProviderIcon kind={provider.id} fallbackLabel={provider.label} className="size-3.5" />
      <span style={{ color: remainingTextColor(mostUsed) }}>{Math.round(remaining)}%</span>
    </span>
  );
}

function ProviderUsageDetail({ provider, now }: { provider: UsageProvider; now: number }) {
  const { t } = useLingui();
  const snapshot = useProviderUsage(provider.id);
  const stale = snapshot !== undefined && now - snapshot.fetchedAt > 15 * 60_000;
  return (
    <button
      type="button"
      className="block w-full rounded-[6px] px-2 py-1.5 text-left outline-none transition-colors hover:bg-[var(--row-hover)] focus-visible:focus-ring"
      onClick={() => openUsagePanel()}
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
        <ProviderIcon kind={provider.id} fallbackLabel={provider.label} className="size-3.5" />
        <span className="min-w-0 flex-1 truncate">{provider.label}</span>
        {stale ? (
          <span className="text-[10px] font-normal text-warning">{t`Stale data`}</span>
        ) : snapshot?.plan ? (
          <span className="text-[10.5px] font-normal text-muted/70">{snapshot.plan}</span>
        ) : null}
      </div>
      {snapshot?.status === "ok" && snapshot.windows.length > 0 ? (
        snapshot.windows.map((window) => {
          const remaining = Math.max(0, Math.min(100, 100 - window.usedPercent));
          return (
            <div
              key={window.id}
              className="grid h-[18px] grid-cols-[minmax(0,72px)_minmax(0,1fr)_32px_44px] items-center gap-1.5 text-[11px] text-muted/70"
            >
              <span className="truncate">{usageWindowDisplayLabel(window)}</span>
              <span className="h-[3px] overflow-hidden rounded-full bg-[var(--row-active)]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${remaining}%`,
                    backgroundColor:
                      usageTone(window.usedPercent) === "normal"
                        ? "var(--muted)"
                        : usageToneColor(window.usedPercent),
                  }}
                />
              </span>
              <span className="text-right font-mono text-foreground">{Math.round(remaining)}%</span>
              <span className="truncate text-right font-mono">
                {window.resetsAt !== undefined ? formatResetCountdown(window.resetsAt, now) : ""}
              </span>
            </div>
          );
        })
      ) : (
        <div className="text-[11px] text-muted/70">
          {usageStatusText(snapshot, provider.label, provider.id, now)}
        </div>
      )}
      {snapshot?.resetCredits && <UsageResetCredits credits={snapshot.resetCredits} now={now} />}
    </button>
  );
}

export function ProviderUsageRows({ providers }: { providers: readonly UsageProvider[] }) {
  const { t } = useLingui();
  const expanded = useSidebarUiStore((s) => s.limitsExpanded);
  const toggleExpanded = useSidebarUiStore((s) => s.toggleLimitsExpanded);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="-mx-2 shrink-0 border-t border-[var(--separator)] px-2 py-1.5">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? t`Collapse limits` : t`Expand limits`}
        className="flex h-7 w-full items-center gap-2 rounded-[6px] px-2 text-[13px] text-muted outline-none transition-colors hover:bg-[var(--row-hover)] hover:text-foreground focus-visible:focus-ring"
        onClick={toggleExpanded}
      >
        <Gauge className="size-4 shrink-0" />
        <span>
          <Trans>Limits</Trans>
        </span>
        {expanded ? null : (
          <span className="ml-auto flex min-w-0 items-center gap-2.5 overflow-hidden font-mono text-[11px]">
            {providers.map((provider) => (
              <ProviderUsageChip key={provider.id} provider={provider} />
            ))}
          </span>
        )}
        <ChevronUp
          className={`size-3.5 shrink-0 transition-transform ${expanded ? "ml-auto rotate-180" : ""}`}
        />
      </button>
      {expanded ? (
        <div className="max-h-64 overflow-y-auto pt-1">
          {providers.map((provider) => (
            <ProviderUsageDetail key={provider.id} provider={provider} now={now} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
