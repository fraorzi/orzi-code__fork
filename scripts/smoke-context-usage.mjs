import { join } from "node:path";

/** Real renderer controls, deterministic provider counters, no model requests. */
export async function contextUsageScenario({ client, evaluate, waitForValue, screenshot, outDir }) {
  const setup = await evaluate(
    client,
    `(() => {
    const dev = window.__poracodeDev;
    dev.closeSettings();
    const project = dev.stores.app.getState().projects.find((p) => p.location.kind === "posix" && p.id !== "__lightcode_home__");
    if (!project) throw new Error("missing fixture project");
    const statuses = dev.stores.agentStatuses.getState().agentStatuses;
    dev.stores.agentStatuses.getState().hydrateFromCache({ windows: [{
      kind: "codex", label: "Codex", installed: true, authState: "authenticated", envKind: "posix",
      capabilities: { models: [{id:"context-fixture",label:"Context fixture"}], efforts: [], modelEfforts: {},
        modes: ["agent"], approvalPolicies: [], sandboxModes: [], supportsResume: true,
        supportsDirectInput: true, presentationMode: "gui", presentationModes: ["gui"],
        contextSizes: [{id:"1m",label:"1M"}], defaultContextSize: "1m", settingDefs: [] },
    }], wsl: [] });
    const thread = dev.stores.app.getState().createThread({ projectId: project.id, agentKind: "codex",
      config: { model: "context-fixture", contextSize: "1m" }, prompt: "Context fixture",
      presentationMode: "gui", focus: false });
    dev.stores.app.setState((state) => ({threads: state.threads.map((t) => t.id === thread.id
      ? {...t, status:"idle", canResumeWithConfig:true, sessionRef:{providerSessionId:"context-fixture",discoveredAt:new Date().toISOString()},activeTurnStartedAt:undefined}
      : t)}));
    dev.stores.app.getState().openThread(thread.id);
    return {threadId:thread.id, projectId:project.id, statuses};
  })()`,
  );
  try {
    await evaluate(
      client,
      `window.__poracodeDev.stores.app.getState().applyRuntimeEvent(${JSON.stringify(setup.threadId)}, {
      type:"context.updated", threadId:${JSON.stringify(setup.threadId)}, usage:{ usedTokens:71000,maxTokens:1000000,autoCompactThreshold:167000,
        breakdown:[{id:"messages",label:"Messages",tokens:71000,kind:"used"},{id:"deferred",label:"Deferred catalog",tokens:54000,kind:"deferred"}],
        taskUsage:{turnId:"task-fixture",calls:2,inputTokens:10,outputTokens:20,cacheReadTokens:1000,cacheWriteTokens:50,contextTokensAtStart:70000}
      }});`,
    );
    const trigger = '[aria-label="Show context usage details"]';
    await waitForValue(
      () => evaluate(client, `Boolean(document.querySelector(${JSON.stringify(trigger)}))`),
      Boolean,
      "context indicator",
    );
    await evaluate(client, `document.querySelector(${JSON.stringify(trigger)}).click()`);
    const report = await waitForValue(
      () =>
        evaluate(
          client,
          `(() => {
      const panel=document.querySelector('[aria-label="Thread context usage"]');
      if(!panel) return null;
      const task=panel.querySelector('[data-testid="thread-task-usage"]');
      return {text:panel.textContent, task:task?.textContent,
        rows:task ? [...task.querySelectorAll('dt')].map((dt)=>[dt.textContent,dt.nextElementSibling.textContent]) : [],
        progress:panel.querySelector('.poracode-context-dock__bar')?.style.getPropertyValue('--lc-context-progress')};
    })()`,
        ),
      (value) => value?.rows.length === 7,
      "task consumption rows",
    );
    const assert = (value, message) => {
      if (!value) throw new Error(message);
    };
    assert(
      report.progress === "7%",
      `deferred tools affected context occupancy: ${report.progress}`,
    );
    assert(
      report.text.includes("Tools loaded on demand (outside context)"),
      "missing deferred tools section",
    );
    assert(report.text.includes("Auto-compact at"), "missing compaction threshold");
    assert(
      report.rows.find(([label]) => label === "Processed tokens")?.[1].replace(/\D/g, "") ===
        "1080",
      "incorrect consumption total",
    );
    assert(
      report.rows.find(([label]) => label === "Model calls")?.[1] === "2",
      "incorrect call count",
    );
    await screenshot(client, join(outDir, "context-usage-en.png"));
    await evaluate(
      client,
      'window.__poracodeDev.stores.sharedSettings.getState().setLocale("pl"); new Promise(resolve => setTimeout(resolve,300))',
      true,
    );
    await waitForValue(
      () => evaluate(client, 'document.body.innerText.includes("Przetworzone tokeny")'),
      Boolean,
      "Polish task labels",
    );
    await screenshot(client, join(outDir, "context-usage-pl.png"));
    return {
      occupancyPercent: 7,
      calls: 2,
      processedTokens: 1080,
      deferredTokens: 54000,
      languages: ["en", "pl"],
    };
  } finally {
    await evaluate(
      client,
      `(() => {
      const dev=window.__poracodeDev;
      dev.stores.sharedSettings.getState().setLocale("en");
      dev.stores.app.getState().openDraft(${JSON.stringify(setup.projectId)});
      dev.stores.app.setState((state)=>({threads:state.threads.filter((t)=>t.id!==${JSON.stringify(setup.threadId)})}));
      dev.stores.agentStatuses.getState().hydrateFromCache({windows:${JSON.stringify(setup.statuses)},wsl:[]});
    })()`,
    );
  }
}
