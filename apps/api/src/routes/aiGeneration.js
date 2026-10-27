import { AI_PROVIDER, AI_PROVIDER_MODEL } from '../config.js';

export function providerSelectionForModality(policy, modality, modelOverride = '') {
  const key = String(modality || 'TEXT').toUpperCase();
  const configured = policy?.modalityChannels?.[key] || policy?.modalityChannels?.[modality] || null;
  const channel = Array.isArray(configured) ? configured.find((item) => item?.enabled !== false) : configured;
  return {
    provider: channel?.provider || AI_PROVIDER || 'local-mock',
    model: String(modelOverride || channel?.model || AI_PROVIDER_MODEL || 'junshi-mock-text-v1'),
    endpoint: channel?.endpoint || '',
    channelId: channel?.id || 'mock',
    apiKey: '',
  };
}

export async function generationOptionsFor({ modality, studentOptions = {}, firstFrameUrl = '', referenceAssets = [], ...rest } = {}) {
  return {
    ...rest,
    modality,
    ...studentOptions,
    firstFrameUrl,
    referenceAssets,
  };
}