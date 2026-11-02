export const ALERT_WEBHOOK_FORMATS = Object.freeze(['generic', 'feishu']);

function normalizeFormat(value) {
  const format = String(value || 'generic').trim().toLowerCase();
  if (!ALERT_WEBHOOK_FORMATS.includes(format)) {
    throw new Error(`Unsupported alert webhook format: ${format}`);
  }
  return format;
}

export function buildAlertWebhookPayload(message, format = 'generic') {
  const text = String(message || '').trim();
  if (!text) throw new Error('Alert message is required');
  const normalized = normalizeFormat(format);
  return normalized === 'feishu'
    ? { msg_type: 'text', content: { text } }
    : { service: 'junshi-platform', severity: 'error', text };
}

/**
 * Send a health-check alert without ever including the webhook URL in errors.
 * A missing URL is an explicit no-op so deployments can opt in later.
 */
export async function sendAlertWebhook(message, {
  url = process.env.JUNSHI_ALERT_WEBHOOK_URL,
  format = process.env.JUNSHI_ALERT_WEBHOOK_FORMAT || 'generic',
  fetchImpl = globalThis.fetch,
  timeoutMs = 10000,
} = {}) {
  const target = String(url || '').trim();
  if (!target) return { ok: true, skipped: true };
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error('Alert webhook URL is invalid');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Alert webhook URL must use HTTP or HTTPS');
  }
  if (typeof fetchImpl !== 'function') throw new Error('Fetch implementation is unavailable');

  const normalized = normalizeFormat(format);
  const payload = buildAlertWebhookPayload(message, normalized);
  let response;
  try {
    response = await fetchImpl(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Math.min(60000, Math.max(1000, Number(timeoutMs) || 10000))),
    });
  } catch (error) {
    const detail = String(error?.message || error).replaceAll(target, '[redacted]');
    throw new Error('Alert webhook request failed: ' + detail);
  }

  let bodyText = '';
  try { bodyText = await response.text(); } catch { bodyText = ''; }
  if (!response.ok) throw new Error(`Alert webhook rejected: HTTP ${response.status}`);
  if (normalized === 'feishu') {
    let body = null;
    try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = null; }
    const rawCode = body?.code ?? body?.StatusCode ?? body?.status_code;
    const code = Number(rawCode);
    if (!body || rawCode === undefined || rawCode === null || !Number.isFinite(code) || code !== 0) {
      const messageText = String(body?.msg || body?.StatusMessage || '').slice(0, 120);
      throw new Error(`Alert webhook returned an invalid Feishu response${messageText ? `: ${messageText}` : ''}`);
    }
  }
  return { ok: true, skipped: false, status: response.status, format: normalized };
}