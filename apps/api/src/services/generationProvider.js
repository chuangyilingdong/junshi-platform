import { AI_PROVIDER, AI_PROVIDER_MODEL } from '../config.js';
import { isMockProvider } from './providerContract.js';

const localMockProvider = Object.freeze({
  name: 'local-mock',
  model: AI_PROVIDER_MODEL || 'junshi-mock-text-v1',
  async generateStream({ messages = [], onDelta, onReasoning, signal } = {}) {
    if (signal?.aborted) throw Object.assign(new Error('请求已取消'), { code: 'ABORTED' });
    onReasoning?.();
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    const prompt = typeof lastUser?.content === 'string' ? lastUser.content : '（未提供问题）';
    const text = `这是独立 Junshi API 的本地 Mock 响应。已收到：${prompt.slice(0, 120)}\n\n当前链路已完成 mock 鉴权、路由分发和静态资料加载；接入共享 Provider 后会替换本段内容。`;
    for (let index = 0; index < text.length; index += 20) {
      if (signal?.aborted) throw Object.assign(new Error('请求已取消'), { code: 'ABORTED' });
      onDelta?.(text.slice(index, index + 20));
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    return { content: text, usage: { inputTokens: prompt.length, outputTokens: text.length } };
  },
  async generate({ modality } = {}) {
    throw Object.assign(new Error(`本地 Mock 暂不生成 ${modality || '媒体'} 产物`), { code: 'MOCK_GENERATION_UNSUPPORTED' });
  },
});

export function providerSelection({ provider = AI_PROVIDER, model = AI_PROVIDER_MODEL, endpoint = '', channelId = 'mock', ...rest } = {}) {
  return { provider: provider || 'local-mock', model: model || AI_PROVIDER_MODEL || 'junshi-mock-text-v1', endpoint, channelId, ...rest };
}

export function providerConfig(selection = {}) {
  return {
    provider: selection.provider || AI_PROVIDER || 'local-mock',
    model: selection.model || AI_PROVIDER_MODEL || 'junshi-mock-text-v1',
    endpoint: selection.endpoint || '',
    channelId: selection.channelId || 'mock',
  };
}

export function generationProviderInfo(selection = {}) {
  const config = providerConfig(selection);
  return {
    ...config,
    mode: isMockProvider(config.provider) ? 'mock' : 'live',
    label: isMockProvider(config.provider) ? '本地 Mock' : config.provider,
  };
}

export function getGenerationProvider(selection = {}) {
  const config = providerConfig(selection);
  if (isMockProvider(config.provider)) return localMockProvider;
  throw Object.assign(new Error(`Provider ${config.provider} 尚未接入独立 API`), { code: 'PROVIDER_NOT_CONFIGURED' });
}