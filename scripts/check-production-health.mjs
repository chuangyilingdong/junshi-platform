import { execFileSync } from 'node:child_process';

const checks = [];
const failures = [];

async function fetchCheck(name, url, validate) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch { body = null; }
    const ok = response.ok && validate(body, text);
    checks.push({ name, ok, status: response.status, elapsedMs: Date.now() - startedAt });
    if (!ok) failures.push(`${name}: HTTP ${response.status}`);
  } catch (error) {
    checks.push({ name, ok: false, elapsedMs: Date.now() - startedAt, error: String(error?.message || error) });
    failures.push(`${name}: ${String(error?.message || error)}`);
  }
}

function serviceCheck(name) {
  try {
    const status = execFileSync('systemctl', ['is-active', name], { encoding: 'utf8' }).trim();
    const ok = status === 'active';
    checks.push({ name: `service:${name}`, ok, status });
    if (!ok) failures.push(`service:${name}: ${status}`);
  } catch (error) {
    checks.push({ name: `service:${name}`, ok: false, status: 'inactive' });
    failures.push(`service:${name}: inactive`);
  }
}

async function notify(message) {
  const url = String(process.env.JUNSHI_ALERT_WEBHOOK_URL || '').trim();
  if (!url) return;
  const format = String(process.env.JUNSHI_ALERT_WEBHOOK_FORMAT || 'generic').trim().toLowerCase();
  const payload = format === 'feishu'
    ? { msg_type: 'text', content: { text: message } }
    : { service: 'junshi-platform', severity: 'error', text: message };
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

await fetchCheck('api:health', 'http://127.0.0.1:8790/health', (body) => body?.service === 'junshi-api');
await fetchCheck('api:ready', 'http://127.0.0.1:8790/ready', (body) => body?.status === 'ready' && body?.databaseHealth?.ok === true);
await fetchCheck('api:cutover-ready', 'http://127.0.0.1:8790/cutover-ready', (body) => body?.ready === true && body?.status === 'ready');
await fetchCheck('public:junshi', 'https://aicyld.com/api/junshi/health', (body) => body?.service === 'junshi-api');
await fetchCheck('public:website', 'https://aicyld.com/api/health', (body) => body?.data?.service === 'ai-kids-platform');
serviceCheck('junshi-api');
serviceCheck('nginx');
serviceCheck('learning-platform-production');

const result = {
  ok: failures.length === 0,
  checkedAt: new Date().toISOString(),
  failures,
  checks,
};
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  await notify(`[Junshi 生产告警]\n${failures.join('\n')}\n${result.checkedAt}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, checkedAt: result.checkedAt }));
}