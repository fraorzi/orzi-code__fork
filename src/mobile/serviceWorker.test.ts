import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { buildLocalPairingServiceWorkerJs } from "@/main/remote/pairingPage";

describe("PWA service workers", () => {
  it.each([
    [
      "hosted",
      readFileSync("public/service-worker.js", "utf8").replace(
        "__PORACODE_BUILD_VERSION__",
        "test",
      ),
      "poracode-pwa",
    ],
    ["desktop-served", buildLocalPairingServiceWorkerJs("test"), "poracode-remote-local"],
  ])(
    "%s worker drops pre-redesign shell caches at the same package version",
    async (_surface, worker, prefix) => {
      const keys = new Set([`${prefix}-test`, `${prefix}-v2-test`, "another-app-cache"]);
      let activate: ((event: { waitUntil: (work: Promise<unknown>) => void }) => void) | undefined;
      runInNewContext(worker, {
        URL,
        self: {
          location: { href: "https://app.example.test/service-worker.js" },
          addEventListener: (name: string, handler: NonNullable<typeof activate>) => {
            if (name === "activate") activate = handler;
          },
          clients: { claim: () => Promise.resolve() },
        },
        caches: {
          keys: () => Promise.resolve([...keys]),
          delete: (name: string) => Promise.resolve(keys.delete(name)),
        },
      });
      if (!activate) throw new Error("missing worker activation");
      let pending: Promise<unknown> | undefined;
      activate({
        waitUntil: (work) => {
          pending = work;
        },
      });
      if (!pending) throw new Error("worker activation did not wait for cleanup");
      await pending;
      expect(keys).toEqual(new Set([`${prefix}-v2-test`, "another-app-cache"]));
    },
  );
  it.each([
    ["hosted", readFileSync("public/service-worker.js", "utf8")],
    ["desktop-served", buildLocalPairingServiceWorkerJs("test")],
  ])("%s worker handles push display and notification routing", (_surface, worker) => {
    expect(worker).toContain('self.addEventListener("push"');
    expect(worker).toContain("self.registration.showNotification");
    expect(worker).toContain('self.addEventListener("notificationclick"');
    expect(worker).toContain("self.clients.openWindow(targetUrl)");
    expect(worker).toContain('client.visibilityState === "visible"');
  });
});
