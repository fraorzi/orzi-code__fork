import { z } from "zod";
import type { AppStoreState } from "@/renderer/state/slices/shared";

const receiptSchema = z.object({ usageRecoveryResumedAt: z.number().int().nonnegative() });

/** Receipts live on completed messages, so reopening persisted history preserves confirmation. */
export function selectUsageRecoveryResumedAt(
  state: AppStoreState,
  threadId: string,
): number | undefined {
  const ids = state.runtimeItemIdsByThread[threadId] ?? [];
  const items = state.runtimeItemsByIdByThread[threadId];
  for (let index = ids.length - 1; index >= 0; index--) {
    const item = items?.[ids[index]!];
    if (item?.state !== "completed" || item.parentItemId) continue;
    if (item.type !== "user_message" && item.type !== "assistant_message") continue;
    const receipt = receiptSchema.safeParse(item.payload);
    if (receipt.success) return receipt.data.usageRecoveryResumedAt;
  }
  return undefined;
}
