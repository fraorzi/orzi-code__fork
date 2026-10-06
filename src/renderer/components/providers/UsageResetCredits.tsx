import { Button } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { UsageResetCredits as ResetCredits } from "@poracode/agents-usage/types";
import { openExternalWithFeedback } from "@/renderer/utils/openExternal";

export function UsageResetCredits({
  credits,
  now,
  allowNavigation = false,
}: {
  credits: ResetCredits;
  now: number;
  allowNavigation?: boolean;
}) {
  const { i18n } = useLingui();
  if (credits.status === "unknown") {
    return (
      <div className="space-y-0.5 text-[10px] text-muted">
        <div>
          {credits.reason === "web-only" ? (
            <Trans>Resets: check provider website</Trans>
          ) : (
            <Trans>Resets: no data</Trans>
          )}
        </div>
        {allowNavigation && credits.manageUrl && (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              if (credits.manageUrl) openExternalWithFeedback(credits.manageUrl);
            }}
          >
            <Trans>Open usage page</Trans>
          </Button>
        )}
      </div>
    );
  }
  const grants = credits.grants.filter(
    (grant) =>
      (grant.expiresAt === undefined || grant.expiresAt > now) &&
      (grant.startsAt === undefined || grant.startsAt <= now),
  );
  const count = grants.reduce((sum, grant) => sum + grant.remaining, 0);
  return (
    <div className="space-y-0.5 text-[10px] tabular-nums">
      <div className="font-medium">
        <Trans>Additional resets: {count}</Trans>
      </div>
      {grants.map((grant) => {
        const date =
          grant.expiresAt === undefined
            ? undefined
            : new Intl.DateTimeFormat(i18n.locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(grant.expiresAt);
        return (
          <div key={grant.id} className="text-muted">
            {grants.length > 1 ? `${grant.remaining}: ` : null}
            {date ? <Trans>Expires {date}</Trans> : <Trans>Expiry not reported</Trans>}
          </div>
        );
      })}
    </div>
  );
}
