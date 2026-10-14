import type Database from "better-sqlite3";

/** Remove the old standing default, retaining Teamwork and recorded explicit use. */
export function migrateCrossagentActivation(sqlite: InstanceType<typeof Database>): void {
  const columns = sqlite.prepare("PRAGMA table_info(threads)").all();
  if (
    !columns.some(
      (row) => typeof row === "object" && row !== null && "name" in row && row.name === "config",
    )
  )
    return;
  const hasItems = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE name = 'thread_runtime_items'")
    .get();
  sqlite.exec(`
    UPDATE threads SET config = json_set(config, '$.crossagentMcp', json('false'))
    WHERE json_valid(config) AND json_extract(config, '$.crossagentMcp') = 1
      AND COALESCE(json_extract(config, '$.teamMode'), 0) != 1
      ${
        hasItems
          ? `AND NOT EXISTS (
        SELECT 1 FROM thread_runtime_items i WHERE i.thread_id = threads.id
          AND json_valid(i.payload) AND (
            (i.type = 'mcp_tool_call' AND (json_extract(i.payload, '$.serverId') = 'crossagents'
              OR json_extract(i.payload, '$.name') LIKE 'mcp__crossagents__%'
              OR json_extract(i.payload, '$.name') LIKE 'crossagents__%'))
            OR (i.type = 'user_message' AND EXISTS (
              SELECT 1 FROM json_each(i.payload, '$.content') c
              WHERE CASE WHEN c.type = 'object' THEN
                json_extract(c.value, '$.kind') = 'mcp'
                AND lower(json_extract(c.value, '$.name')) = 'crossagents'
                ELSE 0 END
            ))
          )
      )`
          : ""
      };
  `);
  const projectColumns = sqlite.prepare("PRAGMA table_info(projects)").all();
  if (
    projectColumns.some(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        "name" in row &&
        row.name === "last_draft_config",
    )
  ) {
    sqlite.exec(`UPDATE projects SET last_draft_config = json_set(last_draft_config, '$.crossagentMcp', json('false'))
      WHERE json_valid(last_draft_config) AND json_extract(last_draft_config, '$.crossagentMcp') = 1
        AND COALESCE(json_extract(last_draft_config, '$.teamMode'), 0) != 1`);
  }
}
