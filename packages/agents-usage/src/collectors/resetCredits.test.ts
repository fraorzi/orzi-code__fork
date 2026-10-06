import { describe, expect, it } from "vitest";
import { parseClaudeResetCredits } from "./claudeResetCredits";
import {
  CODEX_RESET_CREDITS_ENDPOINT,
  parseCodexResetCredits,
  readCodexResetCredits,
} from "./codexResetCredits";
import { createFakeHost } from "../testHost";
import { usageSnapshotSchema } from "../types";
import type { HttpRequest } from "../host";

const now = Date.parse("2026-10-05T12:00:00Z");
const expiry = "2026-10-29T16:33:01.591499Z";
const credit = {
  id: "credit",
  status: "available",
  is_supported_by_plan: true,
  granted_at: "2026-09-29T16:33:01.591499Z",
  expires_at: expiry,
};

describe("saved reset inventory", () => {
  it("reads the observed Codex credit shape and exact expiry", () => {
    expect(parseCodexResetCredits({ credits: [credit], available_count: 1 }, now)).toEqual({
      status: "known",
      grants: [
        {
          id: "credit",
          remaining: 1,
          startsAt: Date.parse(credit.granted_at),
          expiresAt: Date.parse(expiry),
        },
      ],
    });
  });

  it("excludes redeemed, expired, future and unsupported-plan credits", () => {
    expect(
      parseCodexResetCredits(
        {
          credits: [
            { ...credit, status: "redeemed" },
            { ...credit, expires_at: "2026-10-01T00:00:00Z" },
            { ...credit, granted_at: "2026-11-01T00:00:00Z" },
            { ...credit, is_supported_by_plan: false },
          ],
        },
        now,
      ),
    ).toEqual({ status: "known", grants: [] });
  });

  it("distinguishes missing or malformed data from a confirmed empty inventory", () => {
    expect(parseCodexResetCredits({}, now).status).toBe("unknown");
    expect(
      parseCodexResetCredits({ credits: [{ ...credit, expires_at: "bad date" }] }, now).status,
    ).toBe("unknown");
    expect(
      parseCodexResetCredits({ credits: [{ ...credit, status: "new-protocol-value" }] }, now)
        .status,
    ).toBe("unknown");
    expect(parseCodexResetCredits({ credits: [] }, now)).toEqual({ status: "known", grants: [] });
    expect(parseClaudeResetCredits({ cedar_ember: null, juniper_tide: null }, now).status).toBe(
      "unknown",
    );
  });

  it("reports the observed Claude web-only restriction without asserting zero resets", () => {
    expect(
      parseClaudeResetCredits(
        { cedar_ember: { eligible: false, ineligible_reason: "surface", grants: [] } },
        now,
      ),
    ).toEqual({
      status: "unknown",
      reason: "web-only",
      manageUrl: "https://claude.ai/settings/usage",
    });
  });

  it("counts active Claude grants while excluding paused, expired and future grants", () => {
    const grant = {
      id: "grant",
      resets_left: 2,
      starts_at: "2026-10-01T00:00:00Z",
      ends_at: expiry,
    };
    expect(
      parseClaudeResetCredits(
        {
          cedar_ember: {
            eligible: true,
            grants: [
              grant,
              { ...grant, paused: true },
              { ...grant, ends_at: "2026-10-01T00:00:00Z" },
              { ...grant, starts_at: "2026-11-01T00:00:00Z" },
            ],
          },
        },
        now,
      ),
    ).toEqual({
      status: "known",
      grants: [
        {
          id: "grant",
          remaining: 2,
          startsAt: Date.parse(grant.starts_at),
          expiresAt: Date.parse(expiry),
        },
      ],
    });
  });

  it("reads a session reset even when the saved grant inventory is empty", () => {
    expect(
      parseClaudeResetCredits(
        {
          cedar_ember: { eligible: true, grants: [] },
          juniper_tide: { eligible: true, arm: "reset", available: true, weekly_resets_at: expiry },
        },
        now,
      ),
    ).toEqual({
      status: "known",
      grants: [{ id: "juniper_tide", remaining: 1, expiresAt: Date.parse(expiry) }],
    });
  });

  it("keeps older cached usage snapshots valid without pretending they report resets", () => {
    expect(
      usageSnapshotSchema.parse({ providerId: "codex", status: "ok", windows: [], fetchedAt: now })
        .resetCredits,
    ).toBeUndefined();
  });
});

it("uses only a read request with the same account and honors a throttle", async () => {
  const requests: HttpRequest[] = [];
  const host = createFakeHost({
    nowMs: now,
    onRequest: (request) => requests.push(request),
    routes: {
      [CODEX_RESET_CREDITS_ENDPOINT]: { status: 429, headers: { "Retry-After": "1800" } },
    },
  });
  const result = await readCodexResetCredits(
    host,
    { accessToken: "test-token", accountId: "test-account" },
    "test-version",
    now,
  );
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    method: "GET",
    url: CODEX_RESET_CREDITS_ENDPOINT,
    headers: { "ChatGPT-Account-Id": "test-account" },
  });
  expect(result).toEqual({
    resetCredits: { status: "unknown", reason: "unavailable" },
    rateLimitedUntil: now + 1800_000,
  });
});
