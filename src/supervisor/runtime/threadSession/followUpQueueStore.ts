// Modified for the orzi-code__fork personal fork by Franciszek Orzechowski on 2026-10-07.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { writeFileAtomic } from "@/shared/atomicFile";
import { setPendingSteerPayloadSchema } from "@/shared/contracts";
import type { QueueEntry, QueueRecord } from "./followUpQueueState";

// New supervisor-owned store. Older releases have no file and need no migration.
const FOLLOW_UP_QUEUE_STORE_VERSION = 1;
const storedQueueSchema = z
  .object({
    version: z.literal(FOLLOW_UP_QUEUE_STORE_VERSION),
    threadId: z.string().min(1),
    items: z.array(
      z.object({
        id: z.string().min(1),
        stagedAt: z.number().int().nonnegative(),
        payload: setPendingSteerPayloadSchema,
        userMessageItemId: z.string().min(1),
      }),
    ),
  })
  .superRefine((queue, ctx) => {
    if (
      queue.items.some((entry) => entry.payload.threadId !== queue.threadId) ||
      new Set(queue.items.map((entry) => entry.id)).size !== queue.items.length ||
      new Set(queue.items.map((entry) => entry.userMessageItemId)).size !== queue.items.length
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid queued follow-up identities" });
    }
  });

/** Durable raw inputs only: prepared prompts and provider/session state are never persisted. */
export class FollowUpQueueStore {
  private readonly saved = new Map<string, string>();
  private readonly unreadable = new Map<string, unknown>();

  constructor(private readonly directory: string) {}

  load(): { threadId: string; items: QueueEntry[] }[] {
    let files: string[];
    try {
      files = readdirSync(this.directory);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
    const queues: { threadId: string; items: QueueEntry[] }[] = [];
    for (const file of files.filter((name) => name.endsWith(".json"))) {
      try {
        const serialized = readFileSync(join(this.directory, file), "utf8");
        const queue = storedQueueSchema.parse(JSON.parse(serialized));
        if (this.filename(queue.threadId) !== file) throw new Error("Queue file identity mismatch");
        this.saved.set(queue.threadId, serialized);
        if (queue.items.length > 0) queues.push(queue);
      } catch (error) {
        // Preserve corrupt/unknown versions in place; never silently overwrite user input.
        this.unreadable.set(file, error);
        console.error("[supervisor] unable to recover follow-up queue", { file, error });
      }
    }
    return queues;
  }

  save(threadId: string, record: QueueRecord | undefined): void {
    const filename = this.filename(threadId);
    if (this.unreadable.has(filename)) throw this.unreadable.get(filename);
    const items = [...(record?.items ?? [])];
    // A dispatch is still recoverable until a canonical provider admission signal.
    if (
      record?.active &&
      !record.active.admitted &&
      !record.active.cancelled &&
      !items.includes(record.active.entry)
    )
      items.unshift(record.active.entry);
    const serialized = JSON.stringify({
      version: FOLLOW_UP_QUEUE_STORE_VERSION,
      threadId,
      items: items.map(({ id, stagedAt, payload, userMessageItemId }) => ({
        id,
        stagedAt,
        payload,
        userMessageItemId,
      })),
    });
    if (this.saved.get(threadId) === serialized) return;
    if (items.length === 0) {
      if (this.saved.has(threadId)) rmSync(join(this.directory, filename), { force: true });
      this.saved.delete(threadId);
      return;
    }
    writeFileAtomic(join(this.directory, filename), serialized, { encoding: "utf8", mode: 0o600 });
    this.saved.set(threadId, serialized);
  }

  private filename(threadId: string): string {
    return `${createHash("sha256").update(threadId).digest("hex")}.json`;
  }
}
