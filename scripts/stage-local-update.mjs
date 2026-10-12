#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = process.argv[2];
if (!source)
  throw new Error("Usage: node scripts/stage-local-update.mjs <verified Orzi Code.app> [profile]");
const result = spawnSync(
  "/usr/bin/python3",
  [
    "-I",
    join(dirname(fileURLToPath(import.meta.url)), "../resources/local-update/install.py"),
    "stage",
    "--source",
    resolve(source),
    "--profile",
    resolve(process.argv[3] ?? join(homedir(), ".poracode-personal")),
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
