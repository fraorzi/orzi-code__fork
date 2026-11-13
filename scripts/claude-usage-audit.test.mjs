import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { createUsageAudit, startUsageAudit } from "./claude-usage-audit.mjs";

function batch(attrs, timestamp = Date.now()) {
  return {
    resourceLogs: [
      {
        resource: { attributes: [{ key: "secret", value: { stringValue: "PRIVATE_RESOURCE" } }] },
        scopeLogs: [
          {
            logRecords: [
              {
                timeUnixNano: String(BigInt(timestamp) * 1000000n),
                body: { stringValue: "claude_code.api_request" },
                attributes: Object.entries(attrs).map(([key, value]) => ({
                  key,
                  value: { stringValue: String(value) },
                })),
              },
            ],
          },
        ],
      },
    ],
  };
}

void test("counts hidden requests separately, deduplicates exports and preserves missing counters", () => {
  const audit = createUsageAudit();
  audit.mark("gui");
  const main = batch({
    request_id: "req_main",
    query_source: "repl_main_thread",
    input_tokens: 20,
    cost_usd: 0.01,
  });
  audit.ingest(main);
  audit.ingest(main);
  audit.ingest(
    batch({
      request_id: "req_summary",
      query_source: "agent_summary",
      input_tokens: 3,
      cache_read_tokens: 1000,
      cost_usd: 0.002,
    }),
  );
  const report = audit.report();
  assert.equal(report.requests, 2);
  assert.equal(report.duplicates, 1);
  assert.equal(report.groups[1].querySource, "agent_summary");
  assert.equal(report.groups[1].cache_read_tokens, 1000);
  assert.equal(report.groups[1].missingCounters.output_tokens, 1);
  assert.equal(report.groups[1].phase, "gui");
  assert.equal(report.measurementStatus, "incomplete-counters");
  assert.throws(() => audit.ingest(batch({ input_tokens: "NaN" })), /Invalid input_tokens/);
});

void test("empty telemetry is inconclusive and complete counters are explicitly marked", () => {
  const audit = createUsageAudit();
  assert.equal(audit.report().measurementStatus, "no-successful-requests");
  audit.ingest(
    batch({
      request_id: "request",
      query_source: "agent_summary",
      model: "test-model",
      input_tokens: 10,
      output_tokens: 2,
      cache_read_tokens: 100,
      cache_creation_tokens: 3,
      cost_usd: 0.001,
    }),
  );
  assert.equal(audit.report().measurementStatus, "captured");
});

void test("uses event time, rather than delayed delivery time, to attribute phases", () => {
  const audit = createUsageAudit();
  audit.mark("next");
  audit.ingest(batch({ request_id: "earlier", input_tokens: 0 }, Date.now() - 1000));
  assert.equal(audit.report().groups[0].phase, "unclassified");
  assert.throws(() => audit.mark("bad/name"), /Phase/);
});

void test("quota observations preserve zero and refuse comparisons across resets or missing reset times", () => {
  const audit = createUsageAudit();
  audit.mark("quota");
  const at = Date.now() + 1;
  audit.observeQuota({
    source: "sdk-rate-limit",
    timestamp: at,
    windows: [{ id: "session-5h", usedPercent: 0, resetsAt: at + 100000 }],
  });
  audit.observeQuota({
    source: "sdk-rate-limit",
    timestamp: at + 1,
    windows: [{ id: "session-5h", usedPercent: 0.3, resetsAt: at + 100000 }],
  });
  assert.equal(audit.report().quota.changes[0].deltaPercentagePoints, 0.3);
  audit.observeQuota({
    source: "sdk-rate-limit",
    timestamp: at + 2,
    windows: [{ id: "session-5h", usedPercent: 0, resetsAt: at + 200000 }],
  });
  assert.equal(audit.report().quota.changes[0].deltaPercentagePoints, null);
  audit.observeQuota({
    source: "account-snapshot",
    timestamp: at,
    windows: [{ id: "weekly", usedPercent: 3 }],
  });
  audit.observeQuota({
    source: "account-snapshot",
    timestamp: at + 3,
    windows: [{ id: "weekly", usedPercent: 4 }],
  });
  assert.equal(audit.report().quota.changes[1].deltaPercentagePoints, null);
  assert.throws(
    () =>
      audit.observeQuota({
        source: "sdk-rate-limit",
        timestamp: at,
        windows: [{ id: "weekly", usedPercent: undefined }],
      }),
    /Invalid quota window/,
  );
  assert.throws(
    () =>
      audit.observeQuota({
        source: "sdk-rate-limit",
        timestamp: at,
        windows: [{ id: "weekly", usedPercent: 101 }],
      }),
    /Invalid quota window/,
  );
});

