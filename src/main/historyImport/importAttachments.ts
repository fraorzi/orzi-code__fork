import { copyFile, mkdir, realpath, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { HistoryImportError, type ImportDatabase, type HistoryImportPlan } from "./importDatabase";

interface AttachmentCopy {
  source: string;
  staged: string;
  target: string;
}

/** Only profile-owned attachment references are relocated; never walk arbitrary profile files. */
export async function prepareHistoryAttachments(
  database: ImportDatabase,
  plan: HistoryImportPlan,
  sourceRoot: string,
  targetRoot: string,
  stageRoot: string,
  token: string,
): Promise<AttachmentCopy[]> {
  const attachments = new Map<string, AttachmentCopy>();
  const importedIds = new Set(plan.newThreads);
  const relocate = (path: string, threadId: string) => {
    if (!path.startsWith(`${sourceRoot}/`)) return path;
    const rel = relative(sourceRoot, resolve(path));
    if (rel === ".." || rel.startsWith("../") || isAbsolute(rel))
      throw new HistoryImportError("missingAttachment");
    const key = `${threadId}:${path}`;
    let copy = attachments.get(key);
    if (!copy) {
      const file = `${randomUUID()}${extname(path).slice(0, 12)}`;
      copy = {
        source: path,
        staged: join(stageRoot, file),
        target: join(targetRoot, threadId, `import-${token}`, file),
      };
      attachments.set(key, copy);
    }
    return copy.target;
  };
  const rewrite = (value: unknown, threadId: string): unknown => {
    if (Array.isArray(value)) return value.map((entry) => rewrite(entry, threadId));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          key === "path" && typeof entry === "string"
            ? relocate(entry, threadId)
            : rewrite(entry, threadId),
        ]),
      );
    }
    if (typeof value === "string" && /^(poracode|lightcode)-local:\/\//.test(value)) {
      const url = new URL(value);
      const path = fileURLToPath(`file://${url.pathname}`);
      const relocated = relocate(path, threadId);
      return relocated === path
        ? value
        : `poracode-local://local${pathToFileURL(relocated).pathname}`;
    }
    return value;
  };
  database.transaction(() => {
    const update = database.prepare(
      "UPDATE thread_runtime_items SET payload = ? WHERE thread_id = ? AND item_id = ?",
    );
    const read = database.prepare(
      "SELECT item_id, payload FROM thread_runtime_items WHERE thread_id = ?",
    );
    for (const threadId of importedIds) {
      // Finalize the read before writing on this same connection. Streaming
      // iterate() holds a live SQLite query and prevents these updates.
      const rows = z
        .array(z.object({ item_id: z.string(), payload: z.string().nullable() }))
        .parse(read.all(threadId));
      for (const row of rows) {
        if (row.payload === null) continue;
        update.run(
          JSON.stringify(rewrite(JSON.parse(row.payload), threadId)),
          threadId,
          row.item_id,
        );
      }
    }
  })();
  await mkdir(stageRoot, { recursive: true, mode: 0o700 });
  for (const copy of attachments.values()) {
    try {
      const rel = relative(await realpath(sourceRoot), await realpath(copy.source));
      if (
        rel === ".." ||
        rel.startsWith("../") ||
        isAbsolute(rel) ||
        !(await stat(copy.source)).isFile()
      )
        throw new HistoryImportError("missingAttachment");
      await copyFile(copy.source, copy.staged);
    } catch (error) {
      if (error instanceof HistoryImportError) throw error;
      throw new HistoryImportError("missingAttachment");
    }
  }
  return [...attachments.values()];
}

export async function publishHistoryAttachments(copies: readonly AttachmentCopy[]): Promise<void> {
  for (const copy of copies) {
    await mkdir(dirname(copy.target), { recursive: true, mode: 0o700 });
    await copyFile(copy.staged, copy.target);
  }
}
