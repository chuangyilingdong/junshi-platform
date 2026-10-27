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
import { priceFenFor } from './computePricing.js';
import { aq, id, nowIso } from '../lib.js';

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

function rawGenerationProvider(config) {
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

export function getGenerationProvider(selection = {}) {
  const config = providerConfig(selection);
  const provider = rawGenerationProvider(config);
  const wrapped = { ...provider, compute: null };

  async function execute(method, args = {}) {
    const modality = String(args.modality || 'TEXT').toUpperCase();
    const computeContext = args.computeContext || selection.computeContext || {};
    const salePriceFen = await priceFenFor({ modality, model: config.model });
    const capturedAt = nowIso();
    const callId = id('call');
    const attemptId = id('attempt');
    const clientRequestId = id('req');
    const saleSnapshot = { model: config.model, modality, unitFen: salePriceFen, charged: false, baseline: 'OBSERVATION_ONLY', capturedAt };
    const costRuleSnapshot = { basis: 'UPSTREAM_REPORTED_OR_UNKNOWN', provider: config.provider, channelId: selection.channelId || 'default', model: config.model, estimatedCostFen: null, capturedAt };
    wrapped.compute = { callId, saleSnapshot };
    await aq(`INSERT INTO compute_attempts(
      id,call_id,attempt,org_id,user_id,project_id,generation_job_id,modality,channel_id,provider,model,routed_via,status,
      client_request_id,actual_channel_id,provider_account_ref,sale_price_fen,cost_rule_snapshot,sale_snapshot,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      attemptId, callId, 1, computeContext.orgId || null, computeContext.userId || args.userId || null,
      args.projectId || null, computeContext.jobId || null, modality, selection.channelId || 'default',
      config.provider, config.model, 'direct', 'RUNNING', clientRequestId, selection.channelId || 'default',
      selection.providerAccountRef || null, salePriceFen, JSON.stringify(costRuleSnapshot), JSON.stringify(saleSnapshot), capturedAt,
    ]);

    let outputStarted = false;
    const markOutput = async () => {
      if (outputStarted) return;
      outputStarted = true;
      await aq('UPDATE compute_attempts SET output_started=1 WHERE id=?', [attemptId]).catch(() => {});
    };
    try {
      const result = await provider[method]({
        ...args,
        clientRequestId,
        onDelta: async (...values) => { await markOutput(); return args.onDelta?.(...values); },
        onReasoning: async (...values) => { await markOutput(); return args.onReasoning?.(...values); },
        onSubmitted: async (taskId) => {
          await aq("UPDATE compute_attempts SET status='SUBMITTED',task_id=? WHERE id=?", [String(taskId || ''), attemptId]).catch(() => {});
          return args.onSubmitted?.(taskId);
        },
        onEvidence: async (evidence = {}) => {
          await aq(`UPDATE compute_attempts SET
            response_request_id=COALESCE(?,response_request_id),
            response_payload_id=COALESCE(?,response_payload_id),
            usage_id=COALESCE(?,usage_id),
            gateway_log_id=COALESCE(?,gateway_log_id),
            actual_channel_id=COALESCE(?,actual_channel_id)
            WHERE id=?`, [evidence.responseRequestId || null, evidence.responsePayloadId || null, evidence.usageId || null, evidence.gatewayLogId || null, evidence.actualChannelId || null, attemptId]).catch(() => {});
          return args.onEvidence?.(evidence);
        },
      });
      const reportedCost = result?.assets?.find((asset) => asset?.metadata?.reportedCost)?.metadata?.reportedCost || null;
      await aq(`UPDATE compute_attempts SET status='SUCCESS', cost_source=?, upstream_cost_fen=?, completed_at=? WHERE id=?`, [
        reportedCost ? 'REPORTED' : 'UNKNOWN', reportedCost?.costFen ?? null, nowIso(), attemptId,
      ]).catch(() => {});
      return result;
    } catch (error) {
      await aq(`UPDATE compute_attempts SET status='FAILED', error_code=?, error_message=?, completed_at=? WHERE id=?`, [
        String(error?.code || 'PROVIDER_ERROR').slice(0, 120), String(error?.message || error).slice(0, 1000), nowIso(), attemptId,
      ]).catch(() => {});
      throw error;
    }
  }

  wrapped.generate = (args) => execute('generate', args);
  if (provider.generateStream) wrapped.generateStream = (args) => execute('generateStream', args);
  return wrapped;
}