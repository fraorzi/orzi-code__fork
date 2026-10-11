import { useEffect, useState } from "react";
import { Button, toast } from "@heroui/react";
import { FileDiff, FileText, RotateCcw, TriangleAlert, Undo2 } from "lucide-react";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import type {
  FileCheckpointChangedFile,
  ProjectLocation,
  PromptChangesStatusResult,
  PromptFileChangeState,
} from "@/shared/contracts";
import { friendlyError } from "@/shared/messages";
import { resolveProjectLocation } from "@/shared/worktree";
import { readBridge } from "@/renderer/bridge";
import { useAppStore } from "@/renderer/state/appStore";
import { useChatPaneActions } from "../chatPaneActionsContext";
import { LazyInlineDiffView } from "./items/LazyInlineDiffView";
import { promptDiffStats, type DiffLineStats } from "./promptDiffStats";

type DiffState = { kind: "loading" | "error" } | { kind: "ready"; diff: string };

/** Joins the prompt's changes onto the turn meta line ("6s · no file changes"). */
function MetaSeparator() {
  return (
    <span aria-hidden className="text-muted/60">
      ·
    </span>
  );
}

function LineCounts(props: { stats: DiffLineStats | undefined }) {
  if (!props.stats) return null;
  return (
    <span className="shrink-0 font-mono text-[11px]">
      <span className="text-success">+{props.stats.additions}</span>{" "}
      <span className="text-danger">-{props.stats.deletions}</span>
    </span>
  );
}

/** What one prompt changed, reviewable per file and undoable without touching the conversation. */
export function PromptChanges({
  threadId,
  checkpointItemId,
}: {
  threadId: string;
  checkpointItemId: string;
}) {
  const checkpoint = useAppStore(
    (state) => state.fileCheckpointTurnsByThread[threadId]?.[checkpointItemId],
  );
  const thread = useAppStore((state) => state.threads.find((entry) => entry.id === threadId));
  const project = useAppStore((state) =>
    state.projects.find((entry) => entry.id === thread?.projectId),
  );
  if (!checkpoint || !thread || !project || thread.remoteServerId) return null;
  if (checkpoint.changedFiles.length === 0) {
    return (
      <>
        <MetaSeparator />
        <span className="text-foreground-muted">
          <Trans>no file changes</Trans>
        </span>
      </>
    );
  }
  return (
    <PromptChangesCard
      threadId={threadId}
      checkpointItemId={checkpointItemId}
      changedFiles={checkpoint.changedFiles}
      projectLocation={resolveProjectLocation(project.location, thread.worktreePath)}
    />
  );
}

