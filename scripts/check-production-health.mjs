import { execFileSync } from 'node:child_process';
import { sendAlertWebhook } from './lib/alert-webhook.mjs';

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

async function deliverAlert(message) {
  try {
    const result = await sendAlertWebhook(message);
    if (result.skipped) {
      console.error('[Junshi 告警] 未配置 JUNSHI_ALERT_WEBHOOK_URL，本次仅写入 journal');
    } else {
      console.log(`[Junshi 告警] 已投递（format=${result.format}, status=${result.status}）`);
    }
  } catch (error) {
    // sendAlertWebhook 不会把 URL 放进错误信息，避免 journal 泄漏密钥。
    console.error(`[Junshi 告警投递失败] ${String(error?.message || error)}`);
  }
}

if (process.argv.includes('--test-webhook')) {
  try {
    const result = await sendAlertWebhook(`[Junshi 告警测试] 健康检查 Webhook 链路正常 · ${new Date().toISOString()}`);
    if (result.skipped) throw new Error('JUNSHI_ALERT_WEBHOOK_URL 未配置');
    console.log(JSON.stringify({ ok: true, test: true, format: result.format, status: result.status }));
  } catch (error) {
    console.error(`[Junshi 告警测试失败] ${String(error?.message || error)}`);
    process.exitCode = 1;
  }
} else {
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
    await deliverAlert(`[Junshi 生产告警]\n${failures.join('\n')}\n${result.checkedAt}`);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ ok: true, checkedAt: result.checkedAt }));
  }
}