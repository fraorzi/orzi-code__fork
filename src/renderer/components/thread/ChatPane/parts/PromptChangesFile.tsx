import { useId } from "react";
import { Button, Tooltip } from "@heroui/react";
import { ChevronDown, FileText, Redo2, TriangleAlert, Undo2 } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { PromptFileChangeState } from "@/shared/contracts";
import { useChatPaneActions } from "../chatPaneActionsContext";
import { LazyInlineDiffView } from "./items/LazyInlineDiffView";
import { PromptChangesDisclosure } from "./PromptChangesDisclosure";
import type { DiffLineStats } from "./promptDiffStats";

export type PromptDiffState = { kind: "loading" | "error" } | { kind: "ready"; diff: string };

export function PromptChangesLineCounts(props: { stats: DiffLineStats | undefined }) {
  if (!props.stats) return null;
  return (
    <span className="shrink-0 font-mono text-[11px]">
      <span className="text-success">+{props.stats.additions}</span>{" "}
      <span className="text-danger">-{props.stats.deletions}</span>
    </span>
  );
}

export function PromptChangesFile(props: {
  path: string;
  state: PromptFileChangeState | undefined;
  stats: DiffLineStats | undefined;
  diff: PromptDiffState | undefined;
  expanded: boolean;
  busy: boolean;
  onSelect: () => void;
  onUndo: () => void;
  onRestore: () => void;
}) {
  const { t } = useLingui();
  const actions = useChatPaneActions();
  const diffId = useId();
  const slash = props.path.lastIndexOf("/");
  return (
    <div className="lc-prompt-file">
      <div className="group flex min-h-8 items-center gap-1 pr-1">
        <Button
          variant="ghost"
          size="sm"
          className={`lc-prompt-file-trigger min-w-0 flex-1 justify-start gap-2 px-2 text-[12.5px] ${props.expanded ? "bg-[var(--row-active)]" : ""}`}
          aria-expanded={props.expanded}
          aria-controls={diffId}
          aria-label={props.path}
          onPress={props.onSelect}
        >
          <ChevronDown
            className={`lc-prompt-chevron size-3 shrink-0 text-muted ${props.expanded ? "" : "-rotate-90"}`}
          />
          <FileText className="size-3.5 shrink-0 text-muted" />
          <span
            className={`min-w-0 flex-1 truncate text-left ${props.state === "reverted" ? "text-muted line-through" : ""}`}
          >
            <span className="text-muted">{props.path.slice(0, slash + 1)}</span>
            {props.path.slice(slash + 1)}
          </span>
          {props.state === "conflict" ? (
            <Tooltip delay={180}>
              <Tooltip.Trigger>
                <TriangleAlert
                  className="size-3.5 shrink-0 text-warning"
                  aria-label={t`Changed after this prompt`}
                />
              </Tooltip.Trigger>
              <Tooltip.Content>{t`Changed after this prompt`}</Tooltip.Content>
            </Tooltip>
          ) : null}
          <PromptChangesLineCounts stats={props.stats} />
        </Button>
        <span className="flex shrink-0 gap-0.5">
          {actions?.openProjectRelativePath && props.state !== "reverted" ? (
            <Tooltip delay={180}>
              <Tooltip.Trigger>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={t`Open ${props.path}`}
                  className="size-6 min-w-0"
                  onPress={() => void actions.openProjectRelativePath?.(props.path)}
                >
                  <FileText className="size-3.5" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>{t`Open ${props.path}`}</Tooltip.Content>
            </Tooltip>
          ) : null}
          {props.state === "applied" || props.state === "reverted" ? (
            <Tooltip delay={180}>
              <Tooltip.Trigger>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={
                    props.state === "reverted" ? t`Restore ${props.path}` : t`Undo ${props.path}`
                  }
                  className="size-6 min-w-0"
                  isDisabled={props.busy}
                  onPress={props.state === "reverted" ? props.onRestore : props.onUndo}
                >
                  {props.state === "reverted" ? (
                    <Redo2 className="size-3.5" />
                  ) : (
                    <Undo2 className="size-3.5" />
                  )}
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>
                {props.state === "reverted" ? t`Restore ${props.path}` : t`Undo ${props.path}`}
              </Tooltip.Content>
            </Tooltip>
          ) : null}
        </span>
      </div>
      <PromptChangesDisclosure id={diffId} expanded={props.expanded} animateContentChanges>
        <div className="min-w-0 border-t border-[var(--hairline)] p-2">
          {props.diff?.kind === "ready" ? (
            <LazyInlineDiffView diffText={props.diff.diff} filePath={props.path} />
          ) : props.diff?.kind === "error" ? (
            <span className="text-xs text-muted">
              <Trans>Could not load this diff.</Trans>
            </span>
          ) : (
            <span className="text-xs text-muted">
              <Trans>Loading...</Trans>
            </span>
          )}
        </div>
      </PromptChangesDisclosure>
    </div>
  );
}
