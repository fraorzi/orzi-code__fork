export interface DiffLineStats {
  additions: number;
  deletions: number;
}

/** Added and removed line counts per file of a `git diff` (binary files count as zero). */
export function promptDiffStats(diff: string): Map<string, DiffLineStats> {
  const stats = new Map<string, DiffLineStats>();
  let current: DiffLineStats | undefined;
  let inHunk = false;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      inHunk = false;
      current = { additions: 0, deletions: 0 };
      const match = / b\/(.*)$/.exec(line);
      if (match?.[1]) stats.set(match[1], current);
      continue;
    }
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk || !current) continue;
    if (line.startsWith("+")) current.additions += 1;
    else if (line.startsWith("-")) current.deletions += 1;
  }
  return stats;
}
