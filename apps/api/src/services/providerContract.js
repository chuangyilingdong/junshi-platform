export const GENERATION_PROVIDER_CATALOG = Object.freeze([
  { id: 'local-mock', name: 'local-mock', label: '本地 Mock', capabilities: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO'] },
]);

export const GENERATION_PROVIDER_IDS = new Set(GENERATION_PROVIDER_CATALOG.map((item) => item.id));

export function providerDefinition(providerId) {
  return GENERATION_PROVIDER_CATALOG.find((item) => item.id === providerId) || null;
}

export function isMockProvider(name) {
  return !name || /(?:^|[-_])(?:mock|local|demo|fake)(?:$|[-_])/i.test(String(name));
}

export function normalizeProviderError(error, { status } = {}) {
  const raw = String(error?.message || error || '生成服务暂不可用');
  return {
    code: String(error?.code || 'PROVIDER_ERROR'),
    message: raw.slice(0, 500),
    status: Number(status || error?.status || 502),
  };
}

export function unavailableProvider({ name, model, config } = {}) {
  return {
    name: name || 'local-mock',
    model: model || config?.model || 'junshi-mock-text-v1',
    available: false,
  };
}