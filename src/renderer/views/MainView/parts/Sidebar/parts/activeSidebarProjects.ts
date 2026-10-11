import { useShallow } from "zustand/shallow";
import { useAppStore } from "@/renderer/state/appStore";
import { useWorkspaceThreadFilter } from "@/renderer/state/workspaceSelectors";

/**
 * Projects the sidebar lists: those with at least one non-archived thread in
 * the active workspace. Projects without one stay reachable from the project
 * picker and the archive.
 */
export function useActiveThreadProjectIds(): ReadonlySet<string> {
  const isThreadVisible = useWorkspaceThreadFilter();
  const projectIds = useAppStore(
    useShallow((state) =>
      [
        ...new Set(
          state.threads
            .filter((thread) => !thread.archived && isThreadVisible(thread))
            .map((thread) => thread.projectId),
        ),
      ].sort(),
    ),
  );
  return new Set(projectIds);
}

export function useArchivedThreadCount(): number {
  const isThreadVisible = useWorkspaceThreadFilter();
  return useAppStore(
    (state) => state.threads.filter((thread) => thread.archived && isThreadVisible(thread)).length,
  );
}
