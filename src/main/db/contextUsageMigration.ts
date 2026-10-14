import type Database from "better-sqlite3";

/** Old breakdowns mix deferred schemas and reserves with used content. Keep occupancy, refresh categories. */
export function invalidateUnclassifiedContextBreakdowns(
  sqlite: InstanceType<typeof Database>,
): void {
  if (!sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'thread_context_usage'").get())
    return;
  sqlite.exec(`UPDATE thread_context_usage SET usage = json_remove(usage, '$.breakdown')
    WHERE json_valid(usage) AND EXISTS (
      SELECT 1 FROM json_each(usage, '$.breakdown') entry
      WHERE CASE WHEN entry.type = 'object' THEN json_extract(entry.value, '$.kind') IS NULL ELSE 1 END
    )`);
}
