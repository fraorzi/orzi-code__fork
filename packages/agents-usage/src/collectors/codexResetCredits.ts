import { z } from "zod";
import type { HostPort, OAuthToken } from "../host";
import { parseRetryAfter } from "../formatters";
import type { UsageResetCredits } from "../types";

export const CODEX_RESET_CREDITS_ENDPOINT =
  "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
const responseSchema = z.object({
  credits: z.array(
    z.object({
      id: z.string().min(1),
      status: z.enum(["available", "redeemed", "expired", "redeeming"]),
      is_supported_by_plan: z.boolean(),
      granted_at: z.string().datetime({ offset: true }).nullish(),
      expires_at: z.string().datetime({ offset: true }).nullish(),
    }),
  ),
});

export function parseCodexResetCredits(body: unknown, now: number): UsageResetCredits {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return { status: "unknown", reason: "unavailable" };
  return {
    status: "known",
    grants: parsed.data.credits
      .filter(
        (credit) =>
          credit.status === "available" &&
          credit.is_supported_by_plan &&
          (!credit.granted_at || Date.parse(credit.granted_at) <= now) &&
          (!credit.expires_at || Date.parse(credit.expires_at) > now),
      )
      .map((credit) => ({
        id: credit.id,
        remaining: 1,
        ...(credit.granted_at ? { startsAt: Date.parse(credit.granted_at) } : {}),
        ...(credit.expires_at ? { expiresAt: Date.parse(credit.expires_at) } : {}),
      })),
  };
}

/** Same OAuth identity as usage. Read-only: never invokes the redemption endpoint. */
export async function readCodexResetCredits(
  host: HostPort,
  token: OAuthToken,
  version: string,
  now: number,
): Promise<{
  resetCredits: UsageResetCredits;
  rateLimitedUntil?: number;
}> {
  try {
    const response = await host.http.request({
      method: "GET",
      url: CODEX_RESET_CREDITS_ENDPOINT,
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: "application/json",
        "User-Agent": `codex-cli/${version}`,
        ...(token.accountId ? { "ChatGPT-Account-Id": token.accountId } : {}),
      },
      timeoutMs: 10_000,
    });
    if (response.status === 429) {
      return {
        resetCredits: { status: "unknown", reason: "unavailable" },
        rateLimitedUntil:
          parseRetryAfter(
            response.headers["retry-after"] ?? response.headers["Retry-After"],
            now,
          ) ?? now + 5 * 60_000,
      };
    }
    if (response.status !== 200)
      return { resetCredits: { status: "unknown", reason: "unavailable" } };
    return { resetCredits: parseCodexResetCredits(JSON.parse(response.body), now) };
  } catch {
    return { resetCredits: { status: "unknown", reason: "unavailable" } };
  }
}
