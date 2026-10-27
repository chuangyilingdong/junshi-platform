import { AI_PROVIDER, AI_PROVIDER_MODEL } from '../config.js';

export function normalizeAiProviderPolicy(raw) {
  if (raw && typeof raw === 'object') return raw;
  return getMockPolicy();
}

function getMockPolicy() {
  return {
    version: 1,
    mode: 'mock',
    channels: [],
    modalityChannels: {
      TEXT: { provider: AI_PROVIDER || 'local-mock', model: AI_PROVIDER_MODEL || 'junshi-mock-text-v1', enabled: true },
      IMAGE: { provider: 'local-mock', model: 'junshi-mock-image-v1', enabled: true },
      VIDEO: { provider: 'local-mock', model: 'junshi-mock-video-v1', enabled: true },
      AUDIO: { provider: 'local-mock', model: 'junshi-mock-audio-v1', enabled: true },
    },
  };
}

export async function getAiProviderPolicy() {
  return getMockPolicy();
}

export async function getModalitySettings() {
  return [];
}

export async function getModalitySetting() {
  return null;
}

export async function getAlerts() {
  return [];
}

export async function getOrgOverrides() {
  return [];
}

export async function isModalityEnabled() {
  return true;
}