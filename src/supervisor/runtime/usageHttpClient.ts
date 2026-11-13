import type { HttpClient, HttpRequest, HttpResponse } from "@poracode/agents-usage";
import { usesBrowserUsageHttp } from "@/shared/usageBrowserHttp";
import { requestBrowserUsageHttp } from "./browserUsageHttp";

/**
 * Node implementation of the usage HostPort's HTTP client: global fetch with an
 * abort-based timeout. Origins declared by a provider use the desktop browser
 * network stack through private IPC; standalone Node hosts retain global fetch.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

export function createNodeHttpClient(
  browserRequest: HttpClient["request"] | undefined = process.send &&
  process.env.PORACODE_USAGE_BROWSER_HTTP === "1"
    ? requestBrowserUsageHttp
    : undefined,
): HttpClient {
  return {
    async request(req: HttpRequest): Promise<HttpResponse> {
      if (browserRequest && usesBrowserUsageHttp(req.url)) return browserRequest(req);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      try {
        const res = await fetch(req.url, {
          method: req.method ?? "GET",
          ...(req.headers ? { headers: req.headers } : {}),
          ...(req.bodyBytes !== undefined
            ? { body: Buffer.from(req.bodyBytes) }
            : req.body !== undefined
              ? { body: req.body }
              : {}),
          ...(req.redirect ? { redirect: req.redirect } : {}),
          signal: controller.signal,
        });
        const bodyBytes = new Uint8Array(await res.arrayBuffer());
        const body = Buffer.from(bodyBytes).toString("utf8");
        // `headersToRecord` collapses repeated `set-cookie` into one comma-joined
        // value that cannot be split back apart (attributes contain commas), so
        // surface the raw lines separately for collectors that rotate a session
        // cookie. Same pitfall the relay host documents.
        const setCookies = res.headers.getSetCookie();
        return {
          status: res.status,
          headers: headersToRecord(res.headers),
          body,
          bodyBytes,
          ...(setCookies.length > 0 ? { setCookies } : {}),
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
