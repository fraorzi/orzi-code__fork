import { Archive, ArchiveRestore, ChevronRight } from "lucide-react";
import { Button } from "@heroui/react";
import { useLingui } from "@lingui/react/macro";
import { useShallow } from "zustand/shallow";
import { useAppStore } from "@/renderer/state/appStore";
import { useSidebarUiStore } from "@/renderer/state/sidebarUiStore";
import { useWorkspaceThreadFilter } from "@/renderer/state/workspaceSelectors";
import { unarchiveThread } from "@/renderer/actions/threadActions";
import { SidebarButton } from "@/renderer/components/common/SidebarButton";
import { ThreadProviderIcon } from "@/renderer/components/providers/ThreadProviderIcon";

export function ProjectArchive({ projectId }: { projectId: string }) {
  const { t } = useLingui();
  const visibleInWorkspace = useWorkspaceThreadFilter();
  const threads = useAppStore(
    useShallow((s) =>
      s.threads.filter((thread) => thread.projectId === projectId && thread.archived),
    ),
  )
    .filter(visibleInWorkspace)
    .sort((a, b) => (b.archivedAt ?? b.updatedAt).localeCompare(a.archivedAt ?? a.updatedAt));
  const collapsed = useSidebarUiStore((s) => s.collapsedWorktrees[`archive:${projectId}`] ?? true);
  const toggle = useSidebarUiStore((s) => s.toggleWorktreeCollapsed);
  if (threads.length === 0) return null;
  return (
    <div className="mt-1 border-t border-[var(--hairline)] pt-1">
      <SidebarButton
        icon={<Archive className="size-3.5" />}
        label={
          <span className="flex items-center gap-1.5">
            {t`Archived Threads`}
            <span className="text-muted">{threads.length}</span>
            <ChevronRight className={`ml-auto size-3 ${collapsed ? "" : "rotate-90"}`} />
          </span>
        }
        onPress={() => toggle(`archive:${projectId}`)}
      />
      {!collapsed && (
        <div className="max-h-48 overflow-y-auto pl-4">
          {threads.map((thread) => (
            <div key={thread.id} className="flex items-center gap-2 py-1">
              <ThreadProviderIcon thread={thread} className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted" title={thread.title}>
                {thread.title}
              </span>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label={t`Restore`}
                onPress={() => unarchiveThread(thread.id)}
              >
                <ArchiveRestore className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
