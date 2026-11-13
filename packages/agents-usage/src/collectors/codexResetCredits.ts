import { z } from "zod";
import type { HostPort, OAuthToken } from "../host";
import { parseRetryAfter } from "../formatters";
import type { UsageResetCredits, UsageResetRequest, UsageResetResult } from "../types";
import { DEFAULT_CLIENT_VERSIONS } from "../clientVersions";

export const CODEX_RESET_CREDITS_ENDPOINT =
  "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
const responseSchema = z.object({
  credits: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().nullish(),
      description: z.string().nullish(),
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
        ...(credit.title ? { label: credit.title } : {}),
        ...(credit.description ? { description: credit.description } : {}),
        canActivate: true,
        ...(credit.granted_at ? { startsAt: Date.parse(credit.granted_at) } : {}),
        ...(credit.expires_at ? { expiresAt: Date.parse(credit.expires_at) } : {}),
      })),
  };
}

const consumeResponseSchema = z.object({
  code: z.enum(["reset", "already_redeemed", "nothing_to_reset", "no_credit"]),
});

/** Native backend contract used by Codex App Server. Never retry a POST. */
export async function consumeCodexResetCredit(
  host: HostPort,
  request: UsageResetRequest,
): Promise<UsageResetResult> {
  const token = await host.credentials.getOAuthToken("codex");
  if (!token) return { outcome: "auth-required" };
  const version = host.clientVersions?.codex ?? DEFAULT_CLIENT_VERSIONS.codex;
  const inventory = await readCodexResetCredits(host, token, version, host.now());
  if (inventory.rateLimitedUntil) return { outcome: "rate-limited" };
  if (
    inventory.resetCredits.status !== "known" ||
    !inventory.resetCredits.grants.some((grant) => grant.id === request.grantId)
  ) {
    return { outcome: "unavailable" };
  }
  try {
    const response = await host.http.request({
      method: "POST",
      url: `${CODEX_RESET_CREDITS_ENDPOINT}/consume`,
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": `codex-cli/${version}`,
        ...(token.accountId ? { "ChatGPT-Account-Id": token.accountId } : {}),
      },
      body: JSON.stringify({ redeem_request_id: request.requestId, credit_id: request.grantId }),
      timeoutMs: 25_000,
    });
    if (response.status === 401 || response.status === 403) return { outcome: "auth-required" };
    if (response.status === 429) return { outcome: "rate-limited" };
    if (response.status !== 200) return { outcome: "unknown" };
    const parsed = consumeResponseSchema.safeParse(JSON.parse(response.body));
    if (!parsed.success) return { outcome: "unknown" };
    switch (parsed.data.code) {
      case "reset":
        return { outcome: "reset" };
      case "already_redeemed":
        return { outcome: "already-redeemed" };
      case "nothing_to_reset":
        return { outcome: "nothing-to-reset" };
      case "no_credit":
        return { outcome: "unavailable" };
    }
  } catch {
    return { outcome: "unknown" };
  }
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
      redirect: "error",
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
