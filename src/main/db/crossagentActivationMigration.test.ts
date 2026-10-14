import Database from "better-sqlite3";
import { expect, it } from "vitest";
import { runDatabaseMigrations } from "./migrations";

it("upgrades schema 42 standing delegation defaults while preserving explicit use, teams and other config", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`PRAGMA user_version = 42;
      CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE threads (id TEXT PRIMARY KEY, config TEXT NOT NULL);
      CREATE TABLE projects (id TEXT PRIMARY KEY, last_draft_config TEXT);
      CREATE TABLE thread_runtime_items (thread_id TEXT, type TEXT, payload TEXT);
      CREATE TABLE thread_context_usage (thread_id TEXT PRIMARY KEY, usage TEXT NOT NULL);
    `);
    const insert = db.prepare("INSERT INTO threads VALUES (?, ?)");
    for (const id of ["ordinary", "mentioned", "used", "team"]) {
      insert.run(
        id,
        JSON.stringify({
          model: "test",
          effort: "high",
          crossagentMcp: true,
          ...(id === "team" ? { teamMode: true } : {}),
        }),
      );
    }
    db.prepare("INSERT INTO thread_runtime_items VALUES (?, ?, ?)").run(
      "mentioned",
      "user_message",
      JSON.stringify({ content: [{ kind: "mcp", name: "Crossagents" }] }),
    );
    db.prepare("INSERT INTO thread_runtime_items VALUES (?, ?, ?)").run(
      "used",
      "mcp_tool_call",
      JSON.stringify({ name: "mcp__crossagents__list_agents", serverId: "crossagents" }),
    );
    // Migrations record their version in app_state, not SQLite's user_version.
    db.prepare("INSERT INTO app_state VALUES ('schema_version', ?)").run("42");
    db.prepare("INSERT INTO thread_context_usage VALUES (?, ?)").run(
      "ordinary",
      JSON.stringify({
        usedTokens: 25_000,
        maxTokens: 1_000_000,
        breakdown: [{ id: "deferred", label: "Deferred tools", tokens: 54_000 }],
      }),
    );
    runDatabaseMigrations(db, 42);
    expect(db.prepare("SELECT usage FROM thread_context_usage").get()).toEqual({
      usage: JSON.stringify({ usedTokens: 25_000, maxTokens: 1_000_000 }),
    });
    const rows = db.prepare("SELECT id, config FROM threads ORDER BY id").all();
    expect(rows).toEqual([
      {
        id: "mentioned",
        config: JSON.stringify({ model: "test", effort: "high", crossagentMcp: true }),
      },
      {
        id: "ordinary",
        config: JSON.stringify({ model: "test", effort: "high", crossagentMcp: false }),
      },
      {
        id: "team",
        config: JSON.stringify({
          model: "test",
          effort: "high",
          crossagentMcp: true,
          teamMode: true,
        }),
      },
      {
        id: "used",
        config: JSON.stringify({ model: "test", effort: "high", crossagentMcp: true }),
      },
    ]);
    runDatabaseMigrations(db, 43);
    expect(db.prepare("SELECT id, config FROM threads ORDER BY id").all()).toEqual(rows);
  } finally {
    db.close();
  }
});
