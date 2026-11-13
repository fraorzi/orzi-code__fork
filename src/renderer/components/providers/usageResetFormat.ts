import type { UsageResetCredits } from "@poracode/agents-usage/types";

export function activeResetGrants(credits: UsageResetCredits | undefined, now: number) {
  return credits?.status === "known"
    ? credits.grants
        .filter(
          (grant) =>
            grant.remaining > 0 &&
            (grant.expiresAt === undefined || grant.expiresAt > now) &&
            (grant.startsAt === undefined || grant.startsAt <= now),
        )
        .toSorted((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity))
    : [];
}
