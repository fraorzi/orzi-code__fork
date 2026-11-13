import { describe, expect, it } from "vitest";
import { createFakeHost } from "../testHost";
import type { HttpRequest } from "../host";
import { CODEX_RESET_CREDITS_ENDPOINT, consumeCodexResetCredit } from "./codexResetCredits";

const request = { grantId: "saved-credit", requestId: "11111111-1111-4111-8111-111111111111" };
const credit = { id: request.grantId, status: "available", is_supported_by_plan: true };
function hostFor(code: string, requests: HttpRequest[], status = 200) {
  return createFakeHost({
    tokens: { codex: { accessToken: "test-token", accountId: "test-account" } },
    onRequest: (req) => requests.push(req),
    routes: {
      [CODEX_RESET_CREDITS_ENDPOINT]: { body: JSON.stringify({ credits: [credit] }) },
      [`${CODEX_RESET_CREDITS_ENDPOINT}/consume`]: { status, body: JSON.stringify({ code }) },
    },
  });
}

describe("Codex native reset activation", () => {
  it.each([
    ["reset", "reset"],
    ["already_redeemed", "already-redeemed"],
    ["nothing_to_reset", "nothing-to-reset"],
    ["no_credit", "unavailable"],
  ])("normalizes %s and sends one selected, idempotent POST", async (code, outcome) => {
    const requests: HttpRequest[] = [];
    expect(await consumeCodexResetCredit(hostFor(code, requests), request)).toEqual({ outcome });
    expect(requests.map((req) => req.method ?? "GET")).toEqual(["GET", "POST"]);
    expect(requests[1]).toMatchObject({
      redirect: "error",
      headers: { "ChatGPT-Account-Id": "test-account" },
    });
    expect(JSON.parse(requests[1]!.body!)).toEqual({
      credit_id: request.grantId,
      redeem_request_id: request.requestId,
    });
  });
  it("does not redeem a missing credit", async () => {
    const requests: HttpRequest[] = [];
    expect(
      await consumeCodexResetCredit(hostFor("reset", requests), { ...request, grantId: "missing" }),
    ).toEqual({ outcome: "unavailable" });
    expect(requests).toHaveLength(1);
  });
  it.each([500, 429, 401, 403])("never retries a rejected mutation (%i)", async (status) => {
    const requests: HttpRequest[] = [];
    const result = await consumeCodexResetCredit(hostFor("reset", requests, status), request);
    expect(result.outcome).not.toBe("reset");
    expect(requests.filter((req) => req.method === "POST")).toHaveLength(1);
  });
  it("treats an unfamiliar response as unconfirmed", async () => {
    expect(await consumeCodexResetCredit(hostFor("new-code", []), request)).toEqual({
      outcome: "unknown",
    });
  });
});
