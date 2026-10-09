import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

/** Real renderer controls with isolated account/model and attachment fixtures. */
export async function composerRedesignScenario({
  client,
  evaluate,
  waitForValue,
  screenshot,
  outDir,
}) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const imagePath = join(outDir, "redesign-reference.png");
  await writeFile(imagePath, await readFile(new URL("../build/icon.png", import.meta.url)));
  const setup = await evaluate(
    client,
    `(() => {
    const dev = window.__poracodeDev;
    dev.closeSettings();
    dev.stores.app.getState().openHome();
    const project = dev.stores.app.getState().projects.find((entry) => entry.location.kind === "posix" && entry.id !== "__lightcode_home__");
    if (!project) throw new Error("missing fixture project");
    const providers = ["claude", "codex", "cursor", "gemini"].map((kind) => ({
      kind, label: kind[0].toUpperCase() + kind.slice(1), installed: true, authState: "authenticated", envKind: "posix",
      capabilities: { models: [{ id: "favorite", label: kind === "cursor" ? "Claude via Cursor" : "Favorite " + kind }, { id: "extra", label: "Extra " + kind }],
        efforts: [], modelEfforts: {}, modes: ["agent"], approvalPolicies: [], sandboxModes: [], supportsResume: true, supportsDirectInput: true, liveInputMode: "terminal", presentationMode: "terminal", presentationModes: ["terminal", "gui"], settingDefs: [] },
    }));
    dev.stores.agentStatuses.getState().hydrateFromCache({ windows: providers, wsl: [] });
    dev.stores.sharedSettings.setState({ providerOrder: [], favoriteModels: providers.flatMap((provider) => ["terminal", "gui"].map((presentationMode) => ({ agentKind: provider.kind, modelId: "favorite", presentationMode }))), hiddenModels: {} });
    dev.stores.app.getState().saveDraftContent(project.id, { segments: [], attachments: [{ id: "redesign-image", path: ${JSON.stringify(imagePath)}, name: "redesign-preview.png", isImage: true }] });
    return { projectId: project.id };
  })()`,
  );
  await evaluate(
    client,
    `window.__poracodeDev.stores.app.getState().openDraft(${JSON.stringify(setup.projectId)})`,
  );
  await waitForValue(
    () =>
      evaluate(
        client,
        `(() => { const image = document.querySelector('.poracode-composer-image-preview img'); return Boolean(image?.complete && image.naturalWidth > 0); })()`,
      ),
    Boolean,
    "composer image fixture",
  );
  const image = await evaluate(
    client,
    `(() => {
    const image = document.querySelector('.poracode-composer-image-preview img');
    const box = image.getBoundingClientRect();
    return { width: box.width, height: box.height, decoded: image.complete && image.naturalWidth > 0, fit: getComputedStyle(image).objectFit };
  })()`,
  );
  assert(
    image.width >= 90 && image.height >= 78 && image.decoded && image.fit === "contain",
    `image preview geometry: ${JSON.stringify(image)}`,
  );
  await screenshot(client, join(outDir, "redesign-image.png"));
  await evaluate(
    client,
    `(() => { const button = [...document.querySelectorAll('button[aria-label="Select model"]')].find((entry) => entry.getBoundingClientRect().width > 0); if (!button) throw new Error("missing model picker"); button.click(); })()`,
  );
  const columns = await waitForValue(
    () =>
      evaluate(
        client,
        `(() => { const list = document.querySelector('.poracode-favorite-model-columns'); return list ? { labels: [...list.querySelectorAll('[role="group"]')].map((group) => group.getAttribute('aria-label')), texts: [...list.querySelectorAll('[role="option"]')].map((option) => option.textContent), width: list.getBoundingClientRect().width, layoutWidth: list.offsetWidth, viewport: innerWidth } : null; })()`,
      ),
    (value) => value?.labels.length === 4 && value.width >= value.layoutWidth * 0.99,
    "four subscription columns",
  );
  assert(
    columns.labels.join(",") === "Claude,Codex,Cursor,Gemini",
    `column order: ${columns.labels}`,
  );
  assert(
    !columns.texts.some((text) => text.includes("Extra")),
    "non-favorites leaked into default picker",
  );
  assert(columns.width <= columns.viewport, "picker exceeds viewport");
  await screenshot(client, join(outDir, "redesign-favorites.png"));
  await evaluate(
    client,
    `(() => { const button = [...document.querySelectorAll('button')].find((entry) => entry.textContent.trim() === 'Add to favorites'); if (!button) throw new Error("missing plus action"); button.click(); })()`,
  );
  await waitForValue(
    () =>
      evaluate(
        client,
        `document.querySelector('[role="listbox"][aria-label="Models"]')?.textContent.includes("Extra codex")`,
      ),
    Boolean,
    "extra model catalog",
  );
  await evaluate(
    client,
    `(() => { const row = [...document.querySelectorAll('[role="option"]')].find((entry) => entry.textContent.includes('Extra codex')); row.click(); })()`,
  );
  await waitForValue(
    () =>
      evaluate(
        client,
        `window.__poracodeDev.stores.sharedSettings.getState().favoriteModels.some((ref) => ref.agentKind === 'codex' && ref.modelId === 'extra')`,
      ),
    Boolean,
    "favorite persistence",
  );
  await evaluate(
    client,
    `(() => { const button = [...document.querySelectorAll('button')].find((entry) => entry.textContent.trim() === 'Favorites'); button.click(); })()`,
  );
  await waitForValue(
    () =>
      evaluate(
        client,
        `document.querySelector('.poracode-favorite-model-columns')?.textContent.includes('Extra codex')`,
      ),
    Boolean,
    "new favorite in account column",
  );
  await evaluate(
    client,
    `document.querySelector('[role="combobox"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
  );
  await evaluate(
    client,
    `document.querySelector('button[aria-label="Remove redesign-preview.png"]').click()`,
  );
  await waitForValue(
    () => evaluate(client, `!document.querySelector('.poracode-composer-image-preview')`),
    Boolean,
    "image removal",
  );
  return {
    image,
    columns,
    catalog: "added through real row control",
    attachments: "removed through real control",
    providers: "mocked; no external turn",
  };
}
