import { AI_PROVIDER_API_KEY } from '../config.js';

const secrets = new Map();

export function getProviderApiKey(channelId = 'default') {
  return secrets.get(String(channelId || 'default')) || AI_PROVIDER_API_KEY || '';
}

export function setProviderApiKey(value, channelId = 'default') {
  const text = String(value || '').trim();
  if (text) secrets.set(String(channelId || 'default'), text);
}

export function hasProviderApiKey(channelId = 'default') {
  return Boolean(getProviderApiKey(channelId));
}

export function clearProviderApiKey(channelId = 'default') {
  secrets.delete(String(channelId || 'default'));
}