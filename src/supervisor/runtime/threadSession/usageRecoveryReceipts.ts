import { messageItemPayloadSchema, type RuntimeEvent } from "@/shared/contracts";
import type { ActiveQueueEntry, QueueEntry } from "./followUpQueueState";

type RecoveryReceipt =
  | { kind: "pending" }
  | { kind: "started"; at: number; assistant?: { id: string; hasContent: boolean } };

/** Confirm successful automatic turns on the durable transcript, never on quota refresh alone. */
export class UsageRecoveryReceiptTracker {
  private readonly entries = new WeakMap<QueueEntry, RecoveryReceipt>();

  arm(entry: QueueEntry): void {
    this.entries.set(entry, { kind: "pending" });
  }

  cancel(entry: QueueEntry): void {
    this.entries.delete(entry);
  }

  accept(active: ActiveQueueEntry, event: RuntimeEvent): RuntimeEvent | undefined {
    const receipt = this.entries.get(active.entry);
    if (!receipt || !active.dispatched) return;
    if (event.type === "turn.started" && receipt.kind === "pending") {
      this.entries.set(active.entry, { kind: "started", at: Date.now() });
      return;
    }
    if (receipt.kind !== "started") return;
    if (
      event.type === "item.started" &&
      event.itemType === "assistant_message" &&
      !event.parentItemId
    ) {
      receipt.assistant = {
        id: event.itemId,
        hasContent: messageItemPayloadSchema.safeParse(event.payload).success,
      };
    } else if (
      (event.type === "item.updated" || event.type === "item.completed") &&
      receipt.assistant?.id === event.itemId &&
      messageItemPayloadSchema.safeParse(event.payload).success
    ) {
      receipt.assistant.hasContent = true;
    } else if (event.type === "turn.completed" && active.turnId === event.turnId) {
      this.entries.delete(active.entry);
      if (event.state !== "completed") return;
      return {
        type: "item.updated",
        threadId: event.threadId,
        itemId: receipt.assistant?.id ?? active.entry.userMessageItemId,
        payload: {
          // Stream-only answers have no payload. Metadata must still produce a valid message.
          ...(receipt.assistant && !receipt.assistant.hasContent ? { content: [] } : {}),
          usageRecoveryResumedAt: receipt.at,
        },
      };
    }
    return;
  }
}
