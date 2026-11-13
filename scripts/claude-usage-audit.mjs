#!/usr/bin/env node
// Local, opt-in OTLP/HTTP JSON receiver. It never persists prompts, responses,
// tool arguments, resource attributes or credentials. No global settings change.
// Repeat against an isolated Orzi app after quota returns (use a fresh --root):
// node scripts/claude-usage-audit.mjs --out .tmp/usage-audit -- node \
//   .agents/skills/interactive-testing/scripts/run-poracode-smoke.mjs \
//   --launch-only --new --mode real --root /private/tmp/orzi-usage-audit-UNIQUE
// Exercise GUI background agents, fork skills, Crossagents and PTY separately;
// POST {"name":"gui_background"} to collector.json endpoint + /phase before
// each scenario. Stop the isolated app normally to flush its final telemetry.
// Inspect report.json groups by phase/querySource/model. Cost is an API-price
// estimate, never a measured percentage of a subscription allowance.
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const counters = [
  "input_tokens",
  "output_tokens",
  "cache_read_tokens",
  "cache_creation_tokens",
  "cost_usd",
];

function attributes(record) {
  return Object.fromEntries(
    (record.attributes ?? []).map(({ key, value }) => [
      key,
      value?.stringValue ?? value?.intValue ?? value?.doubleValue,
    ]),
  );
}

