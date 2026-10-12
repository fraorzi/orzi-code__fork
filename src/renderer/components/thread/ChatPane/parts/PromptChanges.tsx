import { useEffect, useId, useState } from "react";
import { Button, toast } from "@heroui/react";
import { ChevronDown, Redo2, TriangleAlert, Undo2 } from "lucide-react";
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
import { PromptChangesDisclosure } from "./PromptChangesDisclosure";
import {
  PromptChangesFile,
  PromptChangesLineCounts,
  type PromptDiffState,
} from "./PromptChangesFile";
import { promptDiffStats } from "./promptDiffStats";
import "./promptChanges.css";

/** Joins the prompt's changes onto the turn meta line ("6s · no file changes"). */
function MetaSeparator() {
  return (
    <span aria-hidden className="text-muted/60">
      ·
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
  const [diff, setDiff] = useState<PromptDiffState>({ kind: "loading" });
  const [states, setStates] = useState<ReadonlyMap<string, PromptFileChangeState>>(new Map());
  const reviewId = useId();
  const [expanded, setExpanded] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileDiffs, setFileDiffs] = useState<ReadonlyMap<string, PromptDiffState>>(new Map());
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
    setSelectedPath((current) => (current === path ? null : path));
    actions?.onContentHeightChange?.();
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
  const stateOf = (path: string) => states.get(path);
  const conflicts = changedFiles.filter((file) => stateOf(file.path) === "conflict");
  const appliedPaths = changedFiles
    .filter((file) => stateOf(file.path) === "applied")
    .map((file) => file.path);
  const allReverted =
    states.size > 0 && changedFiles.every((file) => stateOf(file.path) === "reverted");
  const cardClass =
    "lc-prompt-changes order-first mb-1 w-full basis-full rounded-[8px] border text-[13px] text-foreground";

  return (
    <div className={`${cardClass} border-[var(--hairline-strong)] bg-[var(--composer-surface)]`}>
      <div className="flex min-h-10 items-center gap-1 pr-2">
        <Button
          size="sm"
          variant="ghost"
          className="lc-prompt-summary h-auto min-h-10 min-w-0 flex-1 justify-start gap-2 px-3 py-1.5"
          aria-expanded={expanded}
          aria-controls={reviewId}
          aria-label={expanded ? t`Collapse` : t`Review`}
          onPress={() => {
            setExpanded(!expanded);
            actions?.onContentHeightChange?.();
          }}
        >
          <ChevronDown
            className={`lc-prompt-chevron size-3.5 shrink-0 text-muted ${expanded ? "" : "-rotate-90"}`}
          />
          <span className="font-medium">
            <Trans>Changes in this prompt</Trans>
          </span>
          <span className="text-muted/70">
            <Plural value={fileCount} one="# file" other="# files" />
          </span>
          <PromptChangesLineCounts stats={totals} />
          <span className="ml-auto text-xs text-muted">
            {expanded ? <Trans>Collapse</Trans> : <Trans>Review</Trans>}
          </span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-danger"
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
      <PromptChangesDisclosure id={reviewId} expanded={expanded}>
        <div className="border-t border-[var(--hairline)] p-1">
          {changedFiles.map((file) => (
            <PromptChangesFile
              key={file.path}
              path={file.path}
              state={stateOf(file.path)}
              stats={stats?.get(file.path)}
              diff={fileDiffs.get(file.path)}
              expanded={selectedPath === file.path}
              busy={busy}
              onSelect={() => selectFile(file.path)}
              onUndo={() => void undo([file.path])}
              onRestore={() => void redo([file.path])}
            />
          ))}
        </div>
      </PromptChangesDisclosure>
      {allReverted ? (
        <div className="flex min-h-10 flex-wrap items-center gap-2 border-t border-[var(--hairline)] py-1.5 pl-3 pr-2">
          <Undo2 className="size-3.5 text-muted" />
          <span className="text-xs text-muted">
            <Trans>Changes from this prompt were undone</Trans>
          </span>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="lc-prompt-restore"
            isDisabled={busy}
            onPress={() => void redo()}
          >
            <Redo2 className="size-3.5" />
            <Trans>Restore changes</Trans>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
