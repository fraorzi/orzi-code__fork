import { join } from "node:path";

/** Exercise the real renderer action and desktop settings IPC without installing a provider. */
export async function agentUpdatePreferencesScenario({
  client,
  evaluate,
  bridgeInvoke,
  waitForValue,
  screenshot,
  outDir,
}) {
  const initial = await bridgeInvoke(client, "getSharedSettings");
  const statuses = await evaluate(
    client,
    "window.__poracodeDev.stores.agentStatuses.getState().agentStatuses",
  );
  const agentKind = "smoke-update-agent";
  const switchSelector = '[role="switch"][aria-label="Automatic agent updates"]';
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  try {
    await bridgeInvoke(client, "setSharedSettings", {
      ...initial,
      automaticAgentUpdates: true,
      automaticAgentUpdatesDisabled: ["smoke-other-agent"],
    });
    await evaluate(
      client,
      `
      window.__poracodeDev.stores.sharedSettings.setState({
        automaticAgentUpdates: true,
        automaticAgentUpdatesDisabled: ["smoke-other-agent"]
      });
      window.__poracodeDev.stores.agentStatuses.setState({agentStatuses:[{
        kind: ${JSON.stringify(agentKind)}, label: "Smoke update agent", installed: true,
        version: "1.0.0", authState: "authenticated", envKind: "posix",
        capabilities: {models: [], efforts: [], modelEfforts: {}, modes: [],
          approvalPolicies: [], sandboxModes: [], supportsResume: false,
          supportsDirectInput: false, liveInputMode: "server", presentationMode: "gui",
          settingDefs: []}
      }]});
      window.__poracodeDev.openSettings("agents:${agentKind}");
    `,
    );
    await waitForValue(
      () => evaluate(client, `document.querySelector(${JSON.stringify(switchSelector)})?.checked`),
      (value) => value === true,
      "per-agent automatic updates switch",
    );
    await evaluate(
      client,
      `document.querySelector(${JSON.stringify(switchSelector)}).closest("label").querySelector('[data-slot="switch-control"]').click()`,
    );
    const persisted = await waitForValue(
      () => bridgeInvoke(client, "getSharedSettings"),
      (value) => value.automaticAgentUpdatesDisabled?.includes(agentKind),
      "per-agent opt-out persisted through desktop IPC",
    );
    assert(
      persisted.automaticAgentUpdatesDisabled.includes("smoke-other-agent"),
      "Opt-out lost another provider",
    );
    await evaluate(client, "window.__poracodeDev.closeSettings()");
    await evaluate(client, `window.__poracodeDev.openSettings("agents:${agentKind}")`);
    await waitForValue(
      () => evaluate(client, `document.querySelector(${JSON.stringify(switchSelector)})?.checked`),
      (value) => value === false,
      "reopened per-agent preference",
    );
    const screenshotPath = join(outDir, "smoke-agent-update-preference.png");
    await screenshot(client, screenshotPath);
    await evaluate(
      client,
      `document.querySelector(${JSON.stringify(switchSelector)}).closest("label").querySelector('[data-slot="switch-control"]').click()`,
    );
    await waitForValue(
      () => bridgeInvoke(client, "getSharedSettings"),
      (value) => !value.automaticAgentUpdatesDisabled.includes(agentKind),
      "per-agent updates re-enabled",
    );
    await evaluate(
      client,
      "window.__poracodeDev.stores.sharedSettings.getState().setAutomaticAgentUpdates(false)",
    );
    await waitForValue(
      () => evaluate(client, `document.querySelector(${JSON.stringify(switchSelector)})?.disabled`),
      (value) => value === true,
      "global automatic-update switch remains authoritative",
    );
    return {
      persisted: true,
      reopened: true,
      reenabled: true,
      globalSwitchRespected: true,
      screenshotPath,
    };
  } finally {
    await bridgeInvoke(client, "setSharedSettings", initial);
    await evaluate(
      client,
      `
      window.__poracodeDev.closeSettings();
      window.__poracodeDev.stores.sharedSettings.setState({
        automaticAgentUpdates: ${JSON.stringify(initial.automaticAgentUpdates)},
        automaticAgentUpdatesDisabled: ${JSON.stringify(initial.automaticAgentUpdatesDisabled)}
      });
      window.__poracodeDev.stores.agentStatuses.setState({agentStatuses:${JSON.stringify(statuses)}});
    `,
    );
  }
}
