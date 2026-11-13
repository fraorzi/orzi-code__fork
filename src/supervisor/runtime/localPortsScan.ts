import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PortProcess {
  pid: number;
  ppid: number;
  uid: number;
  startedAt: string;
  name: string;
}

export interface PortListener {
  pid: number;
  address: string;
  port: number;
}

export async function runPortCommand(command: string, args: string[]): Promise<string> {
  try {
    return (
      await execFileAsync(command, args, {
        encoding: "utf8",
        timeout: 5000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, LC_ALL: "C" },
      })
    ).stdout;
  } catch (error) {
    // lsof exits 1 for an empty selection. Never propagate command output:
    // process-environment inspection can contain credentials.
    if (
      command === "lsof" &&
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 1 &&
      "stdout" in error &&
      typeof error.stdout === "string"
    )
      return error.stdout;
    // eslint-disable-next-line preserve-caught-error -- OS errors can embed credentials from process environments.
    throw new Error("Local process inspection failed");
  }
}

export function parsePortProcesses(output: string): Map<number, PortProcess> {
  const processes = new Map<number, PortProcess>();
  for (const line of output.split("\n")) {
    const match = line.match(
      /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.+)$/,
    );
    if (!match) continue;
    const pid = Number(match[1]);
    processes.set(pid, {
      pid,
      ppid: Number(match[2]),
      uid: Number(match[3]),
      startedAt: match[4]!.replace(/\s+/g, " "),
      name: match[5]!.trim().split("/").at(-1) ?? "",
    });
  }
  return processes;
}

export function parsePortListeners(output: string): PortListener[] {
  let pid = 0;
  const listeners = new Map<string, PortListener>();
  for (const line of output.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    if (!line.startsWith("n") || !Number.isInteger(pid) || pid <= 0) continue;
    const match = line.slice(1).match(/^(.*):(\d+)$/);
    if (!match) continue;
    const port = Number(match[2]);
    if (port < 1 || port > 65535) continue;
    const address = match[1]!;
    listeners.set(`${pid}:${address}:${port}`, { pid, address, port });
  }
  return [...listeners.values()];
}

export function processDepth(
  pid: number,
  root: number,
  processes: ReadonlyMap<number, PortProcess>,
): number | null {
  const seen = new Set<number>();
  let current = pid;
  let depth = 0;
  while (current > 0 && !seen.has(current)) {
    if (current === root) return depth;
    seen.add(current);
    const parent = processes.get(current)?.ppid;
    if (parent === undefined) return null;
    current = parent;
    depth += 1;
  }
  return null;
}

export async function hasPortOwner(pid: number, owner: string): Promise<boolean> {
  try {
    const environment =
      process.platform === "linux"
        ? await readFile(`/proc/${pid}/environ`, "utf8")
        : await runPortCommand("ps", ["eww", "-p", String(pid), "-o", "command="]);
    return environment.split(/[\s\0]+/).includes(`PORACODE_PROCESS_OWNER=${owner}`);
  } catch {
    return false;
  }
}

export async function readPortCwd(pid: number): Promise<string> {
  const output = await runPortCommand("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
  return (
    output
      .split("\n")
      .find((line) => line.startsWith("n"))
      ?.slice(1) ?? ""
  );
}
