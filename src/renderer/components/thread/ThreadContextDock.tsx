import { Gauge, X } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { CSSProperties } from "react";
import { AnimatedNumber } from "@/renderer/components/common/AnimatedNumber";
import { ThreadDockHeader, ThreadDockIconButton, ThreadDockSection } from "./ThreadDockUI";
import type { ThreadContextUsageSummary } from "./threadContextUsage";
import { ThreadTaskUsageDetails } from "./ThreadTaskUsageDetails";

export function ThreadContextDock({
  summary,
  onClose,
}: {
  summary: ThreadContextUsageSummary;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const usageStyle = {
    "--lc-context-progress": `${summary.percent ?? 0}%`,
  } as CSSProperties;
  // The percentage rolls in place as the thread streams. `%` stays outside the
  // animated element so locales that lead with the sign (Turkish) can move it.
  const countLabel =
    summary.percent === undefined ? (
      t`Usage unknown`
    ) : (
      <Trans>
        <AnimatedNumber value={summary.percent} />% Full
      </Trans>
    );
  const tone = resolveContextUsageTone(summary);
  const fillClassName =
    tone === "danger"
      ? "poracode-context-dock__bar-fill poracode-context-dock__bar-fill--danger"
      : tone === "warning"
        ? "poracode-context-dock__bar-fill poracode-context-dock__bar-fill--warning"
        : "poracode-context-dock__bar-fill";

  return (
    <ThreadDockSection ariaLabel={t`Thread context usage`} placement="composer" collapsed={false}>
      <ThreadDockHeader
        icon={Gauge}
        title={t`Context`}
        countLabel={countLabel}
        actions={
          <ThreadDockIconButton label={t`Close usage details`} danger onPress={onClose}>
            <X className="size-3.5" />
          </ThreadDockIconButton>
        }
      />
      <div className="flex flex-col gap-2 px-3 pb-2">
        <div className="flex items-center justify-between gap-3 text-xs text-foreground-muted">
          <span>
            <Trans>{summary.usedLabel} used</Trans>
          </span>
          <span>
            <Trans>{summary.maxLabel} limit</Trans>
          </span>
        </div>
        <div className="poracode-context-dock__bar" style={usageStyle} aria-hidden="true">
          <div className={fillClassName} />
        </div>
        {summary.autoCompactThreshold ? (
          <p className="text-xs text-foreground-muted">
            <Trans>Auto-compact at {summary.autoCompactThreshold.toLocaleString()} tokens</Trans>
          </p>
        ) : null}
        {summary.breakdown.length > 0 ? (
          <ul className="grid gap-1">
            {summary.breakdown
              .filter((entry) => !entry.kind || entry.kind === "used")
              .map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 rounded px-1 py-0.5 text-xs"
                >
                  <span className="min-w-0 truncate text-foreground">{entry.label}</span>
                  <span className="shrink-0 tabular-nums text-foreground-muted">
                    {entry.tokens.toLocaleString()}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-xs text-foreground-muted">
            <Trans>Provider has not reported token usage.</Trans>
          </p>
        )}
        {summary.breakdown.some((entry) => entry.kind === "deferred") ? (
          <div className="border-t border-border pt-2 text-xs text-foreground-muted">
            <p className="mb-1">
              <Trans>Tools loaded on demand (outside context)</Trans>
            </p>
            <ul className="grid gap-1">
              {summary.breakdown
                .filter((entry) => entry.kind === "deferred")
                .map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-4">
                    <span>{entry.label}</span>
                    <span className="tabular-nums">{entry.tokens.toLocaleString()}</span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
        {summary.taskUsage ? (
          <ThreadTaskUsageDetails
            usage={summary.taskUsage}
            {...(summary.usedTokens !== undefined ? { usedTokens: summary.usedTokens } : {})}
          />
        ) : null}
      </div>
    </ThreadDockSection>
  );
}

function resolveContextUsageTone(
  summary: ThreadContextUsageSummary,
): "default" | "warning" | "danger" {
  const percent = summary.percent;
  const used = summary.usedTokens;
  if (percent !== undefined && percent >= 90) return "danger";
  if ((percent !== undefined && percent >= 60) || (used !== undefined && used >= 300_000)) {
    return "warning";
  }
  return "default";
}
