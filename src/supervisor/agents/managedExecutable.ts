import { existsSync } from "node:fs";

// Native executable overrides are installed by the supervisor's version manager.
// Both detection and launch read this table, before consulting shell PATH caches.
const overrides = new Map<string, string | Error>();

export function setManagedExecutable(binary: string, path: string | Error | undefined): void {
  if (path === undefined) overrides.delete(binary);
  else overrides.set(binary, path);
}

export function getManagedExecutable(binary: string): string | undefined {
  const entry = overrides.get(binary);
  if (entry instanceof Error) throw entry;
  if (entry && !existsSync(entry))
    throw new Error(
      "The pinned runtime executable is missing. Restore a managed version or select the system installation.",
    );
  return entry;
}

/** Activation identity for derived status caches, including fail-closed records. */
export function managedExecutableSnapshot(): Record<string, string> {
  return Object.fromEntries(
    [...overrides.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([binary, path]) => [binary, path instanceof Error ? "invalid" : path]),
  );
}
