import { createHash } from "node:crypto";
import { mkdir, writeFile, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Full version activation IPC and real controls, using complete synthetic CLI packages. */
export async function agentVersionsScenario({
  client,
  evaluate,
  bridgeInvoke,
  waitForValue,
  screenshot,
  outDir,
}) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const kind = "codex";
  const before = await evaluate(
    client,
    "window.__poracodeDev.stores.agentStatuses.getState().agentStatuses",
  );
  const initial = await bridgeInvoke(client, "getAgentVersions", { agentKind: kind });
  assert(
    initial.supported && !initial.active,
    "Fresh mock profile should support unpinned runtime versions",
  );
  const packageName = "@openai/codex";
  const root = resolve(
    outDir,
    "..",
    "data",
    "agent-versions",
    createHash("sha256").update(packageName).digest("hex"),
  );
  for (const version of ["0.160.1", "0.160.2"]) {
    const directory = join(root, version);
    const pkg = join(directory, "node_modules", packageName);
    await mkdir(pkg, { recursive: true });
    await mkdir(join(directory, "node_modules", ".bin"), { recursive: true });
    await writeFile(join(pkg, "package.json"), JSON.stringify({ name: packageName, version }));
    await writeFile(
      join(directory, "package-lock.json"),
      JSON.stringify({
        packages: {
          [`node_modules/${packageName}`]: { version, integrity: "sha512-synthetic-smoke" },
        },
      }),
    );
    await writeFile(
      join(pkg, "cli.cjs"),
      `#!${process.execPath}
const readline=require('node:readline');
if(process.argv.includes('--version')) {console.log('codex-cli ${version}');process.exit(0);}
if(process.argv.includes('app-server'))readline.createInterface({input:process.stdin}).on('line',line=>{
 const request=JSON.parse(line);if(!request.id)return;
 let result={};
 if(request.method==='initialize')result={userAgent:'synthetic-version-smoke'};
 if(request.method==='configRequirements/read')result={requirements:null};
 if(request.method==='account/read')result={account:null,requiresOpenaiAuth:false};
 if(request.method==='model/list')result={data:[],nextCursor:null};
 if(request.method==='skills/list')result={data:[]};
 console.log(JSON.stringify({id:request.id,result}));
});else console.log('Not logged in');`,
      { mode: 0o755 },
    );
    await symlink(`../${packageName}/cli.cjs`, join(directory, "node_modules", ".bin", "codex"));
  }
  const open = async () => {
    await evaluate(
      client,
      `(()=>{window.__poracodeDev.stores.agentStatuses.setState({agentStatuses:[{
      kind:'codex',label:'Codex',installed:true,version:'0.160.1',authState:'unknown',envKind:'posix',
      capabilities:{models:[],efforts:[],modelEfforts:{},modes:[],approvalPolicies:[],sandboxModes:[],supportsResume:true,supportsDirectInput:true,liveInputMode:'terminal',presentationMode:'gui',presentationModes:['gui','terminal'],settingDefs:[]}
    }]});window.__poracodeDev.openSettings('agents:codex');})()`,
    );
    await waitForValue(
      () => evaluate(client, "Boolean(document.querySelector('[data-agent-versions]'))"),
      Boolean,
      "version controls",
    );
  };
  const click = async (label) =>
    evaluate(
      client,
      `(()=>{const button=[...document.querySelectorAll('[data-agent-versions] button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!button || button.disabled)throw new Error('missing or disabled '+${JSON.stringify(label)});button.click();return true})()`,
    );
  const enter = async (version) =>
    evaluate(
      client,
      `(()=>{const input=document.querySelector('[data-agent-versions] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(version)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return input.value})()`,
    );
  const waitActive = async (version) =>
    waitForValue(
      () => bridgeInvoke(client, "getAgentVersions", { agentKind: kind }),
      (value) => value.active === version,
      "managed activation " + version,
    );
  try {
    await open();
    await enter("latest");
    assert(
      await evaluate(
        client,
        "[...document.querySelectorAll('[data-agent-versions] button')].find(b=>b.textContent.trim()==='Install and pin')?.disabled",
      ),
      "Floating npm tags must be rejected by the UI",
    );
    await enter("0.160.1");
    await click("Install and pin");
    await waitActive("0.160.1");
    await waitForValue(
      () => evaluate(client, "document.querySelector('[data-agent-versions]').textContent"),
      (text) => text.includes("Pinned: 0.160.1") && !text.includes("Verifying the runtime"),
      "first pinned UI",
    );
    const update = await bridgeInvoke(client, "updateAgentBinary", {
      agentKind: kind,
      envKind: "posix",
    });
    assert(
      !update.ok && update.output?.includes("pinned"),
      "Pinned runtime must refuse ordinary updater",
    );
    await enter("0.160.2");
    await click("Install and pin");
    await waitActive("0.160.2");
    await waitForValue(
      () => evaluate(client, "document.querySelector('[data-agent-versions]').textContent"),
      (text) => text.includes("Restore 0.160.1") && !text.includes("Verifying the runtime"),
      "rollback UI",
    );
    await click("Restore 0.160.1");
    await waitActive("0.160.1");
    await waitForValue(
      () => evaluate(client, "document.querySelector('[data-agent-versions]').textContent"),
      (text) => text.includes("Pinned: 0.160.1") && !text.includes("Verifying the runtime"),
      "restored UI",
    );
    await screenshot(client, join(outDir, "agent-versions-rollback.png"));
    await click("Use system installation");
    await waitForValue(
      () => bridgeInvoke(client, "getAgentVersions", { agentKind: kind }),
      (value) => value.supported && !value.active,
      "system installation restored",
    );
    await waitForValue(
      () => evaluate(client, "document.querySelector('[data-agent-versions]').textContent"),
      (text) => text.includes("System installation") && !text.includes("Verifying the runtime"),
      "system installation request completed",
    );
    assert(
      !(await evaluate(
        client,
        "Boolean(document.querySelector('[data-agent-versions] [role=alert]'))",
      )),
      "Managed version controls reported an error",
    );
    await writeFile(
      join(outDir, "agent-versions-verification.json"),
      JSON.stringify(
        {
          synthetic: true,
          installPin: true,
          ordinaryUpdateRejected: true,
          rollback: true,
          systemRestored: true,
        },
        null,
        2,
      ),
    );
  } finally {
    const state = await bridgeInvoke(client, "getAgentVersions", { agentKind: kind });
    if (state.active)
      await bridgeInvoke(client, "manageAgentVersion", { agentKind: kind, action: "system" });
    await evaluate(
      client,
      `window.__poracodeDev.stores.agentStatuses.setState({agentStatuses:${JSON.stringify(before)}});window.__poracodeDev.closeSettings()`,
    );
  }
}
