import { useState } from "react";
import { Button } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { readBridge } from "@/renderer/bridge";
import { useAppStore } from "@/renderer/state/appStore";
import { resolveProjectLocation } from "@/shared/worktree";
import { LazyInlineDiffView } from "./items/LazyInlineDiffView";

type DiffState = { kind: "empty" | "loading" | "error" } | { kind: "ready"; diff: string };

/** An immutable before/after comparison for one completed prompt. */
/** Joins the prompt's changes onto the turn meta line ("6s · no file changes"). */
function MetaSeparator() {
  return (
    <span aria-hidden className="text-muted/60">
      ·
    </span>
  );
}

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
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<DiffState>({ kind: "empty" });
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
    <>
      <MetaSeparator />
      <Button
        size="sm"
        variant="ghost"
        className="h-auto min-w-0 px-1 py-0 text-[length:inherit] text-foreground-muted hover:text-foreground"
        aria-expanded={expanded}
        onPress={() => {
          setExpanded(!expanded);
          if (expanded || result.kind === "ready" || result.kind === "loading") return;
          setResult({ kind: "loading" });
          void readBridge()
            .getFileCheckpointDiff({
              threadId,
              checkpointItemId,
              projectLocation: resolveProjectLocation(project.location, thread.worktreePath),
            })
            .then((response) => setResult({ kind: "ready", diff: response.diff }))
            .catch(() => setResult({ kind: "error" }));
        }}
      >
        <Trans>Changes in this prompt</Trans> ({checkpoint.changedFiles.length})
      </Button>
      {expanded && (
        <div className="mt-1 w-full min-w-0 basis-full rounded-lg border border-default p-3">
          {result.kind === "loading" && <Trans>Loading...</Trans>}
          {result.kind === "error" && <Trans>Could not load this diff.</Trans>}
          {result.kind === "ready" && (
            <LazyInlineDiffView diffText={result.diff} filePath="" showFileNames />
          )}
        </div>
      )}
    </>
  );
}
