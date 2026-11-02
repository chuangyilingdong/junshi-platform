import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

if (process.env.JUNSHI_ALLOW_REAL_PROVIDER !== '1') {
  throw new Error('Set JUNSHI_ALLOW_REAL_PROVIDER=1 to run this paid transcript regression suite');
}

const SITE = process.env.JUNSHI_SITE || 'https://aicyld.com';
const API = `${SITE}/api/junshi/workbench`;
const ORG_ID = String(process.env.JUNSHI_REGRESSION_ORG_ID || '').trim();
const USER_ID = String(process.env.JUNSHI_REGRESSION_USER_ID || '').trim();
if (!ORG_ID || !USER_ID) throw new Error('JUNSHI_REGRESSION_ORG_ID and JUNSHI_REGRESSION_USER_ID are required');

const cases = [
  { id: 'visual-speech-only', assetEnv: 'JUNSHI_REGRESSION_VISUAL_ASSET_ID', mode: 'speech', expectStage: 'extract_failed', errorPattern: /没有识别到清晰口播/ },
  { id: 'visual-auto', assetEnv: 'JUNSHI_REGRESSION_VISUAL_ASSET_ID', mode: 'auto', expectStage: 'transcript', sources: ['visual'] },
  { id: 'visual-explicit', assetEnv: 'JUNSHI_REGRESSION_VISUAL_ASSET_ID', mode: 'visual', expectStage: 'transcript', sources: ['visual'] },
  { id: 'speech-auto', assetEnv: 'JUNSHI_REGRESSION_SPEECH_ASSET_ID', mode: 'auto', expectStage: 'transcript', sources: ['speech'] },
  { id: 'speech-explicit', assetEnv: 'JUNSHI_REGRESSION_SPEECH_ASSET_ID', mode: 'speech', expectStage: 'transcript', sources: ['speech'] },
  { id: 'speech-both', assetEnv: 'JUNSHI_REGRESSION_SPEECH_ASSET_ID', mode: 'both', expectStage: 'transcript', sources: ['speech', 'mixed'] },
  { id: 'mixed-both', assetEnv: 'JUNSHI_REGRESSION_MIXED_ASSET_ID', mode: 'both', expectStage: 'transcript', sources: ['mixed'], optional: true },
  { id: 'silence-no-text', assetEnv: 'JUNSHI_REGRESSION_NO_TEXT_ASSET_ID', mode: 'auto', expectStage: 'extract_failed', optional: true },
  { id: 'dialect-speech', assetEnv: 'JUNSHI_REGRESSION_DIALECT_ASSET_ID', mode: 'speech', expectStage: 'transcript', sources: ['speech'], optional: true },
  { id: 'long-speech', assetEnv: 'JUNSHI_REGRESSION_LONG_ASSET_ID', mode: 'speech', expectStage: 'transcript', sources: ['speech'], optional: true },
];

const sessionId = `sess_reg_${randomUUID().replaceAll('-', '')}`;
const token = randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(token).digest('hex');
const now = new Date();
const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
const created = [];

function remoteSql(sql) {
  const payload = `set -euo pipefail\nsudo mysql --defaults-file=/root/.my.cnf -D aild_admin --batch --raw --skip-column-names <<'SQL'\n${sql}\nSQL\n`;
  const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'ai-kids-prod', 'bash -s'], { input: payload, encoding: 'utf8', timeout: 30000 });
  if (result.status !== 0) throw new Error(`remote SQL failed: ${String(result.stderr || '').slice(0, 500)}`);
  return String(result.stdout || '');
}

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false || payload?.success === false) {
    throw new Error(`${method} ${path}: HTTP ${response.status} ${JSON.stringify(payload?.error || payload).slice(0, 800)}`);
  }
  return payload?.data ?? payload;
}

async function workflow(id) {
  const data = await api('/workflows?accountId=default');
  return (data.items || []).find((item) => item.id === id) || null;
}

