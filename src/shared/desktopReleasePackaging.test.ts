import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CHANGELOG_URL, changelogDocumentSchema } from "./changelog";

function generatedConfig(channel: string, signed: boolean): unknown {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {buildElectronBuilderConfig} from './scripts/build-desktop-artifact.mjs';
       import {parse} from 'yaml';
       import {validateConfiguration} from 'app-builder-lib/out/util/config/config.js';
       import {DebugLogger} from 'builder-util/out/debugLogger.js';
       const yaml = buildElectronBuilderConfig('updater', ${signed});
       await validateConfiguration(parse(yaml), new DebugLogger());
       process.stdout.write(yaml);`,
    ],
    { encoding: "utf8", env: { ...process.env, PORACODE_CHANNEL: channel } },
  );
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return parse(result.stdout);
}

describe("fork release packaging", () => {
  it.each(["stable", "nightly"])(
    "embeds the %s fork feed without an upstream fallback",
    (channel) => {
      expect(generatedConfig(channel, false)).toMatchObject({
        productName: channel === "nightly" ? "Orzi Code Nightly" : "Orzi Code",
        publish: {
          provider: "github",
          owner: "fraorzi",
          repo: "orzi-code__fork",
          private: false,
          channel: channel === "nightly" ? "nightly" : "latest",
        },
        mac: { identity: "-", notarize: false },
      });
    },
  );

  it("requires signing and notarization for release bundles", () => {
    const config = generatedConfig("stable", true);
    expect(config).toMatchObject({ mac: { forceCodeSigning: true, notarize: true } });
    expect(config).not.toMatchObject({ mac: { identity: "-" } });
  });

  it.each([
    "CSC_LINK",
    "CSC_KEY_PASSWORD",
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
  ])("rejects missing %s before building or staging", (missing) => {
    const env = {
      ...process.env,
      CSC_LINK: "fixture",
      CSC_KEY_PASSWORD: "fixture",
      APPLE_ID: "fixture",
      APPLE_APP_SPECIFIC_PASSWORD: "fixture",
      APPLE_TEAM_ID: "fixture",
      [missing]: "",
    };
    const result = spawnSync(
      process.execPath,
      [
        "scripts/build-desktop-artifact.mjs",
        "--platform",
        "mac",
        "--release-signing",
        "--skip-build",
      ],
      { encoding: "utf8", env },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Signed release requires ${missing}.`);
    expect(result.stdout).not.toContain("[stage]");
  });

  it("keeps releases manually dispatched from main and preserves published tags on cleanup", () => {
    for (const file of ["release.yml", "release-nightly.yml"]) {
      const text = readFileSync(`.github/workflows/${file}`, "utf8");
      const workflow: unknown = parse(text);
      expect(workflow).toMatchObject({ on: { workflow_dispatch: {} } });
      expect(workflow).not.toMatchObject({ on: { push: {} } });
      expect(text).toContain("ref: main");
      expect(text).not.toContain("ref: master");
      expect(text).not.toContain('gh release delete "$RELEASE_TAG"');
      expect(text).not.toContain('git/refs/tags/$RELEASE_TAG"');
    }
    const build = readFileSync(".github/workflows/_build.yml", "utf8");
    expect(build).toContain("--release-signing");
    expect(build).toContain("release/Orzi-Code-*.zip");
    expect(build).not.toContain("release/Poracode-");
  });

  it("uses separately validated fork notes without inventing a published release", () => {
    expect(CHANGELOG_URL).toBe(
      "https://raw.githubusercontent.com/fraorzi/orzi-code__fork/main/docs/fork/changelog.json",
    );
    const document: unknown = JSON.parse(readFileSync("docs/fork/changelog.json", "utf8"));
    expect(changelogDocumentSchema.safeParse(document).success).toBe(true);
    expect(readFileSync(".github/workflows/release.yml", "utf8")).toContain(
      "docs/fork/changelog.json",
    );
  });
});
