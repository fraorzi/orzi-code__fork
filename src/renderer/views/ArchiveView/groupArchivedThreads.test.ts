import { describe, expect, it } from "vitest";
import type { Thread } from "@/shared/contracts";
import { groupArchivedThreads } from "./groupArchivedThreads";

function thread(id: string, projectId: string, archivedAt: string, title = id): Thread {
  return {
    id,
    projectId,
    title,
    archived: true,
    archivedAt,
    updatedAt: archivedAt,
  } as Thread;
}

describe("groupArchivedThreads", () => {
  it("groups by project, newest archived first", () => {
    const groups = groupArchivedThreads(
      [
        thread("a", "p1", "2026-10-01T10:00:00Z"),
        thread("b", "p2", "2026-10-03T10:00:00Z"),
        thread("c", "p1", "2026-10-02T10:00:00Z"),
      ],
      "",
    );
    expect(groups.map((group) => group.projectId)).toEqual(["p2", "p1"]);
    expect(groups[1]!.threads.map((item) => item.id)).toEqual(["c", "a"]);
  });

  it("filters by title and skips active threads", () => {
    const active = { ...thread("d", "p1", "2026-10-04T10:00:00Z", "Plan Q4"), archived: false };
    const groups = groupArchivedThreads(
      [
        thread("a", "p1", "2026-10-01T10:00:00Z", "Plan Q4"),
        thread("b", "p2", "2026-10-03T10:00:00Z"),
        active,
      ],
      "plan",
    );
    expect(groups).toEqual([{ projectId: "p1", threads: [expect.objectContaining({ id: "a" })] }]);
  });
});
