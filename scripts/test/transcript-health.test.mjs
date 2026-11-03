import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { evaluateTranscriptHealth } from '../lib/transcript-health.mjs';

function row(status, durationMs = 10000) {
  return { status, duration_ms: durationMs };
}

test('transcript health skips when samples are below threshold', () => {
  const result = evaluateTranscriptHealth([row('failed', 1000)], { minSamples: 5 });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.match(result.reason, /样本不足/);
});

test('transcript health alerts on low success rate', () => {
  const result = evaluateTranscriptHealth([
    row('succeeded'), row('failed'), row('failed'), row('failed'), row('failed'),
  ], { minSamples: 5, successRateThreshold: 70, p95ThresholdMs: 180000 });
  assert.equal(result.ok, false);
  assert.equal(result.successRate, 20);
  assert.ok(result.failures.some((item) => item.includes('成功率')));
});

test('transcript health alerts on high p95 duration', () => {
  const result = evaluateTranscriptHealth([
    row('succeeded', 10000), row('succeeded', 20000), row('succeeded', 30000),
    row('succeeded', 240000), row('succeeded', 260000),
  ], { minSamples: 5, successRateThreshold: 70, p95ThresholdMs: 180000 });
  assert.equal(result.ok, false);
  assert.ok(result.p95Ms > 180000);
  assert.ok(result.failures.some((item) => item.includes('P95')));
});

test('transcript health passes healthy samples', () => {
  const result = evaluateTranscriptHealth([
    row('succeeded', 10000), row('succeeded', 12000), row('succeeded', 14000),
    row('succeeded', 16000), row('failed', 18000),
  ], { minSamples: 5, successRateThreshold: 70, p95ThresholdMs: 180000 });
  assert.equal(result.ok, true);
  assert.equal(result.successRate, 80);
});

test('health check resolves mysql2 from the platform-core dependency context', () => {
  const requireFromCore = createRequire(new URL('../../packages/platform-core/package.json', import.meta.url));
  assert.equal(typeof requireFromCore('mysql2/promise').createConnection, 'function');
});
