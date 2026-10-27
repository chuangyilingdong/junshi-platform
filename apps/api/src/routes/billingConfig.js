import { arow } from '../lib.js';
import { AI_PROVIDER, AI_PROVIDER_MODEL } from '../config.js';

const MODALITIES = ['TEXT', 'IMAGE', 'MUSIC', 'VIDEO', 'CANVAS'];

function parsePolicy(value) {
  if (value && typeof value === 'object') return value;
  try {
    return JSON.parse(String(value || '{}')) || {};
  } catch {
    return {};
  }
}

function normalizeChannel(channel = {}) {
  const id = String(channel.id || '').trim();
  if (!id) return null;
  return {
    ...channel,
    id,
    name: String(channel.name || id).slice(0, 120),
    provider: String(channel.provider || 'custom').toLowerCase(),
    model: String(channel.model || '').slice(0, 200),
    models: Array.isArray(channel.models)
      ? [...new Set(channel.models.map((model) => String(model || '').trim()).filter(Boolean))]
      : (channel.model ? [String(channel.model)] : []),
    endpoint: String(channel.endpoint || '').trim().replace(/\/+$/, ''),
    protocol: ['CHAT', 'RESPONSES', 'ANTHROPIC'].includes(String(channel.protocol || '').toUpperCase())
      ? String(channel.protocol).toUpperCase()
      : 'CHAT',
    requestTemplates: channel.requestTemplates && typeof channel.requestTemplates === 'object' ? channel.requestTemplates : {},
    modelRequestTemplates: channel.modelRequestTemplates && typeof channel.modelRequestTemplates === 'object' ? channel.modelRequestTemplates : {},
    requestPaths: channel.requestPaths && typeof channel.requestPaths === 'object' ? channel.requestPaths : {},
    pollPaths: channel.pollPaths && typeof channel.pollPaths === 'object' ? channel.pollPaths : {},
    modelCapabilities: channel.modelCapabilities && typeof channel.modelCapabilities === 'object' ? channel.modelCapabilities : {},
  };
}

function mockPolicy() {
  return {
    version: 1,
    mode: 'mock',
    provider: AI_PROVIDER || 'local-mock',
    model: AI_PROVIDER_MODEL || 'junshi-mock-text-v1',
    channels: [],
    modalityChannels: Object.fromEntries(MODALITIES.map((modality) => [modality, 'mock'])),
    modalityBackupChannels: {},
    modelRoutes: [],
    updatedAt: null,
  };
}

export function normalizeAiProviderPolicy(raw) {
  const source = parsePolicy(raw?.ai_provider_policy ?? raw);
  if (!source || !Object.keys(source).length) return mockPolicy();
  const channels = (Array.isArray(source.channels) ? source.channels : []).map(normalizeChannel).filter(Boolean);
  return {
    ...source,
    mode: 'database',
    provider: String(source.provider || 'local-mock').toLowerCase(),
    model: String(source.model || ''),
    endpoint: String(source.endpoint || '').trim(),
    channels,
    modalityChannels: source.modalityChannels && typeof source.modalityChannels === 'object' ? source.modalityChannels : {},
    modalityBackupChannels: source.modalityBackupChannels && typeof source.modalityBackupChannels === 'object' ? source.modalityBackupChannels : {},
    modelRoutes: Array.isArray(source.modelRoutes) ? source.modelRoutes : [],
    updatedAt: raw?.updated_at || null,
  };
}

export async function getAiProviderPolicy() {
  const row = await arow('SELECT ai_provider_policy,updated_at FROM platform_settings WHERE id=1').catch(() => null);
  return normalizeAiProviderPolicy(row);
}

export async function getModalitySettings() { return []; }
export async function getModalitySetting() { return null; }
export async function getAlerts() { return []; }
export async function getOrgOverrides() { return []; }
export async function isModalityEnabled() { return true; }