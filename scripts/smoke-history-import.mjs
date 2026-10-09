import Database from "better-sqlite3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Real SQLite/IPC and review controls. File choice is supplied programmatically. */
export async function historyImportScenario({
  client,
  evaluate,
  bridgeInvoke,
  waitForValue,
  screenshot,
  outDir,
}) {
  const session = JSON.parse(await readFile(join(dirname(outDir), "session.json"), "utf8"));
  const directory = join(dirname(outDir), "history-import-source");
  const sourcePath = join(directory, "state.sqlite");
  await mkdir(directory, { recursive: true });
  const source = new Database(join(session.baseDir, "state.sqlite"), { readonly: true });
  try {
    await source.backup(sourcePath);
  } finally {
    source.close();
  }
  const sourceDatabase = new Database(sourcePath);
  const id = "history-smoke-thread";
  const projectId = "history-smoke-project";
  const date = "2020-01-01T00:00:00.000Z";
  const projectPath = join(directory, "project");
  const attachment = join(directory, "attachments", id, "reference.txt");
  await mkdir(projectPath);
  await mkdir(dirname(attachment), { recursive: true });
  await writeFile(attachment, "HISTORY_SMOKE_ATTACHMENT");
  try {
    sourceDatabase
      .prepare(
        "INSERT INTO projects(id,name,location_kind,location_path,created_at) VALUES(?,?,'posix',?,?)",
      )
      .run(projectId, "Imported history fixture", projectPath, date);
    sourceDatabase
      .prepare(
        "INSERT INTO threads(id,project_id,title,agent_kind,config,status,attention,archived,archived_at,created_at,updated_at,presentation_mode) VALUES(?,?,?,'codex',?,'working','working',1,?,?,?,'gui')",
      )
      .run(id, projectId, "Imported archive from 2020", '{"model":"gpt-5.5"}', date, date, date);
    sourceDatabase
      .prepare(
        "INSERT INTO thread_runtime_items(thread_id,item_id,position,type,state,payload,streams) VALUES(?,'fixture-message',0,'user_message','completed',?,?)",
      )
      .run(
        id,
        JSON.stringify({
          attachments: [{ kind: "file", path: attachment, name: "reference.txt" }],
        }),
        '{"text":"Historical content"}',
      );
  } finally {
    sourceDatabase.close();
  }
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const before = await bridgeInvoke(client, "dbGetThreads");
  await evaluate(client, 'window.__poracodeDev.openSettings("threads")');
  await waitForValue(
    () => evaluate(client, "Boolean(document.querySelector('[data-testid=\"history-import\"]'))"),
    Boolean,
    "History import settings",
  );
  const review = async () => {
    const prepared = await bridgeInvoke(client, "prepareHistoryImport", { sourcePath });
    assert(
      prepared.ok &&
        prepared.value.newProjects === 1 &&
        prepared.value.newThreads === 1 &&
        prepared.value.attachments === 1,
      "Unexpected history import preview",
    );
    // The context bridge is frozen. Supply the real IPC preview to the mounted
    // component's review state without opening a native picker over the user.
    // Fail explicitly if React changes this QA-only access path.
    await evaluate(
      client,
      `(() => {
      const section = document.querySelector('[data-testid="history-import"]');
      const key = Object.keys(section).find(key => key.startsWith("__reactFiber"));
      let fiber = section[key];
      while (fiber && fiber.type?.name !== "HistoryImportSection") fiber = fiber.return;
      if (!fiber) throw new Error("History import component not found");
      let hook = fiber.memoizedState;
      while (hook && !(typeof hook.memoizedState?.kind === "string" && hook.queue?.dispatch)) hook = hook.next;
      if (!hook) throw new Error("History review state not found");
      hook.queue.dispatch({ kind: "review", preview: ${JSON.stringify(prepared.value)} });
    })()`,
    );
    await waitForValue(
      () =>
        evaluate(
          client,
          'document.querySelector(\'[data-testid="history-import"]\').innerText.includes("Import new threads")',
        ),
      Boolean,
      "History import review",
    );
    return prepared.value;
  };
  try {
    await review();
    await screenshot(client, join(outDir, "history-import-preview.png"));
    await evaluate(
      client,
      'Array.from(document.querySelectorAll(\'[data-testid="history-import"] button\')).find(button => button.innerText === "Cancel").click()',
    );
    await waitForValue(
      () =>
        evaluate(
          client,
          '!document.querySelector(\'[data-testid="history-import"]\').innerText.includes("Import new threads")',
        ),
      Boolean,
      "Cancelled import review",
    );
    assert(
      (await bridgeInvoke(client, "dbGetThreads")).length === before.length,
      "Cancelling imported history",
    );
    await review();
    await evaluate(
      client,
      'Array.from(document.querySelectorAll(\'[data-testid="history-import"] button\')).find(button => button.innerText === "Import new threads").click()',
    );
    await waitForValue(
      () =>
        evaluate(
          client,
          'document.querySelector(\'[data-testid="history-import"]\').innerText.includes("History imported.")',
        ),
      Boolean,
      "Completed history import",
    );
    const imported = (await bridgeInvoke(client, "dbGetThreads")).find(
      (thread) => thread.id === id,
    );
    assert(
      imported?.status === "inactive" && imported.archived && imported.createdAt === date,
      "Imported archive metadata changed",
    );
    const items = await bridgeInvoke(client, "dbGetThreadRuntimeItems", id);
    const savedAttachment = items[0]?.payload?.attachments?.[0]?.path;
    assert(
      typeof savedAttachment === "string" &&
        savedAttachment.includes(join("attachments", id, "import-")),
      "Attachment did not move to its owning thread",
    );
    assert(
      (await readFile(savedAttachment, "utf8")) === "HISTORY_SMOKE_ATTACHMENT",
      "Imported attachment bytes changed",
    );
    const after = await bridgeInvoke(client, "prepareHistoryImport", { sourcePath });
    assert(
      after.ok && after.value.newThreads === 0 && after.value.newProjects === 0,
      "Repeating import would duplicate history",
    );
    if (after.ok) await bridgeInvoke(client, "cancelHistoryImport", { token: after.value.token });
    await screenshot(client, join(outDir, "history-import-completed.png"));
    await writeFile(
      join(outDir, "history-import-verification.json"),
      JSON.stringify(
        {
          preparation: "Real IPC; native picker excluded",
          reviewed: true,
          cancelledWithoutChanges: true,
          imported,
          attachmentVerified: true,
          idempotent: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await evaluate(client, "window.__poracodeDev.closeSettings()");
  }
}
