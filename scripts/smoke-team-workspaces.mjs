import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Real IPC, Git cleanup and confirmation controls, restricted to the smoke fixture. */
export async function teamWorkspacesScenario({
  client,
  evaluate,
  bridgeInvoke,
  waitForValue,
  screenshot,
  outDir,
}) {
  const session = JSON.parse(await readFile(join(dirname(outDir), "session.json"), "utf8"));
  const runId = "f00df00df00d";
  const directory = join(session.baseDir, "team-worktrees", runId);
  const root = join(directory, "worktree");
  const git = async (...args) =>
    (await exec("git", args, { cwd: session.projectDir })).stdout.trim();
  const baselineRef = `refs/poracode-team/${runId}/baseline`;
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  await mkdir(directory, { recursive: true });
  const baselineTree = await git("rev-parse", "HEAD^{tree}");
  await git("update-ref", baselineRef, baselineTree);
  await git("worktree", "add", "--detach", root, "HEAD");
  await writeFile(
    join(directory, "workspace.json"),
    JSON.stringify({
      version: 1,
      runId,
      parentRoot: session.projectDir,
      root,
      projectPath: root,
      baselineTree,
      baselineRef,
      patchPath: join(directory, "changes.patch"),
    }),
  );
  try {
    const saved = await bridgeInvoke(client, "getTeamWorkspaces");
    assert(
      saved.some((entry) => entry.runId === runId && entry.state === "retained"),
      "Legacy workspace missing from supervisor IPC",
    );
    let rejected = false;
    try {
      await bridgeInvoke(client, "cleanupTeamWorkspace", { runId, discardChanges: false });
    } catch {
      rejected = true;
    }
    assert(rejected, "Unintegrated workspace was removed without explicit discard");
    await evaluate(client, 'window.__poracodeDev.openSettings("mcpServers")');
    await waitForValue(
      () =>
        evaluate(
          client,
          "Boolean(document.querySelector('button[aria-label=\"Crossagent routing and ranking\"]'))",
        ),
      Boolean,
      "Crossagents settings action",
    );
    await evaluate(
      client,
      "document.querySelector('button[aria-label=\"Crossagent routing and ranking\"]').click()",
    );
    await waitForValue(
      () =>
        evaluate(
          client,
          'document.querySelector(\'[data-testid="team-workspaces"]\')?.innerText.includes("Unintegrated")',
        ),
      Boolean,
      "Retained team workspace row",
    );
    await evaluate(
      client,
      'Array.from(document.querySelectorAll(\'[data-testid="team-workspaces"] button\')).find(button => button.innerText === "Remove").click()',
    );
    await waitForValue(
      () => evaluate(client, 'document.body.innerText.includes("Discard unintegrated work?")'),
      Boolean,
      "Discard confirmation",
    );
    await evaluate(
      client,
      `document.getAnimations().forEach(animation => {
        if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) animation.finish();
      })`,
    );
    await screenshot(client, join(outDir, "team-workspace-discard-confirmation.png"));
    await evaluate(
      client,
      'Array.from(document.querySelectorAll(\'[role="alertdialog"] button\')).find(button => button.innerText === "Cancel").click()',
    );
    assert(
      (await bridgeInvoke(client, "getTeamWorkspaces")).some((entry) => entry.runId === runId),
      "Cancelling discard removed saved work",
    );
    await writeFile(
      join(directory, "integration.json"),
      JSON.stringify({ version: 1, state: "no_changes", files: [] }),
    );
    await evaluate(
      client,
      'Array.from(document.querySelectorAll(\'[data-testid="team-workspaces"] button\')).find(button => button.innerText === "Refresh").click()',
    );
    await waitForValue(
      () =>
        evaluate(
          client,
          'document.querySelector(\'[data-testid="team-workspaces"]\')?.innerText.includes("Integrated")',
        ),
      Boolean,
      "Integrated workspace state",
    );
    await screenshot(client, join(outDir, "team-workspace-integrated.png"));
    await evaluate(
      client,
      'Array.from(document.querySelectorAll(\'[data-testid="team-workspaces"] button\')).find(button => button.innerText === "Remove").click()',
    );
    await waitForValue(
      () => bridgeInvoke(client, "getTeamWorkspaces"),
      (entries) => entries.every((entry) => entry.runId !== runId),
      "Workspace cleanup IPC",
    );
    assert(
      !(await git("worktree", "list", "--porcelain")).includes(root),
      "Git retained the deleted worktree registration",
    );
    assert(
      (await git("for-each-ref", baselineRef)) === "",
      "Git retained the deleted snapshot ref",
    );
    await screenshot(client, join(outDir, "team-workspace-cleaned.png"));
  } finally {
    await evaluate(client, "window.__poracodeDev.closeSettings()");
    await git("worktree", "remove", "--force", root).catch(() => {});
    await git("update-ref", "-d", baselineRef);
    await rm(directory, { recursive: true, force: true });
  }
}
