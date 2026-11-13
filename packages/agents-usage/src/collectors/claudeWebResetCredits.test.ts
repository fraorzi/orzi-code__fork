import { describe, expect, it } from "vitest";
import { createFakeHost } from "../testHost";
import type { FakeHostConfig } from "../testHost";
import type { HttpRequest } from "../host";
import { consumeClaudeResetCredit, readClaudeWebResetCredits } from "./claudeWebResetCredits";
import { collectClaude, CLAUDE_USAGE_ENDPOINT } from "./claude";

const organizationId = "11111111-1111-4111-8111-111111111111";
const root = `https://claude.ai/api/organizations/${organizationId}`;
const profileUrl = "https://api.anthropic.com/api/oauth/profile";
const token = { accessToken: "cli-token" };
const request = { grantId: "partial-reset", requestId: "22222222-2222-4222-8222-222222222222" };
const inventory = {
  cedar_ember: {
    eligible: true,
    next_grant_id: request.grantId,
    grants: [
      {
        id: request.grantId,
        label: "Partial reset",
        resets_left: 1,
        usable_now: true,
        ends_at: "2030-01-01T00:00:00Z",
      },
    ],
  },
};
function config(requests: HttpRequest[]): FakeHostConfig {
  return {
    tokens: { claude: token },
    secrets: { claude: { cookie: "sessionKey=web-test" } },
    onRequest: (req) => requests.push(req),
    routes: {
      [profileUrl]: { body: JSON.stringify({ organization: { uuid: organizationId } }) },
      "https://claude.ai/api/organizations": { body: JSON.stringify([{ uuid: organizationId }]) },
      [`${root}/usage?cedar_ember=1&at_wall=1`]: { body: JSON.stringify(inventory) },
      [`${root}/reset_rate_limits`]: { body: JSON.stringify({ result: "reset" }) },
      [CLAUDE_USAGE_ENDPOINT]: {
        body: JSON.stringify({
          five_hour: { utilization: 60 },
          cedar_ember: { eligible: false, ineligible_reason: "surface" },
        }),
      },
    },
  };
}

describe("Claude reset web session", () => {
  it("reads consented web inventory without sending the CLI token to the web host", async () => {
    const requests: HttpRequest[] = [];
    expect(await readClaudeWebResetCredits(createFakeHost(config(requests)), token)).toMatchObject({
      resetCredits: { status: "known", grants: [{ id: request.grantId, canActivate: true }] },
    });
    expect(requests[0]?.headers).toHaveProperty("Authorization", "Bearer cli-token");
    for (const req of requests.slice(1)) {
      expect(req.headers).not.toHaveProperty("Authorization");
      expect(req.headers).toHaveProperty("Cookie", "sessionKey=web-test");
    }
  });
  it("integrates the web fallback without replacing CLI quota windows", async () => {
    expect(await collectClaude(createFakeHost(config([])))).toMatchObject({
      windows: [{ id: "session-5h", usedPercent: 60 }],
      resetCredits: { status: "known" },
    });
  });
  it("never mutates when the web session belongs to another organization", async () => {
    const requests: HttpRequest[] = [];
    const setup = config(requests);
    setup.routes!["https://claude.ai/api/organizations"] = {
      body: JSON.stringify([{ uuid: "33333333-3333-4333-8333-333333333333" }]),
    };
    expect(await consumeClaudeResetCredit(createFakeHost(setup), request)).toEqual({
      outcome: "account-mismatch",
    });
    expect(requests.every((req) => req.method !== "POST")).toBe(true);
  });
  it("does not attempt to capture a web credential without a stored session", async () => {
    const requests: HttpRequest[] = [];
    expect(
      await readClaudeWebResetCredits(
        createFakeHost({ onRequest: (req) => requests.push(req) }),
        token,
      ),
    ).toEqual({ resetCredits: { status: "unknown", reason: "web-only" } });
    expect(requests).toHaveLength(0);
  });
  it("activates the freshly selected grant once with a stable request id", async () => {
    const requests: HttpRequest[] = [];
    expect(await consumeClaudeResetCredit(createFakeHost(config(requests)), request)).toEqual({
      outcome: "reset",
    });
    const posts = requests.filter((req) => req.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ url: `${root}/reset_rate_limits`, redirect: "error" });
    expect(JSON.parse(posts[0]!.body!)).toEqual({
      program: "cedar_ember",
      grant_id: request.grantId,
      request_id: request.requestId,
    });
  });
  it("does not activate an offer that is not usable yet", async () => {
    const requests: HttpRequest[] = [];
    const setup = config(requests);
    setup.routes![`${root}/usage?cedar_ember=1&at_wall=1`] = {
      body: JSON.stringify({ cedar_ember: { ...inventory.cedar_ember, next_grant_id: null } }),
    };
    expect(await consumeClaudeResetCredit(createFakeHost(setup), request)).toEqual({
      outcome: "unavailable",
    });
    expect(requests.every((req) => req.method !== "POST")).toBe(true);
  });
  it("preserves a provider backoff and does not continue discovery", async () => {
    const requests: HttpRequest[] = [];
    const setup = config(requests);
    setup.routes![profileUrl] = { status: 429, headers: { "retry-after": "1800" } };
    const host = createFakeHost(setup);
    expect(await readClaudeWebResetCredits(host, token)).toMatchObject({
      rateLimitedUntil: host.now() + 1800000,
    });
    expect(requests).toHaveLength(1);
  });
});
