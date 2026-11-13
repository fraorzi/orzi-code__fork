import { afterEach, describe, expect, it, vi } from "vitest";
import { createNodeHttpClient } from "./usageHttpClient";
import type { HttpClient } from "@poracode/agents-usage";

describe("createNodeHttpClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("passes the caller's redirect policy to fetch", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await createNodeHttpClient().request({
      method: "POST",
      url: "https://oauth2.googleapis.com/token",
      body: "secret-form",
      redirect: "error",
    });

    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe("error");
  });

  it("uses the browser transport only for declared origins", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const browserRequest = vi.fn<HttpClient["request"]>(async () => ({
      status: 200,
      headers: {},
      body: "[]",
    }));
    const http = createNodeHttpClient(browserRequest);
    const request = {
      url: "https://claude.ai/api/organizations",
      headers: { Cookie: "sessionKey=test" },
      redirect: "error",
    } satisfies Parameters<HttpClient["request"]>[0];
    expect(await http.request(request)).toMatchObject({ body: "[]" });
    expect(browserRequest).toHaveBeenCalledExactlyOnceWith(request);
    expect(fetchMock).not.toHaveBeenCalled();
    await http.request({
      url: "https://api.anthropic.com/api/oauth/profile",
      headers: { Authorization: "Bearer test" },
    });
    await http.request({ url: "https://claude.ai.example.com/api/organizations" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(browserRequest).toHaveBeenCalledTimes(1);
  });

  it("does not retry or switch transports after a failed browser mutation", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const browserRequest = vi
      .fn<HttpClient["request"]>()
      .mockRejectedValue(new Error("lost response"));
    await expect(
      createNodeHttpClient(browserRequest).request({
        method: "POST",
        url: "https://claude.ai/api/organizations/test/reset_rate_limits",
        body: "{}",
      }),
    ).rejects.toThrow("lost response");
    expect(browserRequest).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retains Node HTTP in a headless supervisor", async () => {
    vi.stubEnv("PORACODE_USAGE_BROWSER_HTTP", "0");
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createNodeHttpClient().request({ url: "https://claude.ai/api/organizations" }),
    ).resolves.toMatchObject({ body: "[]" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
