import { net } from "electron";
import {
  usesBrowserUsageHttp,
  type BrowserUsageHttpRequest,
  type BrowserUsageHttpReply,
} from "@/shared/usageBrowserHttp";

/** Use Chromium TLS without reading or replacing the browser's signed-in cookie jar. */
export async function requestBrowserUsageHttp(
  message: BrowserUsageHttpRequest,
): Promise<BrowserUsageHttpReply> {
  try {
    if (!usesBrowserUsageHttp(message.request.url)) throw new Error("Unsupported usage origin");
    const { url, timeoutMs, method, headers, body } = message.request;
    const response = await net.fetch(url, {
      ...(method ? { method } : {}),
      ...(headers ? { headers } : {}),
      ...(body !== undefined ? { body } : {}),
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs ?? 15_000),
    });
    return {
      type: "usage-http-reply",
      id: message.id,
      ok: true,
      response: {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      },
    };
  } catch {
    // Requests contain credentials. Do not forward or log exception details.
    return { type: "usage-http-reply", id: message.id, ok: false };
  }
}
