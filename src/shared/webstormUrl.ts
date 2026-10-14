/** File-only WebStorm links. Paths are URL encoded, never interpreted as commands. */
export function webstormFileUrl(path: string, line?: number): string {
  const url = new URL("webstorm://open");
  url.searchParams.set("file", path);
  if (line !== undefined) url.searchParams.set("line", String(line));
  return url.toString();
}

export function isWebstormFileUrl(url: URL): boolean {
  const file = url.searchParams.get("file");
  const line = url.searchParams.get("line");
  return (
    url.protocol === "webstorm:" &&
    url.hostname === "open" &&
    (url.pathname === "" || url.pathname === "/") &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.hash &&
    [...url.searchParams.keys()].every((key) => key === "file" || key === "line") &&
    url.searchParams.getAll("file").length === 1 &&
    url.searchParams.getAll("line").length <= 1 &&
    file !== null &&
    file.split("").every((character) => character.charCodeAt(0) >= 32) &&
    /^(?:\/|[A-Za-z]:[\\/]|\\\\|~\/)/.test(file) &&
    (line === null || /^[1-9]\d*$/.test(line))
  );
}
