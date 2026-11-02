import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(new URL('../apps/desktop/package.json', import.meta.url));
const { chromium } = require('playwright-core');
if (process.env.JUNSHI_ALLOW_PRODUCTION_SESSION !== '1') {
  throw new Error('Set JUNSHI_ALLOW_PRODUCTION_SESSION=1 to run this production acceptance test');
}
const SITE = 'https://aicyld.com';
const OLD_UI = `${SITE}/junshi/index.html`;
const CHROME = process.env.JUNSHI_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEST_ORG_ID = 'org_2df1a02d1c7741a69f2b';
const TEST_USER_ID = 'user_562b277b60a64cd8abc2';
const TEST_LOGIN = 'org-admin';
const TEST_ORG_NAME = '示例创新学校';
const TEST_USER_NAME = '机构测试账号';
const sessionId = `sess_oldui_${randomUUID().replaceAll('-', '')}`;
const token = randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(token).digest('hex');
const now = new Date();
const expiresAt = new Date(now.getTime() + 20 * 60 * 1000).toISOString();

function remoteSql(sql) {
  const payload = `set -euo pipefail\nsudo mysql --defaults-file=/root/.my.cnf -D aild_admin <<'SQL'\n${sql}\nSQL\n`;
  const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'ai-kids-prod', 'bash -s'], {
    input: payload, encoding: 'utf8', timeout: 30000,
  });
  if (result.status !== 0) throw new Error(`remote SQL failed: ${String(result.stderr || '').slice(0, 500)}`);
  return String(result.stdout || '');
}

