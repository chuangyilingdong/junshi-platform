import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

const file = process.env.AI_PROVIDER_SECRET_FILE || '/etc/ai-kids-platform/provider-secrets.json';
const key = createHash('sha256').update(String(process.env.AUTH_PEPPER || 'junshi-local-mock-pepper')).digest();

function readStore() {
  try {
    const value = JSON.parse(readFileSync(file, 'utf8'));
    return value.secrets && typeof value.secrets === 'object' ? value.secrets : (value.data ? { default: value } : {});
  } catch {
    return {};
  }
}

function encrypt(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return { iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: data.toString('base64') };
}

function decrypt(value) {
  try {
    if (!value?.iv || !value?.tag || !value?.data) return '';
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(value.tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function getProviderApiKey(channelId = 'default') {
  return decrypt(readStore()[String(channelId || 'default')]);
}

export function setProviderApiKey(value, channelId = 'default') {
  const text = String(value || '').trim();
  if (!text) return;
  const secrets = readStore();
  secrets[String(channelId || 'default')] = encrypt(text);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ version: 1, secrets }), { mode: 0o600 });
}

export function hasProviderApiKey(channelId = 'default') {
  return Boolean(getProviderApiKey(channelId));
}

export function clearProviderApiKey(channelId = 'default') {
  const channel = String(channelId || 'default');
  const secrets = readStore();
  if (!Object.prototype.hasOwnProperty.call(secrets, channel)) return false;
  delete secrets[channel];
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ version: 1, secrets }), { mode: 0o600 });
  return true;
}