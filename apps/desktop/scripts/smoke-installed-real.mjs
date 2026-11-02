import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright-core';

const sourceProfile = path.resolve(process.env.JUNSHI_PROFILE_SOURCE || path.join(process.env.APPDATA || '', '招生军师'));
const executablePath = path.resolve(process.env.JUNSHI_INSTALLED_EXE || 'E:\\招生客户端\\@junshidesktop\\招生军师.exe');
const tempRoot = path.resolve(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, 'junshi-installed-regression-'));

function assertInsideTemp(target) {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(tempRoot + path.sep) || !path.basename(resolved).startsWith('junshi-installed-regression-')) {
    throw new Error(`unsafe temp path: ${resolved}`);
  }
  return resolved;
}

assert.ok(fs.existsSync(executablePath), `installed executable not found: ${executablePath}`);
assert.ok(fs.existsSync(sourceProfile), `source profile not found: ${sourceProfile}`);
assertInsideTemp(profile);

for (const name of ['account-session.bin', 'desktop-settings.json', 'douyin-assistant.bin', 'Local State', 'Preferences']) {
  const source = path.join(sourceProfile, name);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(profile, name));
}
const apiFailures = [];
const pageErrors = [];
let app = null;
try {
  app = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${profile}`],
    cwd: path.dirname(executablePath),
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
    timeout: 30000,
  });

  let page = null;
  for (let index = 0; index < 40; index += 1) {
    page = app.windows().find((candidate) => candidate.url().includes('app.html')) || null;
    if (page) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!page) {
    const windows = app.windows().map((candidate) => ({ title: candidate.url(), url: candidate.url() }));
    throw new Error(`installed app did not reach app.html; windows=${JSON.stringify(windows)}`);
  }

  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error).slice(0, 300)));
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/junshi/') && response.status() >= 400) {
      let pathname = url;
      try { pathname = new URL(url).pathname; } catch {}
      apiFailures.push({ status: response.status(), path: pathname });
    }
  });

  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.waitForSelector('#view .page, #view .workflow-page', { timeout: 30000 });

  const navLabels = await page.locator('.nav-item').allTextContents();
  assert.deepEqual(navLabels.map((item) => item.trim()), ['首页', '做内容', '同行采集', '我的数据', '设置']);

  const pages = {};
  for (const key of ['home', 'create', 'peers', 'reports', 'settings']) {
    await page.locator(`[data-page="${key}"]`).click();
    await page.waitForTimeout(500);
    const text = String(await page.locator('#view').innerText()).trim();
    assert.ok(text.length > 20, `${key} page rendered no meaningful content`);
    assert.doesNotMatch(text, /工作台加载失败/);
    pages[key] = { textLength: text.length, heading: text.split('\n').slice(0, 3) };
  }

  await page.locator('[data-page="create"]').click();
  await page.waitForSelector('#create-idea', { timeout: 10000 });
  await page.locator('#create-idea').fill('安装版逐页回归：仅校验输入，不提交');
  assert.equal(await page.locator('#create-idea').inputValue(), '安装版逐页回归：仅校验输入，不提交');
  await page.locator('#create-idea').fill('');

  const contexts = [];
  for (const key of ['brains', 'memories', 'assets', 'jobs', 'plans', 'cycles']) {
    const button = page.locator(`[data-action="context-open"][data-context="${key}"]`);
    assert.equal(await button.count(), 1, `missing context button: ${key}`);
    await button.click();
    await page.waitForSelector('.context-panel', { timeout: 10000 });
    const heading = String(await page.locator('.context-panel h2').first().innerText()).trim();
    contexts.push({ key, heading });
    await page.locator('[data-action="context-back"]').click();
    await page.waitForFunction(() => !document.querySelector('.context-panel'), null, { timeout: 10000 });
  }

  await page.locator('[data-page="peers"]').click();
  await page.waitForSelector('#peer-url', { timeout: 10000 });
  const peerCount = await page.locator('.peer-card').count();
  const transcriptCards = await page.locator('.transcript-card, .peer-card').count();
  const openPeer = page.locator('[data-action="open-peer"]').first();
  const canOpenCollector = await openPeer.count() === 1;
  if (canOpenCollector) {
    await openPeer.click();
    await page.waitForTimeout(1500);
  }
  const collectorPage = app.windows().find((candidate) => candidate.url().includes('collector.html')) || null;
  let collectorState = { opened: false };
  if (collectorPage) {
    collectorState = {
      opened: true,
      title: await collectorPage.title(),
      hasWebview: await collectorPage.locator('#douyin-browser').count() === 1,
      hasCollectButton: await collectorPage.locator('#collect-peer').count() === 1,
    };
    await collectorPage.close();
  }

  await page.locator('[data-page="reports"]').click();
  await page.waitForSelector('[data-action="open-self"]', { timeout: 10000 });
  const reportRows = await page.locator('.work-row').count();
  const reportText = await page.locator('#view').innerText();

  await page.locator('[data-page="settings"]').click();
  await page.waitForSelector('[data-action="check-update"]', { timeout: 10000 });
  const settingRows = await page.locator('.settings-row').count();
  const accountText = await page.locator('.account-box').first().innerText();
  const settingsText = await page.locator('#view').innerText();
  const installedVersion = settingsText.match(/\bv(\d+\.\d+\.\d+)\b/)?.[1] || '';

  const result = {
    ok: true,
    installedVersion,
    navLabels: navLabels.map((item) => item.trim()),
    pages,
    contexts,
    createInput: true,
    peers: { peerCount, transcriptCards, canOpenCollector },
    collector: collectorState,
    reports: { rows: reportRows, hasOwnWorksEmptyState: reportText.includes('还没有作品数据') },
    settings: { rows: settingRows, hasAccount: accountText.length > 0 },
    apiFailures,
    pageErrors,
  };
  assert.equal(apiFailures.length, 0, `API failures: ${JSON.stringify(apiFailures)}`);
  assert.equal(pageErrors.length, 0, `page errors: ${JSON.stringify(pageErrors)}`);
  assert.ok(contexts.length === 6, 'not all context pages opened');
  if (canOpenCollector) assert.equal(collectorState.opened, true, 'collector window did not open');

  console.log(JSON.stringify(result));
} finally {
  if (app) await app.close().catch(() => {});
  const safeProfile = assertInsideTemp(profile);
  fs.rmSync(safeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}