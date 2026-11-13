import { z } from "zod";
import type { OneShotUsage } from "@/shared/auxiliaryUsage";

const count = z.number().int().nonnegative();
const infoSchema = z.object({
  modelID: z.string().optional(),
  cost: z.number().finite().nonnegative().optional(),
  tokens: z
    .object({
      total: count.optional(),
      input: count.optional(),
      output: count.optional(),
      reasoning: count.optional(),
      cache: z.object({ read: count, write: count }).optional(),
    })
    .optional(),
});

export function readOpenCodeOneShotUsage(info: unknown): OneShotUsage | undefined {
  const parsed = infoSchema.safeParse(info);
  if (!parsed.success) return undefined;
  const { tokens, modelID, cost } = parsed.data;
  // Prefer the SDK total. The fallback requires every bucket, rather than
  // turning missing/unrecognized usage into an apparently complete total.
  const totalTokens =
    tokens?.total ??
    (tokens?.input !== undefined &&
    tokens.output !== undefined &&
    tokens.reasoning !== undefined &&
    tokens.cache !== undefined
      ? tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write
      : undefined);
  if (totalTokens === undefined && cost === undefined) return undefined;
  return {
    ...(modelID ? { model: modelID } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(cost !== undefined ? { costUsd: cost } : {}),
  };
}
