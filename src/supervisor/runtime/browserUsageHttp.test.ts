import { afterEach, expect, it, vi } from "vitest";
import { requestBrowserUsageHttp } from "./browserUsageHttp";
import { browserUsageHttpRequestSchema } from "@/shared/usageBrowserHttp";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("resolves matching replies and releases its process listeners", async () => {
  const messages = process.listenerCount("message");
  const disconnects = process.listenerCount("disconnect");
  const send = vi.spyOn(process, "send").mockImplementation((value) => {
    const message = browserUsageHttpRequestSchema.parse(value);
    queueMicrotask(() =>
      process.emit("message", {
        type: "usage-http-reply",
        id: message.id,
        ok: true,
        response: { status: 200, headers: {}, body: "[]" },
      }),
    );
    return true;
  });
  await expect(
    requestBrowserUsageHttp({ url: "https://claude.ai/api/organizations" }),
  ).resolves.toEqual({ status: 200, headers: {}, body: "[]" });
  expect(send).toHaveBeenCalledTimes(1);
  expect(process.listenerCount("message")).toBe(messages);
  expect(process.listenerCount("disconnect")).toBe(disconnects);
});

it("times out without retrying a mutation or retaining listeners", async () => {
  vi.useFakeTimers();
  const messages = process.listenerCount("message");
  const send = vi.spyOn(process, "send").mockReturnValue(true);
  const result = requestBrowserUsageHttp({
    url: "https://claude.ai/api/organizations/test/reset_rate_limits",
    method: "POST",
    timeoutMs: 1000,
  }).catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await result).toBeInstanceOf(Error);
  expect(send).toHaveBeenCalledTimes(1);
  expect(process.listenerCount("message")).toBe(messages);
});
