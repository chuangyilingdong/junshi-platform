import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { arows, resetMockDb, seedMockDb } from '../src/lib.js';
import { getComputePricing, priceFenFor } from '../src/services/computePricing.js';
import { getGenerationProvider } from '../src/services/generationProvider.js';

beforeEach(async () => {
  await resetMockDb();
  await seedMockDb('platform_settings', [{
    id: 1,
    compute_pricing: JSON.stringify({ perCall: { TEXT: 7, IMAGE: 70, VIDEO: 700, MUSIC: 200 }, models: { 'deepseek-flash': 42 }, updatedAt: '2026-10-27T00:00:00.000Z' }),
  }]);
});

test('compute pricing honors model override and modality defaults', async () => {
  const pricing = await getComputePricing();
  assert.equal(pricing.perCall.TEXT, 7);
  assert.equal(pricing.models['deepseek-flash'], 42);
  assert.equal(await priceFenFor({ modality: 'TEXT', model: 'deepseek-flash' }), 42);
  assert.equal(await priceFenFor({ modality: 'VIDEO', model: 'unknown' }), 700);
});

test('provider calls write an observation-only compute attempt', async () => {
  const provider = getGenerationProvider({ provider: 'local-mock', model: 'deepseek-flash', channelId: 'mock', apiKey: 'test' });
  let text = '';
  await provider.generateStream({
    messages: [{ role: 'user', content: 'ping' }],
    onDelta: (chunk) => { text += chunk; },
  });
  assert.ok(text.length > 0);
  const rows = await arows('SELECT * FROM compute_attempts');
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].sale_price_fen), 42);
  assert.equal(rows[0].provider, 'local-mock');
  assert.equal(rows[0].status, 'RUNNING');
  const sale = JSON.parse(rows[0].sale_snapshot);
  assert.equal(sale.charged, false);
  assert.equal(sale.baseline, 'OBSERVATION_ONLY');
});