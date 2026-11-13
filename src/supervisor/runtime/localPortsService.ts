import { randomUUID } from "node:crypto";
import { readTransportPorts as readProtectedTransportPorts } from "../agents/base/transportPorts";
import { setTimeout as delay } from "node:timers/promises";
import type {
  LocalPort,
  LocalPortsResult,
  StopLocalPort,
  StopLocalPortResult,
} from "@/shared/localPorts";
import {
  hasPortOwner,
  parsePortListeners,
  parsePortProcesses,
  processDepth,
  readPortCwd,
  runPortCommand,
  type PortProcess,
} from "./localPortsScan";

/** Native TCP servers started by this supervisor, including reparented jobs. */
export class LocalPortsService {
  private readonly owner = randomUUID();
  private readonly known = new Map<number, string>();
  private scan: Promise<LocalPortsResult> | undefined;

  constructor(
    private readonly readTransportPorts: () => readonly number[] = readProtectedTransportPorts,
  ) {
    // Inherited by every provider and command, without changing provider
    // payloads or pooling keys. Session-scoped and intentionally not persisted.
    process.env.PORACODE_PROCESS_OWNER = this.owner;
  }

  list(): Promise<LocalPortsResult> {
    if (this.scan) return this.scan;
    const scan = this.readPorts();
    this.scan = scan;
    void scan.finally(() => {
      if (this.scan === scan) this.scan = undefined;
    });
    return scan;
  }

  private async processes(): Promise<Map<number, PortProcess>> {
    return parsePortProcesses(
      await runPortCommand("ps", ["-axo", "pid=,ppid=,uid=,lstart=,comm="]),
    );
  }

  private async owns(
    target: PortProcess,
    processes: ReadonlyMap<number, PortProcess>,
  ): Promise<boolean> {
    if (target.uid !== process.getuid?.()) return false;
    const depth = processDepth(target.pid, process.pid, processes);
    // The supervisor and direct children host agent sessions / shared helpers.
    // Only their command descendants may be stopped through this surface.
    if (depth !== null) return depth >= 2;
    return (
      this.known.get(target.pid) === target.startedAt ||
      (await hasPortOwner(target.pid, this.owner))
    );
  }

  private async readPorts(): Promise<LocalPortsResult> {
    if (process.platform !== "darwin" && process.platform !== "linux")
      return { status: "unavailable", reason: "unsupported-platform" };
    try {
      const [processes, output] = await Promise.all([
        this.processes(),
        runPortCommand("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"]),
      ]);
      const listeners = parsePortListeners(output);
      const transportPorts = new Set(this.readTransportPorts());
      const transportPids = new Set(
        listeners
          .filter((listener) => transportPorts.has(listener.port))
          .map((listener) => listener.pid),
      );
      const details = new Map<number, { process: PortProcess; cwd: string }>();
      await Promise.all(
        [...new Set(listeners.map((listener) => listener.pid))].map(async (pid) => {
          const target = processes.get(pid);
          if (!target || transportPids.has(pid) || !(await this.owns(target, processes))) return;
          this.known.set(pid, target.startedAt);
          details.set(pid, { process: target, cwd: await readPortCwd(pid) });
        }),
      );
      for (const [pid, startedAt] of this.known) {
        if (processes.get(pid)?.startedAt !== startedAt) this.known.delete(pid);
      }
      const ports: LocalPort[] = [];
      const seen = new Set<string>();
      for (const listener of listeners) {
        const detail = details.get(listener.pid);
        const key = `${listener.pid}:${listener.port}`;
        if (!detail || seen.has(key)) continue;
        seen.add(key);
        ports.push({
          ...listener,
          startedAt: detail.process.startedAt,
          processName: detail.process.name,
          cwd: detail.cwd,
        });
      }
      return { status: "available", ports: ports.sort((a, b) => a.port - b.port || a.pid - b.pid) };
    } catch {
      return { status: "unavailable", reason: "scan-failed" };
    }
  }

  async stop(input: StopLocalPort): Promise<StopLocalPortResult> {
    try {
      const processes = await this.processes();
      const target = processes.get(input.pid);
      if (!target || target.startedAt !== input.startedAt)
        return { status: "error", reason: "stale" };
      if (!(await this.owns(target, processes))) return { status: "error", reason: "protected" };
      // Verify the exact listener again; a stale UI row cannot target a process
      // that has closed its server or a new process that reused the PID.
      const listeners = parsePortListeners(
        await runPortCommand("lsof", [
          "-nP",
          "-a",
          "-p",
          String(input.pid),
          "-iTCP",
          "-sTCP:LISTEN",
          "-Fpn",
        ]),
      );
      if (listeners.some((listener) => this.readTransportPorts().includes(listener.port)))
        return { status: "error", reason: "protected" };
      if (!listeners.some((listener) => listener.pid === input.pid && listener.port === input.port))
        return { status: "error", reason: "stale" };
      const freshProcesses = await this.processes();
      const freshTarget = freshProcesses.get(input.pid);
      if (!freshTarget || freshTarget.startedAt !== input.startedAt)
        return { status: "error", reason: "stale" };
      if (!(await this.owns(freshTarget, freshProcesses)))
        return { status: "error", reason: "protected" };
      process.kill(input.pid, input.force ? "SIGKILL" : "SIGTERM");
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await delay(100);
        const current = (await this.processes()).get(input.pid);
        if (current?.startedAt !== input.startedAt) return { status: "stopped" };
        const remaining = parsePortListeners(
          await runPortCommand("lsof", [
            "-nP",
            "-a",
            "-p",
            String(input.pid),
            "-iTCP",
            "-sTCP:LISTEN",
            "-Fpn",
          ]),
        );
        if (!remaining.some((listener) => listener.port === input.port))
          return { status: "stopped" };
      }
      return { status: "error", reason: "still-running" };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error) {
        if (error.code === "ESRCH") return { status: "stopped" };
        if (error.code === "EPERM") return { status: "error", reason: "permission-denied" };
      }
      return { status: "error", reason: "failed" };
    }
  }
}
