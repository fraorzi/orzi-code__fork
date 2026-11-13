import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Launch only a fixture HTTP server through the real supervisor PTY. */
export async function localPortsScenario({
  client,
  evaluate,
  bridgeInvoke,
  waitForValue,
  screenshot,
  outDir,
}) {
  if (process.platform !== "darwin" && process.platform !== "linux")
    return "native port controls unavailable on this platform";
  const shellId = `ports-smoke-${Date.now()}`;
  const project = await evaluate(
    client,
    "window.__poracodeDev.stores.app.getState().projects.find((project) => project.id !== '__lightcode_home__' && project.location.kind === 'posix')",
  );
  if (!project) throw new Error("missing isolated project");
  const serverFile = join(outDir, `${shellId}.cjs`);
  const stateFile = join(outDir, `${shellId}.json`);
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  await writeFile(
    serverFile,
    `const http=require('node:http');const fs=require('node:fs');const server=http.createServer((req,res)=>res.end('ports fixture'));server.listen(0,'127.0.0.1',()=>fs.writeFileSync(${JSON.stringify(stateFile)},JSON.stringify({pid:process.pid,port:server.address().port,ownerTagged:Boolean(process.env.PORACODE_PROCESS_OWNER)})));`,
  );
  let target;
  try {
    await bridgeInvoke(client, "startShell", {
      shellId,
      projectLocation: project.location,
      initialSize: { cols: 80, rows: 24 },
    });
    await bridgeInvoke(client, "writeTerminal", {
      threadId: shellId,
      data: `${quote(process.execPath)} ${quote(serverFile)}\r`,
    });
    const info = await waitForValue(
      async () => {
        try {
          return JSON.parse(await readFile(stateFile, "utf8"));
        } catch {
          return null;
        }
      },
      Boolean,
      "fixture HTTP server",
    );
    if (!info.ownerTagged) throw new Error("fixture server did not inherit process ownership");
    const ports = await waitForValue(
      () => bridgeInvoke(client, "listLocalPorts"),
      (result) =>
        result.status === "available" &&
        result.ports.some((port) => port.pid === info.pid && port.port === info.port),
      "owned port discovery",
    );
    target = ports.ports.find((port) => port.pid === info.pid && port.port === info.port);
    const clicked = await evaluate(
      client,
      `(() => {const visible = (el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;const button=[...document.querySelectorAll('[role="button"],button')].find(el=>el.getAttribute('aria-label')==='Ports' && visible(el));if(button){button.click();return true;}const more=[...document.querySelectorAll('[aria-label="More"]')].find(visible);if(more){more.click();return false;}throw new Error('missing Ports entry');})()`,
    );
    if (!clicked) {
      await waitForValue(
        () =>
          evaluate(
            client,
            `Boolean([...document.querySelectorAll('[role="menuitem"]')].find(el=>el.textContent.trim()==='Ports'))`,
          ),
        Boolean,
        "Ports overflow entry",
      );
      await evaluate(
        client,
        `[...document.querySelectorAll('[role="menuitem"]')].find(el=>el.textContent.trim()==='Ports').click()`,
      );
    }
    await waitForValue(
      () => evaluate(client, `Boolean(document.querySelector('[data-local-port="${info.port}"]'))`),
      Boolean,
      "port row in dialog",
    );
    await screenshot(client, join(outDir, "local-ports-running.png"));
    await evaluate(
      client,
      `(() => {const row=document.querySelector('[data-local-port="${info.port}"]');const button=[...row.querySelectorAll('button')].find(el=>el.textContent.trim()==='Stop');if(!button)throw new Error('missing Stop');button.click();})()`,
    );
    await waitForValue(
      () => bridgeInvoke(client, "listLocalPorts"),
      (result) =>
        result.status === "available" && !result.ports.some((port) => port.pid === info.pid),
      "server port closed",
    );
    await waitForValue(
      () => evaluate(client, `!document.querySelector('[data-local-port="${info.port}"]')`),
      Boolean,
      "stopped row removed",
    );
    const shells = await bridgeInvoke(client, "getTerminalShellSnapshots");
    if (!shells.some((shell) => shell.terminalId === shellId))
      throw new Error("stopping server ended its parent terminal");
    await screenshot(client, join(outDir, "local-ports-stopped.png"));
    await writeFile(
      join(outDir, "local-ports-evidence.json"),
      JSON.stringify(
        {
          pid: info.pid,
          port: info.port,
          discovered: target,
          stopped: true,
          parentTerminalPreserved: true,
          ownerTagged: info.ownerTagged,
        },
        null,
        2,
      ),
    );
    return "real supervisor PTY -> owned HTTP listener -> Ports dialog -> Stop -> listener gone; parent terminal preserved";
  } finally {
    if (target)
      await bridgeInvoke(client, "stopLocalPort", {
        pid: target.pid,
        port: target.port,
        startedAt: target.startedAt,
        force: true,
      });
    await bridgeInvoke(client, "closeThread", { threadId: shellId });
    await evaluate(
      client,
      `(() => {const dialog=[...document.querySelectorAll('[role="dialog"]')].find(el=>el.textContent.includes('Local TCP servers'));const close=dialog && [...dialog.querySelectorAll('button')].find(el=>el.textContent.trim()==='Close');close?.click();})()`,
    );
  }
}
