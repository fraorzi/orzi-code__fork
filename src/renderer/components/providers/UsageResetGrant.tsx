import { Button, Tooltip } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Check, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import type { UsageResetCredits } from "@poracode/agents-usage/types";
import { useUsageReset } from "./useUsageReset";

type Grant = Extract<UsageResetCredits, { status: "known" }>["grants"][number];

export function UsageResetGrant({
  grant,
  now,
  providerId,
}: {
  grant: Grant;
  now: number;
  providerId?: string;
}) {
  const { i18n, t } = useLingui();
  const reset = useUsageReset(providerId, grant.id);
  const remainingMs = grant.expiresAt === undefined ? Infinity : grant.expiresAt - now;
  const date =
    grant.expiresAt === undefined
      ? undefined
      : new Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium", timeStyle: "short" }).format(
          grant.expiresAt,
        );
  const success =
    reset.state.phase === "result" &&
    (reset.state.outcome === "reset" || reset.state.outcome === "already-redeemed");
  return (
    <div className="border-t border-[var(--separator)] py-2 first:border-0">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground">
            {grant.label ?? t`Reset`}
            {grant.remaining > 1 ? ` ×${grant.remaining}` : ""}
          </div>
          <div
            className={`mt-0.5 flex items-center gap-1 text-[11px] ${remainingMs <= 86400000 ? "text-danger" : remainingMs <= 3 * 86400000 ? "text-warning" : "text-muted"}`}
          >
            {remainingMs <= 3 * 86400000 ? <TriangleAlert className="size-3 shrink-0" /> : null}
            {date ? <Trans>Expires {date}</Trans> : <Trans>Expiry not reported</Trans>}
          </div>
        </div>
        {success ? (
          <Check className="size-4 text-success" aria-label={t`Reset applied`} />
        ) : providerId ? (
          <Tooltip>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="size-7 min-w-7 text-accent"
                aria-label={t`Use this reset`}
                isDisabled={!grant.canActivate || reset.state.phase === "pending"}
                onPress={() => reset.setState({ phase: "confirm" })}
              >
                {reset.state.phase === "pending" ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>
              {grant.canActivate
                ? t`Use this reset`
                : t`The provider has not enabled this reset yet.`}
            </Tooltip.Content>
          </Tooltip>
        ) : null}
      </div>
      {grant.description ? (
        <p className="mt-1 text-[11px] text-muted">{grant.description}</p>
      ) : null}
      {reset.state.phase === "confirm" ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted">
            <Trans>Use this reset now? This cannot be undone.</Trans>
          </p>
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onPress={() => reset.setState({ phase: "idle" })}>
              <Trans>Cancel</Trans>
            </Button>
            <Button size="sm" variant="primary" onPress={() => void reset.submit()}>
              <Trans>Use reset</Trans>
            </Button>
          </div>
        </div>
      ) : null}
      {reset.state.phase === "result" ? (
        <p role="status" className={`mt-1 text-xs ${success ? "text-success" : "text-warning"}`}>
          {reset.outcomeText(reset.state.outcome)}
        </p>
      ) : null}
    </div>
  );
}
