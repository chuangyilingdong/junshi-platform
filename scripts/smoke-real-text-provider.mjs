if (String(process.env.JUNSHI_ALLOW_REAL_PROVIDER_SMOKE || '') !== '1') {
  throw new Error('Set JUNSHI_ALLOW_REAL_PROVIDER_SMOKE=1 to run this paid smoke test');
}

const { getAiProviderPolicy } = await import('../apps/api/src/routes/billingConfig.js');
const { providerSelectionForModality } = await import('../apps/api/src/routes/aiGeneration.js');
const { getGenerationProvider, generationProviderInfo } = await import('../apps/api/src/services/generationProvider.js');

const startedAt = Date.now();
const policy = await getAiProviderPolicy();
const selection = providerSelectionForModality(policy, 'TEXT');
const info = generationProviderInfo(selection);
if (!info.adapterAvailable || !info.configured) {
  throw new Error(`Provider is not ready: ${JSON.stringify(info)}`);
}
const provider = getGenerationProvider(selection);
let text = '';
const result = await provider.generateStream({
  messages: [
    { role: 'system', content: '只回复 OK，不要解释。' },
    { role: 'user', content: 'ping' },
  ],
  options: { maxTokens: 16 },
  onDelta: (chunk) => { text += chunk; },
});
console.log(JSON.stringify({
  ok: Boolean((text || result?.content || '').trim()),
  provider: info.provider,
  model: info.model,
  elapsedMs: Date.now() - startedAt,
  text: String(text || result?.content || '').trim().slice(0, 80),
  usage: result?.usage || null,
}));