import { join } from "node:path";

/** Mock inventory, real controls and a real supervisor round trip with sandboxed credentials. */
export async function savedResetsScenario({
  client,
  evaluate,
  bridgeInvoke,
  waitForValue,
  screenshot,
  outDir,
}) {
  const saved = await evaluate(
    client,
    `(() => {
    const stores = window.__poracodeDev.stores;
    return { snapshots: Object.values(stores.providerUsage.getState().snapshots), usage: stores.sharedSettings.getState().usage,
      locale: stores.sharedSettings.getState().locale, limitsExpanded: stores.sidebarUi.getState().limitsExpanded };
  })()`,
  );
  const setup = `(() => {
    const stores = window.__poracodeDev.stores;
    stores.sharedSettings.setState((state) => ({ usage: { ...state.usage, showInSidebar: true,
      sidebarHiddenProviders: [], disabledProviders: [], providerOrder: ["claude", "codex"] } }));
    stores.sidebarUi.setState({ limitsExpanded: false });
    stores.providerUsage.getState().setSnapshots([
      { providerId: "claude", status: "ok", fetchedAt: Date.now(), windows: [], resetCredits: { status: "unknown", reason: "web-only" } },
      { providerId: "codex", status: "ok", fetchedAt: Date.now(), windows: [], resetCredits: { status: "known", grants: [
        { id: "later", label: "Later reset", remaining: 1, expiresAt: Date.now() + 10 * 86400000, canActivate: false },
        { id: "urgent", label: "Urgent reset", remaining: 1, expiresAt: Date.now() + 3600000, canActivate: true }
      ] } }
    ]);
  })()`;
  const click = async (name) => {
    const point = await evaluate(
      client,
      `(() => {
      const button = [...document.querySelectorAll('button')].find(el =>
        (el.getAttribute('aria-label') === ${JSON.stringify(name)} || el.textContent.trim() === ${JSON.stringify(name)}) &&
        !el.disabled && el.getBoundingClientRect().width > 0);
      if (!button) throw new Error('Missing enabled control: ' + ${JSON.stringify(name)});
      button.scrollIntoView({block: 'nearest'});
      const rect = button.getBoundingClientRect(); return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
    })()`,
    );
    await client.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      ...point,
    });
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      ...point,
    });
  };
  const capture = async (name) => {
    await evaluate(
      client,
      "Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getTiming().iterations)).map(animation => animation.finished.catch(() => undefined)))",
    );
    await screenshot(client, join(outDir, name));
  };
  try {
    await evaluate(client, 'window.__poracodeDev.stores.sharedSettings.getState().setLocale("en")');
    await evaluate(client, setup);
    const compact = await waitForValue(
      () =>
        evaluate(
          client,
          `(() => {
      const section = document.querySelector('section[aria-label="Saved resets"]');
      if (!section) return null;
      const row = section.querySelector('[aria-label="Saved resets for Codex"]');
      const limits = document.querySelector('[aria-label="Expand limits"]');
      return {height: section.getBoundingClientRect().height, aboveLimits: Boolean(limits && section.compareDocumentPosition(limits) & Node.DOCUMENT_POSITION_FOLLOWING),
        collapsed: limits?.getAttribute('aria-expanded') === 'false', count: row?.textContent.includes('2'),
        urgent: Boolean(section.querySelector('[aria-label="Use before expiry"]')), detailsHidden: !section.textContent.includes('Urgent reset')};
    })()`,
        ),
      (value) => value?.count && value.urgent,
      "compact reset rows",
    );
    if (
      compact.height > 110 ||
      !compact.aboveLimits ||
      !compact.collapsed ||
      !compact.detailsHidden
    )
      throw new Error(`reset compactness failed: ${JSON.stringify(compact)}`);
    await capture("saved-resets-en.png");
    await click("Saved resets for Codex");
    await waitForValue(
      () => evaluate(client, 'document.body.innerText.includes("Urgent reset")'),
      Boolean,
      "native reset details",
    );
    await click("Use this reset");
    await waitForValue(
      () =>
        evaluate(
          client,
          'document.body.innerText.includes("Use this reset now? This cannot be undone.")',
        ),
      Boolean,
      "explicit reset confirmation",
    );
    await capture("saved-resets-confirm.png");
    await click("Cancel");
    const intact = await evaluate(
      client,
      "window.__poracodeDev.stores.providerUsage.getState().snapshots.codex.resetCredits.grants.length === 2",
    );
    if (!intact) throw new Error("cancel changed the reset inventory");
    await click("Use this reset");
    await click("Use reset");
    await waitForValue(
      () =>
        evaluate(
          client,
          "window.__poracodeDev.stores.providerUsage.getState().snapshots.codex.status",
        ),
      (value) => value === "auth-missing",
      "sandboxed native activation round trip",
    );
    const native = await bridgeInvoke(client, "consumeProviderUsageReset", {
      providerId: "codex",
      grantId: "fixture-only",
      requestId: "11111111-1111-4111-8111-111111111111",
    });
    if (native.outcome !== "auth-required")
      throw new Error(`unexpected fixture activation: ${JSON.stringify(native)}`);
    await evaluate(client, setup);
    await evaluate(client, 'window.__poracodeDev.stores.sharedSettings.getState().setLocale("pl")');
    await waitForValue(
      () =>
        evaluate(
          client,
          "Boolean(document.querySelector('section[aria-label=\"Dodatkowe resety\"]'))",
        ),
      Boolean,
      "Polish reset rows",
    );
    await capture("saved-resets-pl.png");
    await click("Dodatkowe resety: Claude");
    await waitForValue(
      () => evaluate(client, 'document.body.innerText.includes("Połącz konto")'),
      Boolean,
      "in-app account connection",
    );
    await capture("saved-resets-connect-pl.png");
    await client.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await client.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    return {
      ...compact,
      nativeOutcome: native.outcome,
      languages: ["en", "pl"],
      source: "mock inventory; real supervisor IPC; no credentials or resets consumed",
    };
  } finally {
    await evaluate(
      client,
      `(() => {
      const stores = window.__poracodeDev.stores;
      stores.providerUsage.getState().setSnapshots(${JSON.stringify(saved.snapshots)});
      stores.sharedSettings.setState({ usage: ${JSON.stringify(saved.usage)} });
      stores.sharedSettings.getState().setLocale(${JSON.stringify(saved.locale)});
      stores.sidebarUi.setState({ limitsExpanded: ${JSON.stringify(saved.limitsExpanded)} });
    })()`,
    );
  }
}
