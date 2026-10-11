import { describe, expect, it } from "vitest";
import { promptDiffStats } from "./promptDiffStats";

describe("promptDiffStats", () => {
  it("counts hunk lines per file and ignores headers", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index 1..2 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,2 +1,3 @@",
      " keep",
      "-old",
      "+new",
      "+more",
      "diff --git a/b.bin b/b.bin",
      "Binary files a/b.bin and b/b.bin differ",
    ].join("\n");
    expect(Object.fromEntries(promptDiffStats(diff))).toEqual({
      "src/a.ts": { additions: 2, deletions: 1 },
      "b.bin": { additions: 0, deletions: 0 },
    });
  });
});
