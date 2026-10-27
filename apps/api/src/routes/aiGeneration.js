import { AI_PROVIDER, AI_PROVIDER_MODEL } from '../config.js';

export function providerSelectionForModality(policy, modality, modelOverride = '') {
  const key = String(modality || '').toUpperCase();
  const defaultChannelId = policy?.modalityChannels?.[key];
  const defaultChannel = Array.isArray(policy?.channels)
    ? policy.channels.find((item) => item.id === defaultChannelId)
    : null;
  const requestedModel = modelOverride || defaultChannel?.model || policy?.model;
  const mapping = Array.isArray(policy?.modelRoutes)
    ? policy.modelRoutes.find((item) => String(item.modality || '').toUpperCase() === key && item.model === requestedModel)
    : null;
  const channelId = mapping?.channelId || defaultChannelId;
  const channel = Array.isArray(policy?.channels) ? policy.channels.find((item) => item.id === channelId) : null;
  if (!channel) {
    return {
      provider: policy?.provider || AI_PROVIDER || 'local-mock',
      model: modelOverride || policy?.model || AI_PROVIDER_MODEL || 'junshi-mock-text-v1',
      endpoint: policy?.endpoint || '',
      channelId: 'default',
      requestTemplates: {},
      modelRequestTemplates: {},
      requestPaths: {},
      pollPaths: {},
      providerAccountRef: null,
    };
  }
  return {
    provider: channel.provider,
    model: modelOverride || mapping?.model || channel.model,
    endpoint: channel.endpoint,
    channelId: channel.id,
    providerAccountRef: channel.providerAccountRef || null,
    protocol: channel.protocol,
    requestTemplates: channel.requestTemplates || {},
    modelRequestTemplates: channel.modelRequestTemplates || {},
    requestPaths: channel.requestPaths || {},
    pollPaths: channel.pollPaths || {},
    modelCapabilities: channel.modelCapabilities || {},
  };
}

export async function generationOptionsFor({ modality, studentOptions = {}, firstFrameUrl = '', lastFrameUrl = '', referenceAssets = [], ...rest } = {}) {
  return {
    ...rest,
    modality,
    ...studentOptions,
    firstFrameUrl,
    lastFrameUrl,
    referenceAssets,
  };
}