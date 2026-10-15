import { ChevronRight, House, Plus } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { Project } from "@/shared/contracts";
import { openNewThread } from "@/renderer/actions/threadActions";
import { openTerminal } from "@/renderer/actions/terminalActions";
import { SidebarButton } from "@/renderer/components/common/SidebarButton";
import { AnimatedTerminalIcon } from "@/renderer/components/common/AnimatedTerminalIcon";
import {
  useIsProjectTerminalActive,
  useIsProjectTerminalBusy,
  useIsProjectTerminalOpen,
} from "@/renderer/hooks/uiSelectors";
import { useSidebarUiStore } from "@/renderer/state/sidebarUiStore";
import { SidebarPanelDragButton } from "./SidebarPanelDragButton";
import { SidebarProjectThreadList } from "./SidebarProjectThreadList";
import type { ThreadSortMode } from "./sortMode";

function HomeTerminalButton(props: { projectId: string; projectName: string }) {
  const { t } = useLingui();
  const hasTerminal = useIsProjectTerminalOpen(props.projectId);
  const isActiveTerminal = useIsProjectTerminalActive(props.projectId);
  const isBusy = useIsProjectTerminalBusy(props.projectId);
  // Match thread / project-header collapse so idle home terminal does not
  // reserve row width for the project title.
  const hiddenPanelButtonClass =
    "w-0 -mr-[3px] overflow-hidden p-0 opacity-0 pointer-events-none group-hover:w-[18px] group-hover:mr-0 group-hover:p-0.5 group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:w-[18px] focus-visible:mr-0 focus-visible:p-0.5 focus-visible:opacity-100 focus-visible:pointer-events-auto";
  return (
    <SidebarPanelDragButton
      panel="terminal"
      projectId={props.projectId}
      ariaLabel={t`Terminal for ${props.projectName}`}
      className={`flex h-[18px] shrink-0 cursor-grab items-center justify-center rounded transition-[opacity,color,background-color] hover:bg-[var(--row-hover)] hover:text-foreground active:cursor-grabbing ${
        isActiveTerminal
          ? "w-[18px] p-0.5 text-accent"
          : hasTerminal
            ? "w-[18px] p-0.5 text-foreground"
            : `text-muted/60 ${hiddenPanelButtonClass}`
      }`}
      onPress={() => openTerminal(props.projectId)}
    >
      <AnimatedTerminalIcon className="size-3.5" isBusy={isBusy} />
    </SidebarPanelDragButton>
  );
}

export function SidebarHomeSection(props: { project: Project; sortMode: ThreadSortMode }) {
  const { t } = useLingui();
  const isCollapsed = useSidebarUiStore((s) => s.collapsedProjects[props.project.id] ?? false);
  const toggleProjectCollapsed = useSidebarUiStore((s) => s.toggleProjectCollapsed);
  const projectName = t`Home`;
  return (
    <section className="space-y-0.5">
      <SidebarButton
        icon={
          <ChevronRight
            className={`size-3.5 shrink-0 text-muted transition-transform ${isCollapsed ? "" : "rotate-90"}`}
          />
        }
        label={
          <span className="flex items-center gap-1.5">
            <House className="size-3.5 shrink-0 text-muted" />
            <span className="truncate text-xs font-semibold text-foreground">{projectName}</span>
          </span>
        }
        className="poracode-sidebar-project-nudge !pl-1"
        onPress={() => toggleProjectCollapsed(props.project.id)}
        suffix={
          <>
            <div
              role="button"
              tabIndex={0}
              aria-label={t`New thread in ${projectName}`}
              className="flex h-[18px] w-[18px] shrink-0 cursor-default items-center justify-center rounded p-0.5 text-muted/60 transition-colors hover:bg-[var(--row-hover)] hover:text-foreground focus-visible:focus-ring"
              onClick={(event) => {
                event.stopPropagation();
                openNewThread(props.project.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  openNewThread(props.project.id);
                }
              }}
            >
              <Plus className="size-3.5" />
            </div>
            <HomeTerminalButton projectId={props.project.id} projectName={projectName} />
          </>
        }
      />
      {isCollapsed ? null : (
        <SidebarProjectThreadList project={props.project} sortMode={props.sortMode} />
      )}
    </section>
  );
}