export function createUsageAudit() {
  const seen = new Set();
  const requests = [];
  const quotaObservations = [];
  const phases = [{ name: "unclassified", startedAt: Date.now() }];
  let duplicates = 0;
  let errors = 0;
  return {
    observeQuota(payload) {
      if (
        !payload ||
        !["sdk-rate-limit", "account-snapshot"].includes(payload.source) ||
        !Number.isFinite(payload.timestamp) ||
        !Array.isArray(payload.windows)
      ) {
        throw new Error("Expected a timestamped quota observation with a known source");
      }
      const windows = payload.windows.map((window) => {
        if (
          typeof window.id !== "string" ||
          window.id.length > 80 ||
          !Number.isFinite(window.usedPercent) ||
          window.usedPercent < 0 ||
          window.usedPercent > 100 ||
          (window.resetsAt !== undefined &&
            (!Number.isFinite(window.resetsAt) || window.resetsAt <= 0))
        ) {
          throw new Error("Invalid quota window");
        }
        return {
          id: window.id,
          usedPercent: window.usedPercent,
          ...(window.resetsAt !== undefined ? { resetsAt: window.resetsAt } : {}),
        };
      });
      quotaObservations.push({ source: payload.source, timestamp: payload.timestamp, windows });
    },
    mark(name) {
      if (typeof name !== "string" || !/^[a-z0-9_-]{1,80}$/.test(name)) {
        throw new Error("Phase must contain 1-80 lowercase ASCII letters, digits, _ or -");
      }
      phases.push({ name, startedAt: Date.now() });
    },
    ingest(payload) {
      if (!Array.isArray(payload?.resourceLogs)) throw new Error("Expected OTLP resourceLogs");
      for (const resource of payload.resourceLogs) {
        for (const scope of resource.scopeLogs ?? []) {
          for (const record of scope.logRecords ?? []) {
            const attrs = attributes(record);
            const event = attrs["event.name"] ?? record.body?.stringValue;
            if (event === "api_error" || event === "claude_code.api_error") {
              errors += 1;
              continue;
            }
            if (event !== "api_request" && event !== "claude_code.api_request") continue;
            const timestamp = Number(record.timeUnixNano) / 1e6;
            if (!Number.isFinite(timestamp) || timestamp <= 0) {
              throw new Error("API request has no valid timeUnixNano");
            }
            const numeric = Object.fromEntries(
              counters.map((key) => {
                const value = attrs[key] === undefined ? null : Number(attrs[key]);
                if (value !== null && (!Number.isFinite(value) || value < 0)) {
                  throw new Error(`Invalid ${key}`);
                }
                return [key, value];
              }),
            );
            const row = {
              timestamp,
              querySource: String(attrs.query_source ?? "unknown").slice(0, 160),
              model: String(attrs.model ?? "unknown").slice(0, 160),
              ...numeric,
            };
            const id = createHash("sha256")
              .update(
                JSON.stringify([
                  attrs.request_id ?? attrs.client_request_id ?? null,
                  attrs["session.id"] ?? null,
                  attrs.request_id || attrs.client_request_id ? null : row,
                ]),
              )
              .digest("hex");
            if (seen.has(id)) {
              duplicates += 1;
              continue;
            }
            seen.add(id);
            requests.push(row);
          }
        }
      }
    },
    report() {
      const groups = new Map();
      for (const row of requests) {
        const phase =
          phases.findLast((item) => item.startedAt <= row.timestamp)?.name ?? "unclassified";
        const groupKey = JSON.stringify([phase, row.querySource, row.model]);
        const group = groups.get(groupKey) ?? {
          phase,
          querySource: row.querySource,
          model: row.model,
          requests: 0,
          ...Object.fromEntries(counters.map((key) => [key, 0])),
          missingCounters: {},
        };
        group.requests += 1;
        for (const key of counters) {
          if (row[key] === null) group.missingCounters[key] = (group.missingCounters[key] ?? 0) + 1;
          else group[key] += row[key];
        }
        groups.set(groupKey, group);
      }
      const quotaGroups = new Map();
      for (const observation of [...quotaObservations].sort((a, b) => a.timestamp - b.timestamp)) {
        const phase =
          phases.findLast((item) => item.startedAt <= observation.timestamp)?.name ??
          "unclassified";
        for (const window of observation.windows) {
          const key = JSON.stringify([phase, observation.source, window.id]);
          const group = quotaGroups.get(key) ?? {
            phase,
            source: observation.source,
            windowId: window.id,
            first: window,
            last: window,
            observations: 0,
          };
          group.last = window;
          group.observations += 1;
          quotaGroups.set(key, group);
        }
      }
      return {
        schemaVersion: 1,
        measurementStatus:
          requests.length === 0
            ? "no-successful-requests"
            : requests.some(
                  (row) =>
                    row.querySource === "unknown" || counters.some((key) => row[key] === null),
                )
              ? "incomplete-counters"
              : "captured",
        interpretation:
          "API price estimates and token counts, not subscription quota percentages. Zero requests means no measurement, not zero overhead.",
        requests: requests.length,
        errors,
        duplicates,
        phases,
        groups: [...groups.values()],
        quota: {
          interpretation:
            "Observed account usage, potentially including other sessions. Rounded or zero deltas do not prove zero overhead. A reset invalidates a comparison.",
          observations: quotaObservations,
          changes: [...quotaGroups.values()].map(({ first, last, ...group }) => ({
            ...group,
            firstUsedPercent: first.usedPercent,
            lastUsedPercent: last.usedPercent,
            deltaPercentagePoints:
              group.observations >= 2 &&
              first.resetsAt !== undefined &&
              first.resetsAt === last.resetsAt &&
              last.usedPercent >= first.usedPercent
                ? last.usedPercent - first.usedPercent
                : null,
          })),
        },
      };
    },
  };
}

