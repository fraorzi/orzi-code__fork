import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { persistThemeBoot } from "./applyAppTheme";

function runBootScript() {
  const html = readFileSync("index.html", "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const script = [...parsed.querySelectorAll("script")].find((entry) =>
    entry.textContent?.includes("poracode-boot-v2"),
  );
  if (!script?.textContent) throw new Error("missing theme boot script");
  window.eval(script.textContent);
}

afterEach(() => {
  localStorage.removeItem("poracode-boot");
  localStorage.removeItem("poracode-boot-v2");
  localStorage.removeItem("poracode-shared-settings");
  document.documentElement.style.removeProperty("background-color");
});

describe("default palette upgrade", () => {
  it("ignores the previous release background cache and keeps the saved appearance", () => {
    localStorage.setItem("poracode-boot", JSON.stringify({ appearance: "light", bg: "#070709" }));
    localStorage.setItem("poracode-shared-settings", JSON.stringify({ themeMode: "dark" }));
    runBootScript();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.backgroundColor).toBe("");
  });

  it("persists and reads the new palette before the renderer mounts", () => {
    persistThemeBoot("dark", "default");
    expect(JSON.parse(localStorage.getItem("poracode-boot-v2") ?? "null")).toEqual({
      appearance: "dark",
      bg: "#191919",
    });
    runBootScript();
    expect(document.documentElement.style.backgroundColor).toBe("rgb(25, 25, 25)");
  });
});
