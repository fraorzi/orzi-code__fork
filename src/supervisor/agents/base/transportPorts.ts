const transportPorts = new Map<number, number>();

/** Register at bind readiness, before exposing a runtime HTTP transport.
 * Release on process exit/disposal. Counts also cover pooled server leases. */
export function protectTransportPort(baseUrl: string): () => void {
  const url = new URL(baseUrl);
  const port = Number(url.port || (url.protocol === "https:" ? "443" : "80"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) return () => {};
  transportPorts.set(port, (transportPorts.get(port) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (transportPorts.get(port) ?? 1) - 1;
    if (remaining === 0) transportPorts.delete(port);
    else transportPorts.set(port, remaining);
  };
}

export function readTransportPorts(): readonly number[] {
  return [...transportPorts.keys()];
}
