import { Trans, useLingui } from "@lingui/react/macro";
import type { TaskTokenUsage } from "@/shared/contracts";

export function ThreadTaskUsageDetails({
  usage,
  usedTokens,
}: {
  usage: TaskTokenUsage;
  usedTokens?: number;
}) {
  const { t } = useLingui();
  const rows: [string, number][] = [
    [t`Model calls`, usage.calls],
    [t`Uncached input`, usage.inputTokens],
    [t`Output (including reasoning)`, usage.outputTokens],
    [t`Cache read`, usage.cacheReadTokens],
    [t`Cache write`, usage.cacheWriteTokens],
    [
      t`Processed tokens`,
      usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens,
    ],
  ];
  if (usedTokens !== undefined && usage.contextTokensAtStart !== undefined) {
    rows.push([t`Context change`, usedTokens - usage.contextTokensAtStart]);
  }
  return (
    <div className="border-t border-border pt-2" data-testid="thread-task-usage">
      <p className="mb-1 text-xs font-medium">
        <Trans>Current / last task</Trans>
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-foreground-muted">{label}</dt>
            <dd className="tabular-nums">{value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-foreground-muted">
        <Trans>
          Processed tokens are not subscription usage. Account limits are shown in the sidebar.
        </Trans>
      </p>
    </div>
  );
}
