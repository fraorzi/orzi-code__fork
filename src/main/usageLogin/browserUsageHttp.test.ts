import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { browserUsageHttpRequestSchema } from "@/shared/usageBrowserHttp";

const mocks = vi.hoisted(() => ({ fetch: vi.fn<typeof fetch>() }));
vi.mock("electron", () => ({ net: { fetch: mocks.fetch } }));
import { requestBrowserUsageHttp } from "./browserUsageHttp";

beforeEach(() => {
  mocks.fetch.mockReset();
});

function request(url = "https://claude.ai/api/organizations") {
  return browserUsageHttpRequestSchema.parse({
    type: "usage-http-request",
    id: randomUUID(),
    request: { url, headers: { Cookie: "sessionKey=consented-test" } },
  });
}

it("uses explicitly consented cookies and never follows redirects or substitutes browser cookies", async () => {
  mocks.fetch.mockResolvedValue(
    new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
  );
  const message = request();
  expect(await requestBrowserUsageHttp(message)).toEqual({
    type: "usage-http-reply",
    id: message.id,
    ok: true,
    response: { status: 200, headers: { "content-type": "application/json" }, body: "[]" },
  });
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(
    message.request.url,
    expect.objectContaining({
      headers: message.request.headers,
      credentials: "omit",
      redirect: "error",
      signal: expect.any(AbortSignal),
    }),
  );
});

it.each([
  "https://claude.ai.example.com/api/organizations",
  "http://claude.ai/api/organizations",
  "file:///private/tmp/data",
  "https://api.anthropic.com/api/oauth/profile",
])("refuses an undeclared origin: %s", async (url) => {
  expect(await requestBrowserUsageHttp(request(url))).toMatchObject({ ok: false });
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("never retries a mutation or exposes network errors containing credentials", async () => {
  mocks.fetch.mockRejectedValue(new Error("private-session-key"));
  const message = request();
  message.request.method = "POST";
  message.request.body = "{}";
  expect(await requestBrowserUsageHttp(message)).toEqual({
    type: "usage-http-reply",
    id: message.id,
    ok: false,
  });
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});
