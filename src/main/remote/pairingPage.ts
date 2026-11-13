import { productNameFor, resolvePoracodeChannel } from "@/shared/channel";

function jsonForScript(value: string): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

/**
 * Shared skeleton for the two server-rendered dark pages in this file (the
 * pairing fallback and the forward-enter error). Both are emitted outside the
 * renderer bundle, so they carry no i18n and hand-roll their own minimal HTML.
 * The shell owns the doctype, viewport/theme meta, channel-branded title, and
 * the `<style>`/`<body>` wrappers so that boilerplate lives in one place; each
 * caller supplies any extra `<head>` markup, its page-specific CSS, and the
 * `<body>` inner markup.
 */
function buildDarkPageShell(input: {
  readonly headExtra?: string;
  readonly css: string;
  readonly body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#070709" />
  <title>${productNameFor(resolvePoracodeChannel())}</title>${input.headExtra ?? ""}
  <style>
${input.css}
  </style>
</head>
<body>
${input.body}
</body>
</html>
`;
}

export function buildLocalPairingPageHtml(input: { readonly httpBaseUrl: string }): string {
  const endpointJson = jsonForScript(input.httpBaseUrl);

  return buildDarkPageShell({
    css: `    :root {
      color-scheme: dark;
      --bg: #070709;
      --panel: #0e0e14;
      --line: rgba(255, 255, 255, 0.12);
      --text: #eaf0fb;
      --muted: #9ba6be;
      --accent: #8892ef;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
    }
    button {
      font: inherit;
    }
    .app {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: calc(24px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));
    }
    main {
      width: min(100%, 520px);
      display: grid;
      gap: 16px;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 20px;
      background: var(--panel);
    }
    h1 {
      margin: 0;
      font-size: 22px;
      line-height: 1.2;
    }
    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
    }
    .inline-code {
      color: var(--text);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.92em;
    }
    .endpoint {
      display: block;
      overflow-wrap: anywhere;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--muted);
      font-size: 13px;
    }`,
    body: `  <div class="app">
    <main>
      <h1>${productNameFor(resolvePoracodeChannel())}</h1>
      <p>This desktop-only build does not include a browser app. Connect from another Orzi Code desktop using the endpoint below.</p>
      <p>Desktop endpoint</p>
      <code class="endpoint" id="endpoint"></code>
    </main>
  </div>
  <script>
    document.getElementById("endpoint").textContent = ${endpointJson};
  </script>`,
  });
}

/** Plain error page for a failed `GET /forward/<id>/enter` (invalid/expired
 * token, or a forward that was stopped since the token was minted). Server-
 * rendered outside the renderer bundle, so — like the rest of this file — it
 * carries no i18n; the phone only lands here on a broken/expired deep link. */
export function buildForwardEnterErrorPageHtml(): string {
  return buildDarkPageShell({
    css: `    :root {
      color-scheme: dark;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #070709;
      color: #eaf0fb;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    main {
      width: min(100%, 480px);
      display: grid;
      gap: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 20px;
      background: #0e0e14;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
    }
    p {
      margin: 0;
      color: #9ba6be;
      line-height: 1.45;
    }`,
    body: `  <main>
    <h1>Link expired</h1>
    <p>This forwarded-port link is invalid, expired, or the forward was closed on the desktop. Reopen it from the app.</p>
  </main>`,
  });
}
