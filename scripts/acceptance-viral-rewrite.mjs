import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

if (process.env.JUNSHI_ALLOW_REAL_PROVIDER !== '1') {
  throw new Error('Set JUNSHI_ALLOW_REAL_PROVIDER=1 to run this paid provider acceptance test');
}

const SITE = 'https://aicyld.com';
const API = `${SITE}/api/junshi/workbench`;
const TEST_ORG_ID = 'org_2df1a02d1c7741a69f2b';
const TEST_USER_ID = 'user_562b277b60a64cd8abc2';
const sessionId = `sess_viral_${randomUUID().replaceAll('-', '')}`;
const token = randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(token).digest('hex');
const now = new Date();
const expiresAt = new Date(now.getTime() + 20 * 60 * 1000).toISOString();
const sourceText = '这个健身比赛表面只收报名费，但真正赚钱的是后面的拍摄、周边、赞助和报名流量；报名只是入口，真正的商业结构是一层一层拆出来的。';
let workflowId = '';

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
    throw new Error(`${method} ${path} failed: HTTP ${response.status} ${JSON.stringify(payload?.error || payload).slice(0, 600)}`);
  }
  return payload?.data ?? payload;
}

async function pollWorkflow(targetId, terminalStages, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    const data = await api('/workflows?accountId=default');
    latest = (data.items || []).find((item) => item.id === targetId) || latest;
    if (latest && terminalStages.includes(latest.stage)) return latest;
    if (latest?.status === 'failed' || latest?.stage === 'failed' || latest?.stage === 'plan_failed') return latest;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`workflow timeout: ${JSON.stringify(latest)?.slice(0, 800)}`);
}

let sessionCreated = false;
let profileTouched = false;
let originalProfile = null;
try {
  const profileRow = remoteSql(`SELECT TO_BASE64(content),created_at,updated_at FROM junshi_workbench_account_profiles WHERE owner_key='org:${TEST_ORG_ID}' AND account_id='default';`).trim();
  if (profileRow) {
    const [contentBase64, createdAt, updatedAt] = profileRow.split('\t');
    if (!contentBase64 || !createdAt || !updatedAt) throw new Error('existing profile snapshot is incomplete');
    originalProfile = { contentBase64, createdAt, updatedAt };
  }

  remoteSql(`INSERT INTO sessions (id,token_hash,user_id,role,org_id,client_type,created_at,expires_at,superseded_at) VALUES ('${sessionId}','${tokenHash}','${TEST_USER_ID}','ORG_ADMIN','${TEST_ORG_ID}','web','${now.toISOString()}','${expiresAt}',NULL);`);
  sessionCreated = true;
  await api('/profile', {
    method: 'PUT',
    body: { accountId: 'default', profile: { name: '少儿美术招生测试号', platform: '抖音', product: '少儿美术体验课与长期课程', audience: '3-8岁孩子家长', goal: '让家长理解课程价值后再预约体验', tone: '口语化、直接、具体', boundaries: '不承诺提分，不制造焦虑', positioning: '讲清楚少儿美术课程怎么选、钱花在哪里' } },
  });
  profileTouched = true;

  const created = await api('/workflows', { method: 'POST', body: { kind: 'viral', accountId: 'default', input: { sourceType: 'text', sourceText } } });
  workflowId = created?.workflow?.id || '';
  assert.ok(workflowId, 'workflow id missing');
  await api(`/workflows/${encodeURIComponent(workflowId)}/action`, { method: 'POST', body: { action: 'confirm_transcript', text: sourceText, rewritePlan: true } });
  const planned = await pollWorkflow(workflowId, ['rewrite_plan', 'plan_failed']);
  assert.equal(planned.stage, 'rewrite_plan', `plan generation failed: ${planned.error || planned.state?.message || ''}`);
  const planOptions = planned.state?.planOptions || [];
  assert.equal(planOptions.length, 3, `expected 3 plans, got ${planOptions.length}`);
  assert.ok(planOptions.every((plan) => plan.sourceMechanism && plan.targetBridge && plan.thesis), 'plan fields incomplete');
  assert.ok(planOptions.some((plan) => /课程|家长|体验课|孩子|学习/.test(`${plan.targetBridge}${plan.thesis}`)), 'plans never bridge to the education account');

  const selected = planOptions[0];
  await api(`/workflows/${encodeURIComponent(workflowId)}/action`, { method: 'POST', body: { action: 'select_rewrite_plan', planId: selected.id } });
  const ready = await pollWorkflow(workflowId, ['ready', 'failed']);
  assert.equal(ready.stage, 'ready', `copy generation failed: ${ready.error || ready.state?.message || ''}`);
  const copies = ready.state?.copyOptions || [];
  assert.equal(copies.length, 3, `expected 3 copies, got ${copies.length}`);
  assert.ok(copies.every((copy) => String(copy.content || '').length >= 100), 'copy content too short');
  assert.ok(copies.some((copy) => /体验课|课程|家长|续班|教材|学习/.test(copy.content || '')), 'copies never use the selected education mapping');

  console.log(JSON.stringify({
    ok: true,
    sourceAnalysis: ready.state?.sourceAnalysis || planned.state?.sourceAnalysis,
    plans: planOptions.map((plan) => ({ id: plan.id, title: plan.title, sourceMechanism: plan.sourceMechanism, targetBridge: plan.targetBridge, thesis: plan.thesis })),
    selectedPlan: selected.title,
    copies: copies.map((copy) => ({ title: copy.title, preview: String(copy.content || '').slice(0, 260) })),
  }, null, 2));
} finally {
  workflowId = workflowId || '';
  const cleanupSql = [];
  if (workflowId) {
    cleanupSql.push(`DELETE FROM junshi_workbench_jobs WHERE entity_type='workflow' AND entity_id='${workflowId}' AND owner_key='org:${TEST_ORG_ID}';`);
    cleanupSql.push(`DELETE FROM junshi_workbench_workflows WHERE id='${workflowId}' AND owner_key='org:${TEST_ORG_ID}';`);
  }
  if (profileTouched) {
    if (originalProfile) {
      cleanupSql.push(`REPLACE INTO junshi_workbench_account_profiles (owner_key,account_id,org_id,content,created_at,updated_at) VALUES ('org:${TEST_ORG_ID}','default','${TEST_ORG_ID}',FROM_BASE64('${originalProfile.contentBase64}'),'${originalProfile.createdAt}','${originalProfile.updatedAt}');`);
    } else {
      cleanupSql.push(`DELETE FROM junshi_workbench_account_profiles WHERE owner_key='org:${TEST_ORG_ID}' AND account_id='default';`);
    }
  }
  cleanupSql.push(`DELETE FROM compute_attempts WHERE org_id='${TEST_ORG_ID}' AND user_id='${TEST_USER_ID}' AND created_at >= '${now.toISOString()}';`);
  if (sessionCreated) cleanupSql.push(`DELETE FROM sessions WHERE id='${sessionId}';`);
  try { remoteSql(['START TRANSACTION;', ...cleanupSql, 'COMMIT;'].join('\n')); } catch (error) { console.error('cleanup failed:', String(error?.message || error)); }
}