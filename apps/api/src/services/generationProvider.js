import {
  AI_PROVIDER,
  AI_PROVIDER_API_KEY,
  AI_PROVIDER_ENDPOINT,
  AI_PROVIDER_MAX_WAIT_MS,
  AI_PROVIDER_MODALITY_ENDPOINTS,
  AI_PROVIDER_MODEL,
  AI_PROVIDER_POLL_INTERVAL_MS,
  AI_PROVIDER_TIMEOUT_MS,
  AI_PROVIDER_VOICE,
} from '../config.js';
import { isMockProvider, providerDefinition, unavailableProvider, validateProviderConfig } from './providerContract.js';
import { openAiCompatibleProvider } from './openaiCompatibleProvider.js';
import { getProviderApiKey } from './providerSecret.js';

const localMockProvider = Object.freeze({
  name: 'local-mock',
  model: AI_PROVIDER_MODEL || 'junshi-mock-text-v1',
  capabilities: ['TEXT', 'IMAGE', 'MUSIC', 'VIDEO'],
  async generateStream({ messages = [], onDelta, onReasoning, signal } = {}) {
    if (signal?.aborted) throw Object.assign(new Error('请求已取消'), { code: 'GENERATION_PROVIDER_ABORTED' });
    onReasoning?.();
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    const prompt = typeof lastUser?.content === 'string' ? lastUser.content : '（未提供问题）';
    const text = `这是独立 Junshi API 的本地 Mock 响应。已收到：${prompt.slice(0, 120)}\n\n当前链路已完成 mock 鉴权、路由分发和静态资料加载；接入共享 Provider 后会替换本段内容。`;
    for (let index = 0; index < text.length; index += 20) {
      if (signal?.aborted) throw Object.assign(new Error('请求已取消'), { code: 'GENERATION_PROVIDER_ABORTED' });
      await onDelta?.(text.slice(index, index + 20));
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    return { content: text, usage: { inputTokens: prompt.length, outputTokens: text.length } };
  },
  async generate({ modality } = {}) {
    throw Object.assign(new Error(`本地 Mock 暂不生成 ${modality || '媒体'} 产物`), { code: 'MOCK_GENERATION_UNSUPPORTED' });
  },
});

export function providerSelection({
  provider,
  model,
  endpoint,
  channelId,
  providerAccountRef,
  requestTemplates,
  modelRequestTemplates,
  requestPaths,
  pollPaths,
  protocol,
  modelCapabilities,
  apiKey,
} = {}) {
  return {
    provider: String(provider || AI_PROVIDER || 'local-mock').trim(),
    model: String(model || AI_PROVIDER_MODEL || 'junshi-mock-text-v1').trim(),
    endpoint: String(endpoint || AI_PROVIDER_ENDPOINT || '').trim(),
    channelId: String(channelId || 'default').trim(),
    providerAccountRef: String(providerAccountRef || '').trim() || null,
    requestTemplates: requestTemplates && typeof requestTemplates === 'object' ? requestTemplates : {},
    modelRequestTemplates: modelRequestTemplates && typeof modelRequestTemplates === 'object' ? modelRequestTemplates : {},
    requestPaths: requestPaths && typeof requestPaths === 'object' ? requestPaths : {},
    pollPaths: pollPaths && typeof pollPaths === 'object' ? pollPaths : {},
    protocol: String(protocol || 'CHAT').toUpperCase(),
    modelCapabilities: modelCapabilities && typeof modelCapabilities === 'object' ? modelCapabilities : {},
    apiKey: String(apiKey || '').trim(),
  };
}

export function providerConfig(selection = {}) {
  const selected = providerSelection(selection);
  const apiKey = selected.apiKey || getProviderApiKey(selected.channelId) || getProviderApiKey() || AI_PROVIDER_API_KEY;
  return { ...validateProviderConfig({ ...selected, apiKey }), apiKey };
}

export function generationProviderInfo(selection = {}) {
  const config = providerConfig(selection);
  const definition = providerDefinition(config.provider);
  const mock = isMockProvider(config.provider);
  const adapterAvailable = mock || Boolean(definition?.adapterAvailable);
  return {
    provider: config.provider,
    model: config.model,
    mode: mock ? 'mock' : adapterAvailable ? 'external-adapter' : 'adapter-required',
    configured: config.valid,
    adapterAvailable,
    capabilities: adapterAvailable ? ['TEXT', 'IMAGE', 'MUSIC', 'VIDEO'] : [],
    endpointConfigured: Boolean(config.endpoint),
    configError: config.reasons.length ? 'AI_PROVIDER_CONFIG_INVALID' : null,
  };
}

export function getGenerationProvider(selection = {}) {
  const config = providerConfig(selection);
  if (isMockProvider(config.provider)) return localMockProvider;
  const definition = providerDefinition(config.provider);
  if (!config.valid || !definition?.adapterAvailable) return unavailableProvider({ name: config.provider, model: config.model, config });
  return openAiCompatibleProvider({
    name: config.provider,
    model: config.model,
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    timeoutMs: AI_PROVIDER_TIMEOUT_MS,
    maxWaitMs: AI_PROVIDER_MAX_WAIT_MS,
    modalityEndpoints: AI_PROVIDER_MODALITY_ENDPOINTS,
    voice: AI_PROVIDER_VOICE,
    pollIntervalMs: AI_PROVIDER_POLL_INTERVAL_MS,
    requestTemplates: config.requestTemplates,
    modelRequestTemplates: config.modelRequestTemplates,
    requestPaths: config.requestPaths,
    pollPaths: config.pollPaths,
  });
}