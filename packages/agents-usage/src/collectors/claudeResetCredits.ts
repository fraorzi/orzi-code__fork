import { z } from "zod";
import type { UsageResetCredits } from "../types";

const timestamp = z.string().datetime({ offset: true }).nullish();
const responseSchema = z.object({
  cedar_ember: z
    .object({
      eligible: z.boolean(),
      ineligible_reason: z.string().nullish(),
      grants: z
        .array(
          z.object({
            id: z.string().min(1),
            resets_left: z.number().int().nonnegative(),
            starts_at: timestamp,
            ends_at: timestamp,
            paused: z.boolean().optional(),
          }),
        )
        .optional(),
    })
    .nullish(),
  juniper_tide: z
    .object({
      eligible: z.boolean(),
      ineligible_reason: z.string().nullish(),
      arm: z.string().nullish(),
      available: z.boolean().optional(),
      weekly_resets_at: timestamp,
    })
    .nullish(),
});

/** Null program blocks have not been evaluated. A surface restriction is not an empty inventory. */
export function parseClaudeResetCredits(body: unknown, now: number): UsageResetCredits {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return { status: "unknown", reason: "unavailable" };
  const { cedar_ember: cedar, juniper_tide: juniper } = parsed.data;
  if (cedar?.ineligible_reason === "surface" || juniper?.ineligible_reason === "surface") {
    return { status: "unknown", reason: "web-only", manageUrl: "https://claude.ai/settings/usage" };
  }
  if (cedar?.eligible && cedar.grants) {
    const grants = cedar.grants
      .filter(
        (grant) =>
          grant.resets_left > 0 &&
          !grant.paused &&
          (!grant.starts_at || Date.parse(grant.starts_at) <= now) &&
          (!grant.ends_at || Date.parse(grant.ends_at) > now),
      )
      .map((grant) => ({
        id: grant.id,
        remaining: grant.resets_left,
        ...(grant.starts_at ? { startsAt: Date.parse(grant.starts_at) } : {}),
        ...(grant.ends_at ? { expiresAt: Date.parse(grant.ends_at) } : {}),
      }));
    if (grants.length > 0) return { status: "known", grants };
  }
  if (juniper?.eligible && juniper.arm === "reset") {
    return {
      status: "known",
      grants: juniper.available
        ? [
            {
              id: "juniper_tide",
              remaining: 1,
              ...(juniper.weekly_resets_at
                ? { expiresAt: Date.parse(juniper.weekly_resets_at) }
                : {}),
            },
          ]
        : [],
    };
  }
  if (cedar?.eligible && cedar.grants) return { status: "known", grants: [] };
  return {
    status: "unknown",
    reason: "unavailable",
    manageUrl: "https://claude.ai/settings/usage",
  };
}
