import { Trans, useLingui } from "@lingui/react/macro";
import type { AuxiliaryOperation, AuxiliaryUsageSummary } from "@/shared/auxiliaryUsage";
import { formatCompact } from "../format";

/** Explicit report coverage keeps missing provider telemetry distinct from zero spend. */
export function AuxiliaryUsage(props: { items: AuxiliaryUsageSummary[] | undefined }) {
  const { t, i18n } = useLingui();
  const labels: Record<AuxiliaryOperation, string> = {
    title: t`Thread titles`,
    commit: t`Commit messages`,
    pr: t`PR summaries`,
  };
  return (
    <section className="flex flex-col gap-1">
      <h2 className="mb-1 text-sm font-semibold text-foreground">
        <Trans>Utility generations</Trans>
      </h2>
      <p className="text-xs text-muted">
        <Trans>
          Reported tokens only, tracked separately from chat. Earlier generations are unavailable.
        </Trans>
      </p>
      {props.items === undefined ? (
        <p className="py-2 text-sm text-muted">
          <Trans>Utility usage is unavailable from this host.</Trans>
        </p>
      ) : props.items.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          <Trans>No utility generations recorded yet.</Trans>
        </p>
      ) : (
        <div className="divide-y divide-separator">
          {props.items.map((item) => (
            <div
              key={item.operation}
              className="flex items-center justify-between gap-4 py-2 text-sm"
            >
              <span className="font-medium text-foreground">{labels[item.operation]}</span>
              <div className="text-right tabular-nums">
                <div className="text-foreground">
                  <Trans>Runs: {item.runs}</Trans>
                  {item.failedRuns > 0 ? (
                    <span className="text-muted">
                      {" "}
                      - <Trans>Failed: {item.failedRuns}</Trans>
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-muted">
                  {item.reportedTokens === undefined ? (
                    <Trans>Tokens not reported</Trans>
                  ) : (
                    <>
                      <Trans>{formatCompact(item.reportedTokens)} reported tokens</Trans> -{" "}
                      <Trans>
                        Runs with reports: {item.runsWithTokenReports}/{item.runs}
                      </Trans>
                    </>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {item.reportedCostUsd === undefined ? (
                    <Trans>Cost not reported</Trans>
                  ) : (
                    <>
                      <Trans>
                        {new Intl.NumberFormat(i18n.locale, {
                          style: "currency",
                          currency: "USD",
                          maximumSignificantDigits: 4,
                        }).format(item.reportedCostUsd)}{" "}
                        reported cost
                      </Trans>
                      {" - "}
                      <Trans>
                        Runs with cost reports: {item.runsWithCostReports}/{item.runs}
                      </Trans>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">
        <Trans>Reported cost is not subscription billing.</Trans>
      </p>
    </section>
  );
}