let browser = null;
const apiFailures = [];
const pageErrors = [];
const consoleErrors = [];
try {
  assert.ok(fs.existsSync(CHROME), `Chrome not found: ${CHROME}`);
  remoteSql(`INSERT INTO sessions (id,token_hash,user_id,role,org_id,client_type,created_at,expires_at,superseded_at) VALUES ('${sessionId}','${tokenHash}','${TEST_USER_ID}','ORG_ADMIN','${TEST_ORG_ID}','web','${now.toISOString()}','${expiresAt}',NULL);`);

  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, locale: 'zh-CN' });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error).slice(0, 300)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300)); });
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/') && response.status() >= 400) {
      let pathname = url;
      try { pathname = new URL(url).pathname; } catch {}
      apiFailures.push({ status: response.status(), path: pathname });
    }
  });
  await page.addInitScript((session) => {
    localStorage.setItem('ai-kids-platform.session.v1.org', JSON.stringify(session));
  }, {
    token, expiresAt,
    user: { id: TEST_USER_ID, orgId: TEST_ORG_ID, login: TEST_LOGIN, displayName: TEST_USER_NAME, role: 'ORG_ADMIN', permissions: [] },
    organization: { id: TEST_ORG_ID, name: TEST_ORG_NAME, status: 'ACTIVE' },
  });

  const openScreen = async (screen) => {
    await page.goto(OLD_UI, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector(`[data-screen="${screen}"]`, { timeout: 20000 });
    await page.locator(`[data-screen="${screen}"]`).click();
    await page.waitForTimeout(screen === 'workbench' ? 1800 : 500);
  };

  // 专家团
  await openScreen('chat');
  const expertButtons = page.locator('.expert');
  const expertCount = await expertButtons.count();
  assert.equal(expertCount, 6, `unexpected expert count: ${expertCount}`);
  const expertExpectations = [
    ['marketing', '营销军师'], ['script', '话术教练'], ['copy', '文案写手'],
    ['convert', '转化教练'], ['renew', '续费管家'], ['compliance', '合规顾问'],
  ];
  const selectedExperts = [];
  for (const [id, label] of expertExpectations) {
    await page.locator(`.expert[data-id="${id}"]`).click();
    await page.waitForTimeout(160);
    const selected = await page.evaluate((expertLabel) => String(document.body?.innerText || '').includes(`我是${expertLabel}。`), label);
    selectedExperts.push(selected ? id : '');
  }
  assert.deepEqual(selectedExperts, expertExpectations.map(([id]) => id));

  const themeBefore = await page.evaluate(() => `${document.documentElement.className}|${document.body.className}|${document.documentElement.dataset.theme || ''}`);
  await page.locator('#js-theme').click();
  await page.waitForTimeout(200);
  const themeAfter = await page.evaluate(() => `${document.documentElement.className}|${document.body.className}|${document.documentElement.dataset.theme || ''}`);

  assert.equal(await page.locator('.starter').count(), 3);
  await page.locator('#js-input').fill('旧页面回归输入校验，不发送');
  assert.equal(await page.locator('#js-input').inputValue(), '旧页面回归输入校验，不发送');
  await page.locator('#js-input').fill('');
  await page.locator('#conv-reset').click();

  // 内容工作台：9 个页签
  await openScreen('workbench');
  await page.waitForSelector('#wb-input', { timeout: 20000 });
  const tabs = ['chat', 'plan', 'video', 'account', 'references', 'copybrains', 'assets', 'reports', 'jobs'];
  const workbenchTabs = [];
  for (const tab of tabs) {
    const locator = page.locator(`[data-wb="${tab}"]`);
    assert.equal(await locator.count(), 1, `missing workbench tab: ${tab}`);
    await locator.click();
    await page.waitForTimeout(350);
    const state = await page.evaluate((name) => {
      const clicked = document.querySelector(`[data-wb="${name}"]`);
      return {
        clickedClass: String(clicked?.className || ''),
        bodyLength: String(document.body?.innerText || '').length,
        loadingFailed: /工作台加载失败|加载失败/.test(String(document.body?.innerText || '')),
      };
    }, tab);
    assert.ok(state.bodyLength > 200);
    assert.equal(state.loadingFailed, false);
    workbenchTabs.push({ tab, clickedClass: state.clickedClass });
  }
  await page.locator('[data-wb="chat"]').click();
  await page.waitForSelector('#wb-input', { timeout: 10000 });
  await page.locator('[data-tier="deep"]').click();
  assert.ok(String(await page.locator('[data-tier="deep"]').getAttribute('class')).includes('on'));
  await page.locator('[data-tier="fast"]').click();
  await page.locator('#wb-input').fill('旧页面工作台输入校验，不发送');
  assert.equal(await page.locator('#wb-input').inputValue(), '旧页面工作台输入校验，不发送');
  await page.locator('#wb-input').fill('');

  // 合规体检：执行一次最小真实检查
  await openScreen('compliance');
  await page.locator('#cs-text').fill('本课程保证提分，限时最后一天报名。');
  const complianceResponsePromise = page.waitForResponse((response) => {
    try { return new URL(response.url()).pathname === '/api/junshi/compliance' && response.request().method() === 'POST'; } catch { return false; }
  }, { timeout: 30000 });
  await page.locator('#cs-run').click();
  const complianceResponse = await complianceResponsePromise;
  assert.equal(complianceResponse.status(), 200);
  const compliancePayload = await complianceResponse.json().catch(() => ({}));
  assert.equal(compliancePayload.success, true);
  await page.waitForTimeout(500);
  const complianceText = await page.locator('body').innerText();
  assert.ok(complianceText.length > 100);

  // 机构画像：7 个分组均可切换，不保存
  await openScreen('profile');
  const scenes = page.locator('.scene');
  const sceneCount = await scenes.count();
  assert.equal(sceneCount, 7, `unexpected scene count: ${sceneCount}`);
  const sceneStates = [];
  for (let index = 0; index < sceneCount; index += 1) {
    await scenes.nth(index).click();
    await page.waitForTimeout(160);
    const state = await page.evaluate(() => {
      const clicked = document.querySelectorAll('.scene');
      const active = Array.from(clicked).find((element) => /active|on|cur|selected/.test(String(element.className || '')));
      return {
        active: active?.textContent?.replace(/\s+/g, ' ').trim() || '',
        visibleInputs: Array.from(document.querySelectorAll('input,textarea,select')).filter((element) => element.getClientRects().length > 0).length,
      };
    });
    assert.ok(state.visibleInputs > 0);
    sceneStates.push(state.active || 'switched');
  }
  assert.equal(await page.locator('#pf-save').count(), 1);
  await page.locator('[data-screen="chat"]').click();

  assert.deepEqual(apiFailures, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  console.log(JSON.stringify({
    ok: true,
    title: await page.title(),
    experts: selectedExperts,
    themeChanged: themeBefore !== themeAfter,
    workbenchTabs,
    compliance: { status: complianceResponse.status(), success: true },
    profileScenes: sceneStates,
    apiFailures,
    pageErrors,
    consoleErrors,
  }));
} finally {
  if (browser) await browser.close().catch(() => {});
  remoteSql(`DELETE FROM sessions WHERE id='${sessionId}';`);
}