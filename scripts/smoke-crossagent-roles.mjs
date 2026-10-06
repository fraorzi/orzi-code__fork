import { join } from "node:path";

/** Exercise the real desktop IPC and editor using only the isolated smoke profile. */
export async function crossagentRolesScenario({
  client,
  evaluate,
  bridgeInvoke,
  waitForValue,
  screenshot,
  outDir,
}) {
  const initial = await bridgeInvoke(client, "getSharedSettings");
  const original = initial.crossagentRoutingOverrides;
  const tag = "smoke-worker-role";
  const payload = {
    override: {
      tags: [tag],
      name: "Smoke reviewer",
      instructions: "Check behavior and preserve user files.",
      agentKind: "smoke-unavailable-worker",
      modelId: "smoke-model",
      fallbacks: [{ agentKind: "smoke-alternate", modelId: "smoke-fast" }],
    },
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  try {
    const saved = await bridgeInvoke(client, "saveCrossagentRole", payload);
    assert(
      saved.some((role) => role.name === payload.override.name),
      "Role save IPC lost the name",
    );
    await bridgeInvoke(client, "setSharedSettings", initial);
    const persisted = await bridgeInvoke(client, "getSharedSettings");
    const role = persisted.crossagentRoutingOverrides.find((entry) => entry.tags.includes(tag));
    assert(
      role?.instructions === payload.override.instructions &&
        role.fallbacks?.[0]?.modelId === "smoke-fast",
      "Stale renderer settings lost role instructions or fallbacks",
    );
    await evaluate(
      client,
      `window.__poracodeDev.stores.sharedSettings.setState({crossagentRoutingOverrides:${JSON.stringify(persisted.crossagentRoutingOverrides)}}); window.__poracodeDev.openSettings("mcpServers")`,
    );
    await waitForValue(
      () =>
        evaluate(
          client,
          `Boolean(document.querySelector('button[aria-label="Crossagent routing and ranking"]'))`,
        ),
      Boolean,
      "Crossagents settings action",
    );
    await evaluate(
      client,
      `document.querySelector('button[aria-label="Crossagent routing and ranking"]').click()`,
    );
    await waitForValue(
      () =>
        evaluate(
          client,
          `({rendered: document.body.innerText.includes("Smoke reviewer"), button: Boolean(document.querySelector('button[aria-label="Edit role for #${tag}"]'))})`,
        ),
      (state) => state.rendered && state.button,
      "worker role row",
    );
    await evaluate(
      client,
      `document.querySelector('button[aria-label="Edit role for #${tag}"]').click()`,
    );
    await waitForValue(
      () =>
        evaluate(
          client,
          `({name: document.querySelector('input[aria-label="Role name"]')?.value, instructions: document.querySelector('textarea[aria-label="Role instructions"]')?.value, saveDisabled: Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === "Save role")?.disabled})`,
        ),
      (state) =>
        state.name === "Smoke reviewer" &&
        state.instructions === payload.override.instructions &&
        state.saveDisabled,
      "unavailable worker role editor",
    );
    const screenshotPath = join(outDir, "smoke-worker-role-editor.png");
    await evaluate(
      client,
      `Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))`,
      true,
    );
    await screenshot(client, screenshotPath);
    await evaluate(
      client,
      `Array.from(document.querySelectorAll('[role="dialog"] button')).find(button => button.textContent.trim() === "Cancel").click()`,
    );
    let collisionRejected = false;
    try {
      await bridgeInvoke(client, "saveCrossagentRole", payload);
    } catch {
      collisionRejected = true;
    }
    assert(collisionRejected, "Duplicate task tags were silently overwritten");
    const edited = await bridgeInvoke(client, "saveCrossagentRole", {
      previousTags: [tag],
      override: {
        ...payload.override,
        tags: ["smoke-worker-renamed"],
        name: "Smoke reviewer edited",
      },
    });
    assert(
      !edited.some((entry) => entry.tags.includes(tag)),
      "Role edit left the previous task tags behind",
    );
    const removed = await bridgeInvoke(client, "removeCrossagentRoutingOverride", {
      tags: ["smoke-worker-renamed"],
    });
    assert(
      JSON.stringify(removed) === JSON.stringify(original),
      "Role CRUD changed unrelated saved routes",
    );
    return {
      screenshotPath,
      persisted: true,
      collisionRejected,
      renamed: true,
      removed: true,
      unavailableModelBlocked: true,
    };
  } finally {
    const current = await bridgeInvoke(client, "getSharedSettings");
    for (const role of current.crossagentRoutingOverrides.filter(
      (entry) => entry.tags.includes(tag) || entry.tags.includes("smoke-worker-renamed"),
    )) {
      await bridgeInvoke(client, "removeCrossagentRoutingOverride", { tags: role.tags });
    }
    await evaluate(
      client,
      `window.__poracodeDev.closeSettings(); window.__poracodeDev.stores.sharedSettings.setState({crossagentRoutingOverrides:${JSON.stringify(original)}})`,
    );
  }
}
