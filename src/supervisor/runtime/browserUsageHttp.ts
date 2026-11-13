import { randomUUID } from "node:crypto";
import type { HttpClient } from "@poracode/agents-usage";
import {
  browserUsageHttpReplySchema,
  browserUsageHttpRequestSchema,
} from "@/shared/usageBrowserHttp";

/** One IPC round trip per request. A failed or lost mutation is never retried. */
export const requestBrowserUsageHttp: HttpClient["request"] = (request) => {
  const message = browserUsageHttpRequestSchema.parse({
    type: "usage-http-request",
    id: randomUUID(),
    request,
  });
  return new Promise((resolve, reject) => {
    const finish = (): void => {
      clearTimeout(timeout);
      process.removeListener("message", onMessage);
      process.removeListener("disconnect", onDisconnect);
    };
    const onDisconnect = (): void => {
      finish();
      reject(new Error("Browser usage request unavailable"));
    };
    const onMessage = (value: unknown): void => {
      const parsed = browserUsageHttpReplySchema.safeParse(value);
      if (!parsed.success || parsed.data.id !== message.id) return;
      finish();
      if (parsed.data.ok) resolve(parsed.data.response);
      else reject(new Error("Browser usage request failed"));
    };
    const timeout = setTimeout(onDisconnect, request.timeoutMs ?? 15_000);
    process.on("message", onMessage);
    process.on("disconnect", onDisconnect);
    if (!process.send || !process.connected) {
      onDisconnect();
      return;
    }
    try {
      process.send(message, (error) => {
        if (error) onDisconnect();
      });
    } catch {
      onDisconnect();
    }
  });
};