void test("CLI scopes telemetry to its child command and closes after the child exits", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "orzi-usage-audit-cli-"));
  try {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/claude-usage-audit.mjs",
        "--out",
        outDir,
        "--",
        process.execPath,
        "--input-type=module",
        "-e",
        `if (process.env.OTEL_LOG_RAW_API_BODIES !== '0') process.exit(2);
       const response = await fetch(process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT, {method:'POST', body:JSON.stringify(${JSON.stringify(batch({ request_id: "cli", query_source: "agent_summary", input_tokens: 3 }))})});
       if (!response.ok) process.exit(3);`,
      ],
      { encoding: "utf8", timeout: 15000 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(await readFile(join(outDir, "report.json"), "utf8"));
    assert.equal(report.requests, 1);
    assert.equal(report.groups[0].querySource, "agent_summary");
    const failed = spawnSync(
      process.execPath,
      ["scripts/claude-usage-audit.mjs", "--out", outDir, "--", join(outDir, "missing-command")],
      { encoding: "utf8", timeout: 15000 },
    );
    assert.equal(failed.status, 1);
    assert.equal(failed.error, undefined);
  } finally {
    await rm(outDir, { recursive: true });
  }
});

void test("real HTTP receiver accepts OTLP JSON/gzip and saves only allowed counters", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "orzi-usage-audit-test-"));
  const collector = await startUsageAudit({ outDir });
  try {
    assert.equal(
      (
        await fetch(`${collector.endpoint}/phase`, {
          method: "POST",
          body: JSON.stringify({ name: "fork_skill" }),
        })
      ).status,
      200,
    );
    const payload = batch({
      request_id: "PRIVATE_ID",
      "session.id": "PRIVATE_SESSION",
      query_source: "agent_summary",
      model: "test-model",
      input_tokens: 10,
      cost_usd: 0.001,
      prompt: "PRIVATE_PROMPT",
      tool_input: "PRIVATE_TOOL",
      response: "PRIVATE_RESPONSE",
    });
    assert.equal(
      (
        await fetch(`${collector.endpoint}/quota`, {
          method: "POST",
          body: JSON.stringify({
            source: "sdk-rate-limit",
            timestamp: Date.now(),
            windows: [{ id: "session-5h", usedPercent: 0, resetsAt: Date.now() + 100000 }],
            prompt: "PRIVATE_QUOTA_PROMPT",
          }),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${collector.endpoint}/v1/logs`, {
          method: "POST",
          headers: { "Content-Encoding": "gzip" },
          body: gzipSync(JSON.stringify(payload)),
        })
      ).status,
      200,
    );
    const report = await (await fetch(`${collector.endpoint}/report`)).json();
    assert.equal(report.requests, 1);
    assert.equal(report.groups[0].phase, "fork_skill");
    assert.equal(
      (await fetch(`${collector.endpoint}/v1/logs`, { method: "POST", body: "{}" })).status,
      400,
    );
    assert.equal(
      (await fetch(`${collector.endpoint}/v1/logs`, { method: "POST", body: "{" })).status,
      400,
    );
    assert.equal((await fetch(`${collector.endpoint}/other`)).status, 404);
    const stored = await readFile(collector.reportPath, "utf8");
    assert.doesNotMatch(stored, /PRIVATE_/);
    assert.equal(JSON.parse(stored).requests, 1);
    assert.equal(collector.env.OTEL_LOG_RAW_API_BODIES, "0");
    assert.match(collector.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT, /^http:\/\/127\.0\.0\.1:/);
  } finally {
    await collector.close();
    await rm(outDir, { recursive: true });
  }
});
