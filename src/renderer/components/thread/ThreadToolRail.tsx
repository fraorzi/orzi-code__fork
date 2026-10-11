import type { LucideIcon } from "lucide-react";
import { FileDiff, FolderOpen, NotebookPen, TerminalSquare } from "lucide-react";
import { Tooltip } from "@heroui/react";
import { useLingui } from "@lingui/react/macro";
import { isHomeProjectId } from "@/shared/homeScope";
import {
  closeAllPanels,
  openFilesPanel,
  openNotesPanel,
  showGitReviewPanel,
} from "@/renderer/actions/panelActions";
import { openTerminal, openWorktreeTerminal } from "@/renderer/actions/terminalActions";
import { useDevTerminalStore } from "@/renderer/state/devTerminalStore";
import { usePanelStore } from "@/renderer/state/panelStore";
import { useSharedSettings } from "@/renderer/state/sharedSettingsStore";

interface RailTool {
  id: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  activate: () => void;
}

/**
 * Thread header launchers for the thread-scoped right-panel tools (git,
 * files, terminal, notes) pointed at *this* thread's project + worktree.
 * Panel-wide tools that are not tied to a thread (usage, browser) stay in the
 * right panel header only.
 */
export function ThreadToolRail(props: { projectId: string; worktreePath?: string | undefined }) {
  const { t } = useLingui();
  const { projectId, worktreePath } = props;

  const rightPanelTab = usePanelStore((s) => s.rightPanelTab);
  const gitScoped = usePanelStore(
    (s) =>
      s.gitReviewAsPanel &&
      s.gitReviewContext?.projectId === projectId &&
      s.gitReviewContext?.worktreePath === worktreePath,
  );
  const filesScoped = usePanelStore(
    (s) =>
      s.filesPanelContext?.projectId === projectId &&
      s.filesPanelContext?.worktreePath === worktreePath,
  );
  const notesPanelOpen = usePanelStore((s) => s.notesPanelOpen);
  const terminalScoped = useDevTerminalStore(
    (s) =>
      s.isOpen &&
      s.activeProjectId === projectId &&
      (s.activeWorktreePath ?? undefined) === worktreePath,
  );
  const terminalOnRight = useSharedSettings((s) => s.terminalPosition === "right");

  // Home-scope "projects" have no repository or file root, matching the tabs
  // the right panel itself hides for that scope.
  const isHomeScope = isHomeProjectId(projectId);
  const gitActive = gitScoped && rightPanelTab === "git";
  const terminalActive = terminalScoped && (!terminalOnRight || rightPanelTab === "terminal");

  const tools: RailTool[] = [
    ...(isHomeScope
      ? []
      : [
          {
            id: "git",
            label: t`Git`,
            icon: FileDiff,
            active: gitActive,
            activate: () => {
              if (gitActive) {
                closeAllPanels();
                return;
              }
              showGitReviewPanel(projectId, worktreePath);
            },
          },
          {
            id: "files",
            label: t`Files`,
            icon: FolderOpen,
            active: filesScoped && rightPanelTab === "files",
            activate: () => openFilesPanel(projectId, worktreePath),
          },
        ]),
    {
      id: "terminal",
      label: t`Terminal`,
      icon: TerminalSquare,
      active: terminalActive,
      activate: () => {
        if (worktreePath) {
          openWorktreeTerminal(projectId, worktreePath);
          return;
        }
        openTerminal(projectId);
      },
    },
    {
      id: "notes",
      label: t`Notes`,
      icon: NotebookPen,
      active: notesPanelOpen && rightPanelTab === "notes",
      activate: openNotesPanel,
    },
  ];

  return (
    <div
      data-poracode-thread-tool-rail=""
      className="poracode-overlay-header__controls flex shrink-0 items-center gap-0.5"
    >
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <Tooltip key={tool.id} delay={150}>
            <Tooltip.Trigger>
              <button
                type="button"
                aria-label={tool.label}
                aria-pressed={tool.active}
                className={`flex size-[26px] items-center justify-center rounded-[6px] transition-colors ${
                  tool.active
                    ? "bg-[var(--row-active)] text-foreground"
                    : "text-muted hover:bg-[var(--row-hover)] hover:text-foreground"
                }`}
                onClick={tool.activate}
              >
                <Icon className="size-4" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content placement="bottom">{tool.label}</Tooltip.Content>
          </Tooltip>
        );
      })}
    </div>
  );
}