function PromptChangesCard(props: {
  threadId: string;
  checkpointItemId: string;
  changedFiles: readonly FileCheckpointChangedFile[];
  projectLocation: ProjectLocation;
}) {
  const { threadId, checkpointItemId, changedFiles, projectLocation } = props;
  const { t } = useLingui();
  const actions = useChatPaneActions();
  const [diff, setDiff] = useState<DiffState>({ kind: "loading" });
  const [states, setStates] = useState<ReadonlyMap<string, PromptFileChangeState>>(new Map());
  const [expanded, setExpanded] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileDiffs, setFileDiffs] = useState<ReadonlyMap<string, DiffState>>(new Map());
  const [busy, setBusy] = useState(false);
  const payload = { threadId, checkpointItemId, projectLocation };

  const applyStatus = (result: PromptChangesStatusResult) =>
    setStates(new Map(result.files.map((file) => [file.path, file.state])));

  useEffect(() => {
    let cancelled = false;
    const request = { threadId, checkpointItemId, projectLocation };
    const bridge = readBridge();
    void bridge
      .getFileCheckpointDiff(request)
      .then((result) => !cancelled && setDiff({ kind: "ready", diff: result.diff }))
      .catch(() => !cancelled && setDiff({ kind: "error" }));
    void bridge
      .getPromptChangesStatus(request)
      .then((result) => {
        if (!cancelled) setStates(new Map(result.files.map((file) => [file.path, file.state])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [threadId, checkpointItemId, projectLocation]);

  async function run(action: () => Promise<PromptChangesStatusResult>) {
    setBusy(true);
    try {
      applyStatus(await action());
    } catch (error) {
      toast.danger(friendlyError(error));
      try {
        applyStatus(await readBridge().getPromptChangesStatus(payload));
      } catch {
        // The toast already reports the failure; keep the last known states.
      }
    } finally {
      setBusy(false);
    }
  }
  const undo = (paths?: string[]) =>
    run(() => readBridge().revertPromptChanges({ ...payload, ...(paths ? { paths } : {}) }));
  const redo = (paths?: string[]) =>
    run(() => readBridge().reapplyPromptChanges({ ...payload, ...(paths ? { paths } : {}) }));

  function selectFile(path: string) {
    setSelectedPath(path);
    if (fileDiffs.has(path)) return;
    setFileDiffs((current) => new Map(current).set(path, { kind: "loading" }));
    void readBridge()
      .getFileCheckpointDiff({ ...payload, filePath: path })
      .then((result) =>
        setFileDiffs((current) => new Map(current).set(path, { kind: "ready", diff: result.diff })),
      )
      .catch(() => setFileDiffs((current) => new Map(current).set(path, { kind: "error" })));
  }

  const stats = diff.kind === "ready" ? promptDiffStats(diff.diff) : undefined;
  const totals = stats
    ? [...stats.values()].reduce(
        (sum, entry) => ({
          additions: sum.additions + entry.additions,
          deletions: sum.deletions + entry.deletions,
        }),
        { additions: 0, deletions: 0 },
      )
    : undefined;
  const fileCount = changedFiles.length;
  const selectedDiff = selectedPath ? fileDiffs.get(selectedPath) : undefined;
  const stateOf = (path: string) => states.get(path);
  const conflicts = changedFiles.filter((file) => stateOf(file.path) === "conflict");
  const appliedPaths = changedFiles
    .filter((file) => stateOf(file.path) === "applied")
    .map((file) => file.path);
  const allReverted =
    states.size > 0 && changedFiles.every((file) => stateOf(file.path) === "reverted");
  const cardClass =
    "order-first mb-1 w-full basis-full rounded-[8px] border text-[13px] text-foreground";

  if (allReverted) {
    return (
      <div className={`${cardClass} border-dashed border-[var(--hairline-strong)]`}>
        <div className="flex min-h-10 flex-wrap items-center gap-2 py-1.5 pl-3 pr-2">
          <Undo2 className="size-3.5 text-muted" />
          <span className="font-medium text-muted">
            <Trans>Changes from this prompt were undone</Trans>
          </span>
          <span className="text-muted/70">
            <Plural value={fileCount} one="# file restored" other="# files restored" />
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => void redo()}>
            <RotateCcw className="size-3.5" />
            <Trans>Restore changes</Trans>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardClass} border-[var(--hairline-strong)] bg-[var(--composer-surface)]`}>
      <div className="flex min-h-10 flex-wrap items-center gap-2 py-1.5 pl-3 pr-2">
        <FileDiff className="size-3.5 text-muted" />
        <span className="font-medium">
          <Trans>Changes in this prompt</Trans>
        </span>
        <span className="text-muted/70">
          <Plural value={fileCount} one="# file" other="# files" />
        </span>
        <LineCounts stats={totals} />
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={expanded}
          onPress={() => setExpanded(!expanded)}
        >
          {expanded ? <Trans>Collapse</Trans> : <Trans>Review</Trans>}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={busy || conflicts.length > 0 || appliedPaths.length === 0}
          onPress={() => void undo()}
        >
          <Undo2 className="size-3.5" />
          <Trans>Undo</Trans>
        </Button>
      </div>
      {conflicts.length > 0 ? (
        <div className="mx-2 mb-2 flex flex-wrap items-center gap-2 rounded-[6px] bg-warning/10 px-2.5 py-2 text-xs text-muted">
          <TriangleAlert className="size-3.5 shrink-0 text-warning" />
          <span className="min-w-0 flex-[1_1_16rem]">
            {t`${conflicts.map((file) => file.path).join(", ")} changed after this prompt. Undoing everything would overwrite those edits.`}
          </span>
          {appliedPaths.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              isDisabled={busy}
              onPress={() => void undo(appliedPaths)}
            >
              <Trans>Undo the other files</Trans>
            </Button>
          ) : null}
        </div>
      ) : null}
      {expanded ? (
        <>
          <div className="border-t border-[var(--hairline)] p-1">
            {changedFiles.map((file) => {
              const state = stateOf(file.path);
              const slash = file.path.lastIndexOf("/");
              return (
                <div
                  key={file.path}
                  className={`group flex h-[30px] items-center gap-2 rounded-[6px] px-2 text-[12.5px] ${
                    selectedPath === file.path
                      ? "bg-[var(--row-active)]"
                      : "hover:bg-[var(--row-hover)]"
                  }`}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:focus-ring"
                    onClick={() => selectFile(file.path)}
                  >
                    <FileText className="size-3.5 shrink-0 text-muted" />
                    <span
                      className={`min-w-0 truncate ${state === "reverted" ? "text-muted line-through" : ""}`}
                    >
                      <span className="text-muted">{file.path.slice(0, slash + 1)}</span>
                      {file.path.slice(slash + 1)}
                    </span>
                    {state === "conflict" ? (
                      <TriangleAlert
                        className="size-3.5 shrink-0 text-warning"
                        aria-label={t`Changed after this prompt`}
                      />
                    ) : null}
                  </button>
                  <LineCounts stats={stats?.get(file.path)} />
                  <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {actions?.openProjectRelativePath && state !== "reverted" ? (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={t`Open ${file.path}`}
                        className="size-6 min-w-0"
                        onPress={() => void actions.openProjectRelativePath?.(file.path)}
                      >
                        <FileText className="size-3.5" />
                      </Button>
                    ) : null}
                    {state === "applied" ? (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={t`Undo ${file.path}`}
                        className="size-6 min-w-0"
                        isDisabled={busy}
                        onPress={() => void undo([file.path])}
                      >
                        <Undo2 className="size-3.5" />
                      </Button>
                    ) : state === "reverted" ? (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={t`Restore ${file.path}`}
                        className="size-6 min-w-0"
                        isDisabled={busy}
                        onPress={() => void redo([file.path])}
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
          {selectedPath ? (
            <div className="min-w-0 border-t border-[var(--hairline)] p-2">
              {selectedDiff?.kind === "ready" ? (
                <LazyInlineDiffView diffText={selectedDiff.diff} filePath={selectedPath} />
              ) : selectedDiff?.kind === "error" ? (
                <span className="text-xs text-muted">
                  <Trans>Could not load this diff.</Trans>
                </span>
              ) : (
                <span className="text-xs text-muted">
                  <Trans>Loading...</Trans>
                </span>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
