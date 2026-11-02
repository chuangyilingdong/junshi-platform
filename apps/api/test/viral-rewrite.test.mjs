import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { buildViralOnePrompt, buildViralPlanPrompt, demoViralPlans } from '../src/services/junshiWorkbenchContent.js';

const profile = {
  name: '少儿美术招生号', platform: '抖音', product: '少儿美术体验课', audience: '3-8岁家长',
  city: '广州', sellingPoints: '小班教学、真实课堂、阶段作品', tone: '口语化', taboo: '不承诺提分',
};
const sourceText = '一个健身比赛表面只收报名费，背后还有拍摄、周边、赞助和多层商业收入。';

test('viral plan prompt requires source mechanism to account business mapping', () => {
  const prompt = buildViralPlanPrompt({ profile, orgProfile: '广州少儿美术机构', sourceText, strength: 'medium' });
  assert.match(prompt, /先拆解下面这条爆款/);
  assert.match(prompt, /原爆款机制 → 本账号业务的对应关系/);
  assert.match(prompt, /不得改写成与本账号无关的行业通用文/);
  assert.match(prompt, /targetBridge/);
  assert.match(prompt, /sourceAnalysis/);
  assert.match(prompt, /plans 必须正好 3 个/);
  assert.ok(prompt.includes(sourceText));
});

test('viral version prompt must execute the selected plan instead of generic copy', () => {
  const plan = {
    id: 'p1', title: '保留商业拆解链', sourceMechanism: '先承认表面答案，再拆出隐藏收入层。',
    targetBridge: '把赛事多层收入映射到体验课、正价课、教材和活动。',
    thesis: '低价体验课只是入口，真正的结构在后面的长期学习。',
    beats: ['先说体验课不赚钱', '拆出续班与教材收入', '解释家长真正该看什么'],
  };
  const prompt = buildViralOnePrompt({ profile, orgProfile: '广州少儿美术机构', sourceText, strength: 'medium', plan, index: 1 });
  assert.match(prompt, /严格按照已经选定的改写方案/);
  assert.match(prompt, /targetBridge/);
  assert.match(prompt, /保留商业拆解链/);
  assert.match(prompt, /先说体验课不赚钱/);
  assert.match(prompt, /不能绕过 targetBridge 直接写账号行业常识/);
  assert.match(prompt, /必须体现方案 thesis/);
});

test('demo rewrite plans provide three distinct transfer strategies', () => {
  const demo = demoViralPlans(profile, sourceText, 'medium');
  assert.equal(demo.plans.length, 3);
  assert.equal(new Set(demo.plans.map((plan) => plan.title)).size, 3);
  assert.ok(demo.plans.every((plan) => plan.sourceMechanism && plan.targetBridge && plan.beats.length >= 3));
  assert.ok(demo.plans.some((plan) => plan.targetBridge.includes('少儿美术体验课')));
});
test('viral workflow keeps a legacy direct-rewrite path for 0.6.2 clients', () => {
  const route = fs.readFileSync(new URL('../src/routes/junshiWorkbench.js', import.meta.url), 'utf8');
  assert.match(route, /ctx\.body\?\.rewritePlan === true/);
  assert.match(route, /startWfPlans\(ctx, owner, wfId, job\)/);
  assert.match(route, /startWfCopy\(ctx, owner, wfId\)/);
  assert.match(route, /action === 'select_rewrite_plan'/);
  assert.match(route, /action === 'reselect_rewrite_plan'/);
});

test('rewrite plan normalization rejects incomplete or duplicate plan sets', () => {
  const route = fs.readFileSync(new URL('../src/routes/junshiWorkbench.js', import.meta.url), 'utf8');
  assert.match(route, /plans\.length !== 3/);
  assert.match(route, /需要 3 套包含机制、业务桥梁、核心判断和至少 3 个节拍的方案/);
  assert.match(route, /new Set\(plans\.map/);
  assert.match(route, /三套方案必须使用不同的迁移思路/);
  assert.match(route, /id: `p\$\{index \+ 1\}`/);
});
