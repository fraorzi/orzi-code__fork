import type { Thread } from "@/shared/contracts";

export interface ArchivedProjectGroup {
  projectId: string;
  threads: Thread[];
}

function archivedAt(thread: Thread): string {
  return thread.archivedAt ?? thread.updatedAt;
}

/**
 * Archived threads matching `query`, grouped by project. Threads are newest
 * archived first, and groups follow their most recently archived thread.
 */
export function groupArchivedThreads(
  threads: readonly Thread[],
  query: string,
): ArchivedProjectGroup[] {
  const needle = query.trim().toLowerCase();
  const groups = new Map<string, Thread[]>();
  for (const thread of [...threads].sort((a, b) => archivedAt(b).localeCompare(archivedAt(a)))) {
    if (!thread.archived) continue;
    if (needle && !thread.title.toLowerCase().includes(needle)) continue;
    const group = groups.get(thread.projectId);
    if (group) group.push(thread);
    else groups.set(thread.projectId, [thread]);
  }
  return [...groups].map(([projectId, groupThreads]) => ({ projectId, threads: groupThreads }));
}