export async function startUsageAudit({ outDir, port = 0 }) {
  await mkdir(outDir, { recursive: true });
  const audit = createUsageAudit();
  const prefix = `/${randomBytes(16).toString("hex")}`;
  const reportPath = join(outDir, "report.json");
  let writes = Promise.resolve();
  const persist = () => {
    const report = JSON.stringify(audit.report(), null, 2) + "\n";
    writes = writes.then(() => writeFile(reportPath, report, { mode: 0o600 }));
    return writes;
  };
  const server = createServer((req, res) => {
    void (async () => {
      try {
        if (req.method === "GET" && req.url === `${prefix}/report`) {
          res
            .writeHead(200, { "Content-Type": "application/json" })
            .end(JSON.stringify(audit.report()));
          return;
        }
        if (
          req.method !== "POST" ||
          ![`${prefix}/v1/logs`, `${prefix}/phase`, `${prefix}/quota`].includes(req.url)
        ) {
          res.writeHead(404).end();
          return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4 * 1024 * 1024) throw new Error("OTLP batch exceeds 4 MiB");
          chunks.push(chunk);
        }
        let body = Buffer.concat(chunks);
        if (req.headers["content-encoding"] === "gzip")
          body = gunzipSync(body, { maxOutputLength: 4 * 1024 * 1024 });
        const payload = JSON.parse(body.toString("utf8"));
        if (req.url === `${prefix}/phase`) audit.mark(payload.name);
        else if (req.url === `${prefix}/quota`) audit.observeQuota(payload);
        else audit.ingest(payload);
        await persist();
        res.writeHead(200, { "Content-Type": "application/json" }).end("{}");
      } catch {
        res.writeHead(400).end("Invalid audit request");
      }
    })();
  });
  await new Promise((ready, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", ready);
  });
  const endpoint = `http://127.0.0.1:${server.address().port}${prefix}`;
  const env = {
    CLAUDE_CODE_ENABLE_TELEMETRY: "1",
    OTEL_METRICS_EXPORTER: "none",
    OTEL_LOGS_EXPORTER: "otlp",
    OTEL_TRACES_EXPORTER: "none",
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "http/json",
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `${endpoint}/v1/logs`,
    OTEL_EXPORTER_OTLP_HEADERS: "",
    OTEL_EXPORTER_OTLP_LOGS_HEADERS: "",
    OTEL_LOGS_EXPORT_INTERVAL: "1000",
    OTEL_LOG_USER_PROMPTS: "0",
    OTEL_LOG_ASSISTANT_RESPONSES: "0",
    OTEL_LOG_TOOL_DETAILS: "0",
    OTEL_LOG_TOOL_CONTENT: "0",
    OTEL_LOG_RAW_API_BODIES: "0",
    ENABLE_BETA_TRACING_DETAILED: "0",
    BETA_TRACING_ENDPOINT: "",
  };
  await writeFile(
    join(outDir, "collector.json"),
    JSON.stringify({ endpoint, env, reportPath }, null, 2),
    { mode: 0o600 },
  );
  await persist();
  return {
    endpoint,
    env,
    reportPath,
    observeQuota: async (payload) => {
      audit.observeQuota(payload);
      await persist();
    },
    mark: async (name) => {
      audit.mark(name);
      await persist();
    },
    close: async () => {
      await new Promise((closed, reject) =>
        server.close((error) => (error ? reject(error) : closed())),
      );
      await persist();
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (
    args.length < 2 ||
    args[0] !== "--out" ||
    (args.length > 2 && (args[2] !== "--" || args.length < 4))
  ) {
    console.error(
      "Usage: node scripts/claude-usage-audit.mjs --out .tmp/claude-usage-audit [-- command ...args]",
    );
    process.exitCode = 1;
  } else {
    const collector = await startUsageAudit({ outDir: resolve(args[1]) });
    console.log(JSON.stringify({ endpoint: collector.endpoint, reportPath: collector.reportPath }));
    const child =
      args[2] === "--"
        ? spawn(args[3], args.slice(4), {
            stdio: "inherit",
            env: { ...process.env, ...collector.env },
          })
        : undefined;
    let closing;
    const close = () => (closing ??= collector.close());
    const finish = (code) => {
      process.exitCode = code;
      void close().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
    };
    if (child) {
      child.once("error", (error) => {
        console.error(error.message);
        finish(1);
      });
      child.once("exit", (code, signal) => finish(code ?? (signal === "SIGINT" ? 130 : 1)));
    }
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, () => {
        if (child && child.exitCode === null && child.signalCode === null) child.kill(signal);
        else finish(signal === "SIGINT" ? 130 : 143);
      });
  }
}
