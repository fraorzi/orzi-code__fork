import { z } from "zod";
import { allUsageProviderDescriptors } from "@poracode/agents-usage/providers";

const browserHttpOrigins = new Set(
  allUsageProviderDescriptors().flatMap((provider) => provider.browserHttpOrigins ?? []),
);

export function usesBrowserUsageHttp(url: string): boolean {
  return browserHttpOrigins.has(new URL(url).origin);
}

// Private main/supervisor messages ship in one bundle. No renderer or remote route.
export const browserUsageHttpRequestSchema = z.object({
  type: z.literal("usage-http-request"),
  id: z.string().uuid(),
  request: z.object({
    url: z.string().url(),
    method: z.enum(["GET", "POST"]).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
    bodyBytes: z.never().optional(),
    timeoutMs: z.number().int().positive().max(30_000).optional(),
  }),
});
export type BrowserUsageHttpRequest = z.infer<typeof browserUsageHttpRequestSchema>;

export const browserUsageHttpReplySchema = z.discriminatedUnion("ok", [
  z.object({
    type: z.literal("usage-http-reply"),
    id: z.string().uuid(),
    ok: z.literal(true),
    response: z.object({
      status: z.number().int().min(100).max(599),
      headers: z.record(z.string(), z.string()),
      body: z.string(),
    }),
  }),
  z.object({
    type: z.literal("usage-http-reply"),
    id: z.string().uuid(),
    ok: z.literal(false),
  }),
]);
export type BrowserUsageHttpReply = z.infer<typeof browserUsageHttpReplySchema>;
