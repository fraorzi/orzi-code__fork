import { z } from "zod";
import { projectNotesSchema, threadContextUsageSchema } from "@/shared/contracts";
import { persistedCompletedTurnSchema, persistedRuntimeItemSchema } from "@/shared/ipc/schemas";
import { historyRows, type ImportDatabase } from "./importDatabase";

const nonnegativeInteger = z.number().int().nonnegative();
const streamOwnerSchema = z.object({
  thread_id: z.string().min(1),
  item_id: z.string().min(1),
  stream: z.string().min(1),
});
const streamChunkSchema = streamOwnerSchema.extend({
  seq: nonnegativeInteger,
  chars: nonnegativeInteger,
  text: z.string(),
});
const streamStateSchema = streamOwnerSchema.extend({
  next_seq: nonnegativeInteger,
  tail_chars: nonnegativeInteger,
  elided_chars: nonnegativeInteger,
});

function json(value: unknown): unknown {
  return value === null ? null : JSON.parse(z.string().parse(value));
}

/** Validate the serialized history before any row can reach the live database. */
export function validateHistoryRecords(database: ImportDatabase): void {
  for (const row of historyRows(database, "thread_runtime_items")) {
    nonnegativeInteger.parse(row.position);
    persistedRuntimeItemSchema.parse({
      id: row.item_id,
      type: row.type,
      state: row.state,
      payload: json(row.payload),
      streams: row.streams === null ? {} : json(row.streams),
      parentItemId: row.parent_item_id ?? undefined,
    });
  }
  for (const row of historyRows(database, "thread_runtime_item_stream_chunks"))
    streamChunkSchema.parse(row);
  for (const row of historyRows(database, "thread_runtime_item_stream_state"))
    streamStateSchema.parse(row);
  for (const row of historyRows(database, "thread_completed_turns")) {
    nonnegativeInteger.parse(row.idx);
    persistedCompletedTurnSchema.parse({
      startedAt: row.started_at,
      endedAt: row.ended_at,
      anchorItemId: row.anchor_item_id,
    });
  }
  for (const row of historyRows(database, "thread_context_usage"))
    threadContextUsageSchema.parse(json(row.usage));
  for (const row of historyRows(database, "project_notes")) {
    projectNotesSchema.parse({
      projectId: row.project_id,
      doc: json(row.doc),
      todos: json(row.todos),
      updatedAt: row.updated_at,
    });
  }
}
