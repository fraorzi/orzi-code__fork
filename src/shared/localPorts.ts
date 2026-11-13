import { z } from "zod";

export const localPortSchema = z.object({
  pid: z.number().int().positive(),
  startedAt: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  address: z.string(),
  processName: z.string(),
  cwd: z.string(),
});
export type LocalPort = z.infer<typeof localPortSchema>;

export type LocalPortsResult =
  | { status: "available"; ports: LocalPort[] }
  | { status: "unavailable"; reason: "unsupported-platform" | "scan-failed" };

export const stopLocalPortSchema = localPortSchema
  .pick({ pid: true, startedAt: true, port: true })
  .extend({
    force: z.boolean().optional(),
  });
export type StopLocalPort = z.infer<typeof stopLocalPortSchema>;
export type StopLocalPortResult =
  | { status: "stopped" }
  | {
      status: "error";
      reason: "stale" | "protected" | "permission-denied" | "still-running" | "failed";
    };
