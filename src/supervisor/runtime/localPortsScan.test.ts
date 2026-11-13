import { describe, expect, it } from "vitest";
import { parsePortListeners, parsePortProcesses, processDepth } from "./localPortsScan";

describe("local port process inspection", () => {
  it("parses IPv4, IPv6 and wildcard listeners without losing separate processes", () => {
    expect(
      parsePortListeners(
        "p42\nn127.0.0.1:3000\nn[::1]:3000\nn*:5173\np43\nn*:3000\nninvalid\nnlocalhost:70000",
      ),
    ).toEqual([
      { pid: 42, address: "127.0.0.1", port: 3000 },
      { pid: 42, address: "[::1]", port: 3000 },
      { pid: 42, address: "*", port: 5173 },
      { pid: 43, address: "*", port: 3000 },
    ]);
  });

  it("keeps process start identity and executable names containing spaces", () => {
    const processes = parsePortProcesses(
      " 42 10 501 Sat Oct  3 12:34:56 2026 /Applications/Example App/Helper\n43 42 501 Sat Oct 17 12:34:56 2026 /usr/bin/node\ninvalid",
    );
    expect(processes.get(42)).toEqual({
      pid: 42,
      ppid: 10,
      uid: 501,
      startedAt: "Sat Oct 3 12:34:56 2026",
      name: "Helper",
    });
    expect(processDepth(43, 10, processes)).toBe(2);
    expect(processDepth(42, 10, processes)).toBe(1);
    expect(processDepth(42, 99, processes)).toBeNull();
    processes.set(10, { ...processes.get(42)!, pid: 10, ppid: 42 });
    expect(processDepth(43, 99, processes)).toBeNull();
  });
});
