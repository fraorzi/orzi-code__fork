import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { afterEach, expect, it } from "vitest";
import { LocalPortsService } from "./localPortsService";
import { parsePortProcesses, runPortCommand } from "./localPortsScan";

const originalOwner = process.env.PORACODE_PROCESS_OWNER;
const children: ChildProcess[] = [];
const ownedPids = new Set<number>();
afterEach(() => {
  for (const pid of ownedPids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already stopped */
    }
  }
  for (const child of children) child.kill("SIGKILL");
  ownedPids.clear();
  children.length = 0;
  if (originalOwner === undefined) delete process.env.PORACODE_PROCESS_OWNER;
  else process.env.PORACODE_PROCESS_OWNER = originalOwner;
});

async function server(options: { ignoreTerm?: boolean; detach?: boolean } = {}) {
  const code = `const net=require('node:net');${options.ignoreTerm ? "process.on('SIGTERM',()=>{});" : ""}const a=net.createServer();const b=net.createServer();a.listen(0,'127.0.0.1',()=>b.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({pid:process.pid,port:a.address().port,otherPort:b.address().port}))));`;
  const wrapper = `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e',${JSON.stringify(code)}],{stdio:['ignore','pipe','ignore'],detached:${options.detach === true}});${options.detach ? "" : "setInterval(()=>{},1000);"}c.stdout.on('data',d=>{process.stdout.write(d);${options.detach ? "c.unref();c.stdout.destroy();setTimeout(()=>process.exit(),30);" : ""}});`;
  const child = spawn(process.execPath, ["-e", wrapper], { stdio: ["ignore", "pipe", "ignore"] });
  children.push(child);
  const lines = createInterface({ input: child.stdout! });
  const [line] = await once(lines, "line");
  lines.close();
  const info: { pid: number; port: number; otherPort: number } = JSON.parse(String(line));
  ownedPids.add(info.pid);
  if (options.detach) await once(child, "exit");
  return info;
}

it.skipIf(process.platform !== "darwin" && process.platform !== "linux")(
  "protects every port of an internal transport even behind a process wrapper",
  async () => {
    let transportPort = 0;
    const service = new LocalPortsService(() => [transportPort]);
    const info = await server();
    transportPort = info.port;
    const result = await service.list();
    expect(result.status).toBe("available");
    expect(
      result.status === "available" && result.ports.some((port) => port.pid === info.pid),
    ).toBe(false);
    const processes = parsePortProcesses(
      await runPortCommand("ps", ["-axo", "pid=,ppid=,uid=,lstart=,comm="]),
    );
    expect(
      await service.stop({
        pid: info.pid,
        startedAt: processes.get(info.pid)!.startedAt,
        port: info.otherPort,
      }),
    ).toEqual({ status: "error", reason: "protected" });
    process.kill(info.pid, 0);
  },
);

it.skipIf(process.platform !== "darwin" && process.platform !== "linux")(
  "finds an owned TCP server and closes all its ports without stopping its parent",
  async () => {
    const service = new LocalPortsService();
    const info = await server();
    const result = await service.list();
    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    const row = result.ports.find((port) => port.pid === info.pid && port.port === info.port);
    expect(row).toBeDefined();
    expect(result.ports.some((port) => port.pid === info.pid && port.port === info.otherPort)).toBe(
      true,
    );
    expect(await service.stop({ ...row!, startedAt: "different process" })).toEqual({
      status: "error",
      reason: "stale",
    });
    expect(await service.stop(row!)).toEqual({ status: "stopped" });
    const after = await service.list();
    expect(after.status === "available" && after.ports.some((port) => port.pid === info.pid)).toBe(
      false,
    );
    expect(children[0]!.exitCode).toBeNull();
  },
);

it.skipIf(process.platform !== "darwin" && process.platform !== "linux")(
  "finds reparented servers by their inherited owner and supports explicit force stop",
  async () => {
    const service = new LocalPortsService();
    const info = await server({ detach: true, ignoreTerm: true });
    const result = await service.list();
    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    const row = result.ports.find((port) => port.pid === info.pid);
    expect(row).toBeDefined();
    expect(await service.stop(row!)).toEqual({ status: "error", reason: "still-running" });
    expect(await service.stop({ ...row!, force: true })).toEqual({ status: "stopped" });
  },
);

it.skipIf(process.platform !== "darwin" && process.platform !== "linux")(
  "refuses to stop its own process even with its exact identity",
  async () => {
    const service = new LocalPortsService();
    const processes = parsePortProcesses(
      await runPortCommand("ps", ["-axo", "pid=,ppid=,uid=,lstart=,comm="]),
    );
    expect(
      await service.stop({
        pid: process.pid,
        startedAt: processes.get(process.pid)!.startedAt,
        port: 3000,
      }),
    ).toEqual({ status: "error", reason: "protected" });
  },
);

it.skipIf(process.platform !== "darwin" && process.platform !== "linux")(
  "does not claim or stop an unowned orphan server",
  async () => {
    const info = await server({ detach: true });
    const service = new LocalPortsService();
    const result = await service.list();
    expect(
      result.status === "available" && result.ports.some((port) => port.pid === info.pid),
    ).toBe(false);
    const processes = parsePortProcesses(
      await runPortCommand("ps", ["-axo", "pid=,ppid=,uid=,lstart=,comm="]),
    );
    expect(
      await service.stop({
        pid: info.pid,
        startedAt: processes.get(info.pid)!.startedAt,
        port: info.port,
      }),
    ).toEqual({ status: "error", reason: "protected" });
    process.kill(info.pid, 0);
  },
);
