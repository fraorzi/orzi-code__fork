#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// One-time bootstrap for installations predating the in-app local updater.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profile = resolve(process.argv[2] ?? join(homedir(), ".poracode-personal"));
const target = resolve(process.argv[3] ?? "/Applications/Orzi Code.app");
const manifest = JSON.parse(readFileSync(join(profile, "local-updates/ready.json"), "utf8"));
if (manifest.version !== 1 || !/^[a-f0-9]{64}$/.test(manifest.sha256))
  throw new Error("Unsupported staged update.");
const output = join(repo, ".tmp/local-update-launcher");
mkdirSync(output, { recursive: true });
const installer = join(output, "install.py");
copyFileSync(join(repo, "resources/local-update/install.py"), installer);
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const command = [
  "/usr/bin/python3",
  "-I",
  installer,
  "install",
  "--profile",
  profile,
  "--target",
  target,
  "--wait-pid",
  "2147483647",
  "--sha256",
  manifest.sha256,
]
  .map(quote)
  .join(" ");
const appleScript = `display dialog "Zakończ aktywne zadania i zamknij Orzi Code. Następnie kliknij Instaluj. Aplikacja uruchomi się ponownie po aktualizacji." buttons {"Anuluj", "Instaluj"} default button "Instaluj" cancel button "Anuluj" with title "Aktualizacja Orzi Code"
try
  do shell script ${JSON.stringify(command)}
on error details
  display dialog "Instalacja nie została ukończona. " & details buttons {"OK"} with title "Aktualizacja Orzi Code"
end try
`;
const source = join(output, "launcher.applescript");
writeFileSync(source, appleScript);
const app = join(output, "Zaktualizuj Orzi Code.app");
execFileSync("/usr/bin/osacompile", ["-o", app, source]);
console.log(app);
