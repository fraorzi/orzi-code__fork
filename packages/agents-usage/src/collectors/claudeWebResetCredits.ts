import { z } from "zod";
import type { HostPort, OAuthToken } from "../host";
import type { UsageResetCredits, UsageResetRequest, UsageResetResult } from "../types";
import { parseClaudeResetCredits } from "./claudeResetCredits";
import { parseRetryAfter } from "../formatters";

const WEB_ORIGIN = "https://claude.ai";
const OAUTH_PROFILE = "https://api.anthropic.com/api/oauth/profile";
const profileSchema = z.object({ organization: z.object({ uuid: z.string().uuid() }) });
const organizationsSchema = z.array(z.object({ uuid: z.string().uuid() }));

type WebContext =
  | { status: "ready"; cookie: string; organizationId: string }
  | {
      status: "blocked";
      outcome: "auth-required" | "account-mismatch" | "rate-limited" | "unavailable";
      rateLimitedUntil?: number;
    };

function throttleDeadline(headers: Record<string, string>, now: number): number {
  return parseRetryAfter(headers["retry-after"] ?? headers["Retry-After"], now) ?? now + 5 * 60_000;
}
interface WebInventory {
  resetCredits: UsageResetCredits;
  rateLimitedUntil?: number;
}

/** A separately consented web session must belong to the same organization as the CLI. */
async function webContext(host: HostPort, token: OAuthToken): Promise<WebContext> {
  const cookie = await host.credentials.getSecret("claude", "cookie");
  if (!cookie) return { status: "blocked", outcome: "auth-required" };
  try {
    const profile = await host.http.request({
      url: OAUTH_PROFILE,
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "anthropic-beta": "oauth-2025-04-20",
        Accept: "application/json",
      },
      timeoutMs: 10_000,
    });
    if (profile.status === 429)
      return {
        status: "blocked",
        outcome: "rate-limited",
        rateLimitedUntil: throttleDeadline(profile.headers, host.now()),
      };
    if (profile.status !== 200) return { status: "blocked", outcome: "auth-required" };
    const parsed = profileSchema.safeParse(JSON.parse(profile.body));
    if (!parsed.success) return { status: "blocked", outcome: "unavailable" };
    const organizations = await host.http.request({
      url: `${WEB_ORIGIN}/api/organizations`,
      redirect: "error",
      headers: { Cookie: cookie, Accept: "application/json" },
      timeoutMs: 10_000,
    });
    if (organizations.status === 429)
      return {
        status: "blocked",
        outcome: "rate-limited",
        rateLimitedUntil: throttleDeadline(organizations.headers, host.now()),
      };
    if (organizations.status !== 200) return { status: "blocked", outcome: "auth-required" };
    const list = organizationsSchema.safeParse(JSON.parse(organizations.body));
    if (!list.success) return { status: "blocked", outcome: "unavailable" };
    if (!list.data.some((org) => org.uuid === parsed.data.organization.uuid))
      return { status: "blocked", outcome: "account-mismatch" };
    return { status: "ready", cookie, organizationId: parsed.data.organization.uuid };
  } catch {
    return { status: "blocked", outcome: "unavailable" };
  }
}

async function readInventory(
  host: HostPort,
  context: Extract<WebContext, { status: "ready" }>,
): Promise<WebInventory> {
  const response = await host.http.request({
    url: `${WEB_ORIGIN}/api/organizations/${encodeURIComponent(context.organizationId)}/usage?cedar_ember=1&at_wall=1`,
    redirect: "error",
    headers: { Cookie: context.cookie, Accept: "application/json" },
    timeoutMs: 10_000,
  });
  if (response.status === 429)
    return {
      resetCredits: { status: "unknown", reason: "unavailable" },
      rateLimitedUntil: throttleDeadline(response.headers, host.now()),
    };
  if (response.status !== 200)
    return { resetCredits: { status: "unknown", reason: "unavailable" } };
  return { resetCredits: parseClaudeResetCredits(JSON.parse(response.body), host.now()) };
}

export async function readClaudeWebResetCredits(
  host: HostPort,
  token: OAuthToken,
): Promise<WebInventory> {
  const context = await webContext(host, token);
  if (context.status === "blocked")
    return {
      resetCredits: {
        status: "unknown",
        reason: context.outcome === "account-mismatch" ? "account-mismatch" : "web-only",
      },
      ...(context.rateLimitedUntil ? { rateLimitedUntil: context.rateLimitedUntil } : {}),
    };
  try {
    return await readInventory(host, context);
  } catch {
    return { resetCredits: { status: "unknown", reason: "unavailable" } };
  }
}

const consumeResponse = z.object({ result: z.string() });

/** Revalidate identity and grant immediately before one explicit, non-retried redemption. */
export async function consumeClaudeResetCredit(
  host: HostPort,
  request: UsageResetRequest,
): Promise<UsageResetResult> {
  const token = await host.credentials.getOAuthToken("claude");
  if (!token) return { outcome: "auth-required" };
  const context = await webContext(host, token);
  if (context.status === "blocked") return { outcome: context.outcome };
  const inventory = await readInventory(host, context);
  if (inventory.rateLimitedUntil) return { outcome: "rate-limited" };
  if (
    inventory.resetCredits.status !== "known" ||
    !inventory.resetCredits.grants.some(
      (grant) => grant.id === request.grantId && grant.canActivate,
    )
  ) {
    return { outcome: "unavailable" };
  }
  const body =
    request.grantId === "juniper_tide"
      ? { program: "juniper_tide" }
      : { program: "cedar_ember", grant_id: request.grantId, request_id: request.requestId };
  try {
    const response = await host.http.request({
      method: "POST",
      url: `${WEB_ORIGIN}/api/organizations/${encodeURIComponent(context.organizationId)}/reset_rate_limits`,
      redirect: "error",
      headers: {
        Cookie: context.cookie,
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: WEB_ORIGIN,
      },
      body: JSON.stringify(body),
      timeoutMs: 25_000,
    });
    if (response.status === 401 || response.status === 403) return { outcome: "auth-required" };
    if (response.status === 429) return { outcome: "rate-limited" };
    if (response.status !== 200) return { outcome: "unknown" };
    const parsed = consumeResponse.safeParse(JSON.parse(response.body));
    if (!parsed.success) return { outcome: "unknown" };
    switch (parsed.data.result) {
      case "reset":
        return { outcome: "reset" };
      case "already_used":
        return { outcome: "already-redeemed" };
      case "not_limited":
        return { outcome: "nothing-to-reset" };
      default:
        return { outcome: "unavailable" };
    }
  } catch {
    return { outcome: "unknown" };
  }
}
