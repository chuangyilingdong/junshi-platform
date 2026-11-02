import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAlertWebhookPayload, sendAlertWebhook } from '../lib/alert-webhook.mjs';

function fakeResponse({ status = 200, body = '{}', ok = status >= 200 && status < 300 } = {}) {
  return { ok, status, text: async () => body };
}

test('generic payload is stable', () => {
  assert.deepEqual(buildAlertWebhookPayload('disk full', 'generic'), {
    service: 'junshi-platform', severity: 'error', text: 'disk full',
  });
});

test('feishu payload is stable', () => {
  assert.deepEqual(buildAlertWebhookPayload('disk full', 'feishu'), {
    msg_type: 'text', content: { text: 'disk full' },
  });
});

test('missing webhook URL is a no-op', async () => {
  let called = false;
  const result = await sendAlertWebhook('ignored', {
    url: '', fetchImpl: async () => { called = true; },
  });
  assert.deepEqual(result, { ok: true, skipped: true });
  assert.equal(called, false);
});

test('generic webhook posts the expected JSON', async () => {
  let seen = null;
  const result = await sendAlertWebhook('service down', {
    url: 'https://example.invalid/hook',
    format: 'generic',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return fakeResponse();
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.format, 'generic');
  assert.equal(seen.url, 'https://example.invalid/hook');
  assert.equal(seen.init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(seen.init.body), {
    service: 'junshi-platform', severity: 'error', text: 'service down',
  });
});

test('feishu webhook accepts code 0', async () => {
  const result = await sendAlertWebhook('ready failed', {
    url: 'https://example.invalid/hook',
    format: 'feishu',
    fetchImpl: async () => fakeResponse({ body: '{"code":0,"msg":"success"}' }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.format, 'feishu');
});

test('feishu webhook rejects API errors', async () => {
  await assert.rejects(
    sendAlertWebhook('ready failed', {
      url: 'https://example.invalid/hook',
      format: 'feishu',
      fetchImpl: async () => fakeResponse({ body: '{"code":19001,"msg":"invalid token"}' }),
    }),
    /invalid Feishu response: invalid token/,
  );
});

test('HTTP failures are surfaced without leaking the webhook URL', async () => {
  const secret = 'https://example.invalid/secret-token';
  await assert.rejects(
    sendAlertWebhook('service down', {
      url: secret,
      fetchImpl: async () => fakeResponse({ status: 503, ok: false }),
    }),
    (error) => {
      assert.match(error.message, /HTTP 503/);
      assert.doesNotMatch(error.message, /secret-token/);
      return true;
    },
  );
});

test('network errors redact the webhook URL', async () => {
  const secret = 'https://example.invalid/secret-token';
  await assert.rejects(
    sendAlertWebhook('service down', {
      url: secret,
      fetchImpl: async (url) => { throw new Error(`connect failed: ${url}`); },
    }),
    (error) => {
      assert.match(error.message, /request failed/);
      assert.doesNotMatch(error.message, /secret-token/);
      return true;
    },
  );
});

test('feishu response must include an explicit success code', async () => {
  await assert.rejects(
    sendAlertWebhook('service down', {
      url: 'https://example.invalid/hook',
      format: 'feishu',
      fetchImpl: async () => fakeResponse({ body: '{}' }),
    }),
    /invalid Feishu response/,
  );
});
test('invalid format and URL are rejected', async () => {
  assert.throws(() => buildAlertWebhookPayload('x', 'slack'), /Unsupported/);
  await assert.rejects(
    sendAlertWebhook('x', { url: 'not-a-url', fetchImpl: async () => fakeResponse() }),
    /URL is invalid/,
  );
});
test('health check --test-webhook delivers a real local HTTP request', async () => {
  const { createServer } = await import('node:http');
  const { spawn } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const script = fileURLToPath(new URL('../check-production-health.mjs', import.meta.url));
  let received = null;
  const server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      received = { method: request.method, headers: request.headers, body };
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"ok":true}');
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  const child = spawn(process.execPath, [script, '--test-webhook'], {
    env: {
      ...process.env,
      JUNSHI_ALERT_WEBHOOK_URL: `http://127.0.0.1:${port}/hook`,
      JUNSHI_ALERT_WEBHOOK_FORMAT: 'generic',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  await new Promise((resolve) => server.close(resolve));
  assert.equal(code, 0, stderr);
  assert.match(stdout, /"test":true/);
  assert.equal(received?.method, 'POST');
  assert.equal(received?.headers['content-type'], 'application/json');
  assert.equal(JSON.parse(received?.body || '{}').service, 'junshi-platform');
}, { timeout: 5000 });