import { ArchiveRestore, ChevronRight, Folder, Search } from "lucide-react";
import { Button, Input, TextField } from "@heroui/react";
import { useState } from "react";
import { useShallow } from "zustand/shallow";
import { Trans, useLingui } from "@lingui/react/macro";
import { isHomeProjectId } from "@/shared/homeScope";
import { openThread, restoreArchivedThread } from "@/renderer/actions/threadActions";
import { ThreadProviderIcon } from "@/renderer/components/providers/ThreadProviderIcon";
import { useAppStore } from "@/renderer/state/appStore";
import { useWorkspaceThreadFilter } from "@/renderer/state/workspaceSelectors";
import { SettingsPage } from "@/renderer/views/SettingsOverlay/parts/SettingsForm";
import { groupArchivedThreads } from "./groupArchivedThreads";

export function ArchiveView() {
  const { t, i18n } = useLingui();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const isThreadVisible = useWorkspaceThreadFilter();
  const archivedThreads = useAppStore(
    useShallow((state) => state.threads.filter((thread) => thread.archived)),
  ).filter(isThreadVisible);
  const projects = useAppStore((state) => state.projects);
  const groups = groupArchivedThreads(archivedThreads, query);
  const dateFormatter = new Intl.DateTimeFormat(i18n.locale, { day: "2-digit", month: "2-digit" });

  function toggleGroup(projectId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  return (
    <SettingsPage
      title={t`Archive`}
      description={t`Archived threads open read-only. Restore one to bring it back to the sidebar.`}
      bodyClassName="space-y-4"
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 z-10 size-3.5 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <TextField aria-label={t`Search archive`} value={query} onChange={setQuery}>
          <Input className="pl-9" placeholder={t`Search archive`} />
        </TextField>
      </div>
      {groups.length === 0 ? (
        <p className="px-1 text-sm text-muted">
          {archivedThreads.length === 0 ? (
            <Trans>No archived threads.</Trans>
          ) : (
            <Trans>No archived threads match your search.</Trans>
          )}
        </p>
      ) : (
        <div className="space-y-1">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.projectId);
            const projectName = isHomeProjectId(group.projectId)
              ? t`Home`
              : (projects.find((project) => project.id === group.projectId)?.name ??
                t`Unknown project`);
            return (
              <section key={group.projectId}>
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  className="flex h-7 w-full items-center gap-2 rounded-[6px] px-2 text-left text-[13px] font-medium text-foreground outline-none transition-colors hover:bg-[var(--row-hover)] focus-visible:focus-ring"
                  onClick={() => toggleGroup(group.projectId)}
                >
                  <ChevronRight
                    className={`size-3.5 shrink-0 text-muted transition-transform ${
                      isCollapsed ? "" : "rotate-90"
                    }`}
                  />
                  <Folder className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{projectName}</span>
                  <span className="font-mono text-[11px] text-muted/70">
                    {group.threads.length}
                  </span>
                </button>
                {isCollapsed ? null : (
                  <div className="pb-1">
                    {group.threads.map((thread) => (
                      <div
                        key={thread.id}
                        className="group flex h-7 items-center gap-2 rounded-[6px] pr-1 pl-[30px] text-[13px] text-muted transition-colors hover:bg-[var(--row-hover)] hover:text-foreground"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:focus-ring"
                          onClick={() => openThread(thread.id, { focusComposer: false })}
                        >
                          <ThreadProviderIcon thread={thread} className="size-3.5 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                        </button>
                        <span className="font-mono text-[11px] text-muted/70 group-hover:hidden">
                          {dateFormatter.format(new Date(thread.archivedAt ?? thread.updatedAt))}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hidden h-6 min-w-0 gap-1 rounded-[6px] px-2 text-xs group-hover:inline-flex focus-visible:inline-flex"
                          onPress={() => restoreArchivedThread(thread.id)}
                        >
                          <ArchiveRestore className="size-3.5" />
                          <Trans>Restore</Trans>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </SettingsPage>
  );
}