async function pollWorkflow(id, timeoutMs = 240000) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await workflow(id);
    if (latest && ['transcript', 'extract_failed', 'plan_failed', 'failed'].includes(latest.stage)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`workflow timeout: ${JSON.stringify(latest)?.slice(0, 800)}`);
}

let sessionCreated = false;
try {
  remoteSql(`INSERT INTO sessions (id,token_hash,user_id,role,org_id,client_type,created_at,expires_at,superseded_at) VALUES ('${sessionId}','${tokenHash}','${USER_ID}','ORG_ADMIN','${ORG_ID}','web','${now.toISOString()}','${expiresAt}',NULL);`);
  sessionCreated = true;
  const results = [];
  const requested = new Set(String(process.env.JUNSHI_REGRESSION_CASES || '').split(',').map((item) => item.trim()).filter(Boolean));
  for (const item of cases.filter((entry) => !requested.size || requested.has(entry.id))) {
    const assetId = String(process.env[item.assetEnv] || '').trim();
    if (!assetId) {
      if (item.optional) {
        results.push({ id: item.id, status: 'skipped', reason: `${item.assetEnv} not set` });
        continue;
      }
      throw new Error(`${item.id}: required ${item.assetEnv} is not set`);
    }
    const data = await api('/workflows', { method: 'POST', body: { kind: 'viral', accountId: 'default', input: { sourceType: 'upload', assetId, transcriptMode: item.mode } } });
    const workflowId = data?.workflow?.id || '';
    assert.ok(workflowId, `${item.id}: workflow id missing`);
    created.push({ workflowId, transcriptId: '' });
    const latest = await pollWorkflow(workflowId);
    const record = created.find((entry) => entry.workflowId === workflowId);
    record.transcriptId = latest.state?.transcriptId || '';
    assert.equal(latest.stage, item.expectStage, `${item.id}: expected ${item.expectStage}, got ${latest.stage}; ${JSON.stringify(latest).slice(0, 1200)}`);
    if (item.errorPattern) assert.match(String(latest.state?.extractError || latest.error || ''), item.errorPattern, `${item.id}: wrong error; ${JSON.stringify(latest).slice(0, 1200)}`);
    if (item.sources) {
      const source = latest.state?.transcriptSource || 'speech';
      assert.ok(item.sources.includes(source), `${item.id}: expected source ${item.sources.join('|')}, got ${source}`);
      assert.ok(String(latest.state?.transcript || '').trim(), `${item.id}: transcript empty`);
    }
    results.push({ id: item.id, status: 'passed', stage: latest.stage, source: latest.state?.transcriptSource || '', chars: String(latest.state?.transcript || '').length });
  }
  console.log(JSON.stringify({ ok: true, cases: results }, null, 2));
} finally {
  const cleanup = [];
  for (const entry of created) {
    if (entry.workflowId) {
      cleanup.push(`DELETE FROM junshi_workbench_jobs WHERE owner_key='org:${ORG_ID}' AND entity_id='${entry.workflowId}';`);
      cleanup.push(`DELETE FROM junshi_workbench_workflows WHERE id='${entry.workflowId}' AND owner_key='org:${ORG_ID}';`);
    }
    if (entry.transcriptId) {
      cleanup.push(`DELETE FROM junshi_workbench_jobs WHERE owner_key='org:${ORG_ID}' AND entity_id='${entry.transcriptId}';`);
      cleanup.push(`DELETE FROM junshi_workbench_transcripts WHERE id='${entry.transcriptId}' AND owner_key='org:${ORG_ID}';`);
    }
  }
  if (sessionCreated) cleanup.push(`DELETE FROM sessions WHERE id='${sessionId}';`);
  if (cleanup.length) {
    try { remoteSql(['START TRANSACTION;', ...cleanup, 'COMMIT;'].join('\n')); } catch (error) { console.error('cleanup failed:', String(error?.message || error)); }
  }
}
