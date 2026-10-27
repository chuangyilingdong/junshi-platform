import { getAiProviderPolicy } from '../routes/billingConfig.js';
import { providerSelectionForModality } from '../routes/aiGeneration.js';
import { getGenerationProvider } from './generationProvider.js';
import { isMockProvider } from './providerContract.js';
import { hasProviderApiKey } from './providerSecret.js';
import { storageOverview } from './fileStorage.js';

const REQUIRED_MODALITIES = ['TEXT', 'IMAGE', 'VIDEO', 'MUSIC'];

export async function providerReadiness() {
  const policy = await getAiProviderPolicy();
  const channels = [];
  const blockers = [];
  for (const modality of REQUIRED_MODALITIES) {
    const selection = providerSelectionForModality(policy, modality);
    const channelId = selection.channelId || 'default';
    const hasKey = hasProviderApiKey(channelId);
    const mockActive = isMockProvider(selection.provider);
    let adapterAvailable = false;
    let adapterError = '';
    try {
      getGenerationProvider(selection);
      adapterAvailable = true;
    } catch (error) {
      adapterError = String(error?.code || error?.message || error);
    }
    if (!hasKey) blockers.push(`PROVIDER_KEY_MISSING:${channelId}`);
    if (mockActive) blockers.push(`PROVIDER_MOCK_ACTIVE:${modality}`);
    if (!adapterAvailable) blockers.push(`PROVIDER_ADAPTER_MISSING:${selection.provider}:${modality}`);
    channels.push({
      modality,
      channelId,
      provider: selection.provider,
      model: selection.model,
      endpointConfigured: Boolean(selection.endpoint),
      apiKeyConfigured: hasKey,
      mockActive,
      adapterAvailable,
      adapterError,
    });
  }
  return {
    ready: blockers.length === 0,
    policySource: policy.mode || 'unknown',
    policyUpdatedAt: policy.updatedAt || null,
    channels,
    blockers,
  };
}

export function storageReadiness() {
  const info = storageOverview();
  const blockers = [];
  if (info.backend !== 'oss') blockers.push('SHARED_STORAGE_NOT_OSS');
  if (!info.configured) blockers.push('OSS_CONFIG_INCOMPLETE');
  return { ready: blockers.length === 0, backend: info.backend, configured: info.configured, blockers };
}

export async function cutoverReadiness() {
  const provider = await providerReadiness();
  const storage = storageReadiness();
  const blockers = [...provider.blockers, ...storage.blockers, 'BILLING_ADAPTER_NOT_IMPLEMENTED'];
  return { ready: blockers.length === 0, provider, storage, blockers };
}