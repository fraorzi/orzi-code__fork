import { useState, type ReactNode } from "react";
import { Dropdown, Label } from "@heroui/react";
import { ChevronsUpDown } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { WorkspaceIcon } from "@/renderer/components/workspace/WorkspaceIcon";
import {
  parseWorkspaceMenuKey,
  workspaceMenuKey,
} from "@/renderer/components/workspace/workspaceMenuKeys";
import {
  SidebarButton,
  sidebarIconButtonClass,
  sidebarRowClass,
} from "@/renderer/components/common/SidebarButton";
import { useSharedSettings } from "@/renderer/state/sharedSettingsStore";
import { useActiveWorkspaceId, useWorkspaceStore } from "@/renderer/state/workspaceStore";
interface MenuEntry {
  key: string;
  label: string;
  icon: ReactNode;
  /** Only workspace rows carry a selected state. */
  isSelected?: boolean;
}

/**
 * Switches which workspace the sidebar (and the schedules / pull-request views)
 * is scoped to. Lives at the top of the sidebar footer nav so it reads as
 * ambient context for the navigation below it rather than another destination.
 */
export function SidebarWorkspaceSwitcher(props: { iconOnly?: boolean }) {
  const { iconOnly = false } = props;
  const { t } = useLingui();
  const workspaces = useSharedSettings((state) => state.workspaces);
  const activeWorkspaceId = useActiveWorkspaceId();
  const [isOpen, setIsOpen] = useState(false);

  // With fewer than two workspaces there is nothing to switch, so keep the
  // footer uncluttered instead of showing a dead context row.
  if (workspaces.length < 2) return null;

  // `useActiveWorkspaceId` falls back to the first workspace, so this resolves.
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0]!;
  function handleAction(key: string) {
    setIsOpen(false);
    const selection = parseWorkspaceMenuKey(key);
    if (selection?.kind === "workspace") {
      useWorkspaceStore.getState().setActiveWorkspaceId(selection.workspaceId);
    }
  }
  const workspaceEntries: MenuEntry[] = workspaces.map((workspace) => ({
    key: workspaceMenuKey(workspace.id),
    label: workspace.name,
    icon: <WorkspaceIcon icon={workspace.icon} className="size-4 text-muted" />,
    isSelected: workspace.id === active.id,
  }));

  // Icon mode (collapsed footer nav): just the active workspace's icon; the
  // button chrome supplies the muted/hover color.
  const triggerContent = iconOnly ? (
    <WorkspaceIcon icon={active.icon} className="size-4" />
  ) : (
    <>
      <span className="flex size-4 shrink-0 items-center justify-center">
        <WorkspaceIcon icon={active.icon} className="size-4 text-muted" />
      </span>
      <div className="min-w-0">
        <span className="block truncate text-left">{active.name}</span>
      </div>
      {workspaces.length > 1 ? (
        <span className="flex shrink-0 items-center">
          <ChevronsUpDown className="size-3.5 text-muted" />
        </span>
      ) : null}
    </>
  );
  if (workspaces.length === 2) {
    const nextWorkspace = workspaces.find((workspace) => workspace.id !== active.id)!;
    const switchToNext = () => useWorkspaceStore.getState().setActiveWorkspaceId(nextWorkspace.id);
    if (iconOnly) {
      // iconOnly exists for the collapsed footer nav (a bottom icon row), so

      return (
        <SidebarButton
          iconOnly
          icon={triggerContent}
          label={t`Switch workspace`}
          tooltip={
            <span>
              {active.name}
              <span className="text-muted"> — {t`Switch workspace`}</span>
            </span>
          }
          tooltipPlacement="top"
          onPress={switchToNext}
        />
      );
    }
    return (
      <button
        type="button"
        aria-label={t`Switch workspace`}
        className={sidebarRowClass()}
        onClick={switchToNext}
      >
        {triggerContent}
      </button>
    );
  }
  return (
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      <Dropdown.Trigger
        aria-label={t`Switch workspace`}
        className={iconOnly ? sidebarIconButtonClass() : sidebarRowClass()}
      >
        {triggerContent}
      </Dropdown.Trigger>
      <Dropdown.Popover placement="top start">
        <Dropdown.Menu
          aria-label={t`Workspaces`}
          className="poracode-menu min-w-56"
          selectionMode="single"
          selectedKeys={[workspaceMenuKey(active.id)]}
          onAction={(key) => handleAction(String(key))}
        >
          <Dropdown.Section>
            {workspaceEntries.map((entry) => (
              <Dropdown.Item key={entry.key} id={entry.key} textValue={entry.label}>
                {entry.icon}
                <Label>{entry.label}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
