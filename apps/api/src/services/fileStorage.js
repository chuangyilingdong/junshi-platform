import { stat } from 'node:fs/promises';
import {
  ossConfigured,
  storageBackend,
  putObject,
  signedUrl,
  getObjectToFile,
  headObject,
  withPrefix,
  deleteObject,
  ossInfo,
} from './objectStorage.js';

function parseMetadata(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || '{}') || {}; } catch { return {}; }
}

export function rowStorageBackend(file) {
  if (!file) return 'local';
  const meta = parseMetadata(file.metadata);
  return meta.storageBackend === 'oss' ? 'oss' : 'local';
}

export function uploadBackend() {
  return storageBackend();
}

export async function persistUploadBytes({ relativeKey, buffer, mimeType, writeLocal }) {
  if (uploadBackend() === 'oss') {
    const result = await putObject(relativeKey, buffer, mimeType);
    return { storageKey: result.key, storageBackend: 'oss', storagePath: null };
  }
  const storagePath = await writeLocal();
  return { storageKey: String(relativeKey).replaceAll('\\', '/'), storageBackend: 'local', storagePath };
}

export function ossRedirectUrl(file, { expires = 900, contentDisposition, imageProcess } = {}) {
  if (!file || rowStorageBackend(file) !== 'oss') return null;
  const key = String(file.storage_key || '').replaceAll('\\', '/');
  if (!key || !ossConfigured()) return null;
  return signedUrl(key, { expires, contentDisposition, imageProcess });
}

export function imageProcessFor(width, { quality = 80 } = {}) {
  const value = Math.round(Number(width));
  if (!Number.isFinite(value) || value <= 0) return null;
  const clamped = Math.max(64, Math.min(2000, value));
  return `image/resize,w_${clamped}/format,webp/quality,q_${Math.max(50, Math.min(95, Math.round(Number(quality) || 80)))}`;
}

export async function objectExists(file) {
  const key = String(file?.storage_key || '').replaceAll('\\', '/');
  if (!key || !ossConfigured()) return { exists: false, size: 0 };
  return headObject(key);
}

export async function materializeObject(file, destPath) {
  const key = String(file?.storage_key || '').replaceAll('\\', '/');
  if (!key) throw new Error('这一行没有 storage_key');
  const probe = await headObject(key).catch(() => ({ exists: false }));
  if (!probe.exists) throw new Error(`OSS 上找不到对象：${key}`);
  try {
    const local = await stat(destPath);
    if (local.isFile() && Number(probe.size) > 0 && local.size === Number(probe.size)) return destPath;
  } catch { /* 本地没有，继续下载 */ }
  await getObjectToFile(key, destPath);
  return destPath;
}

export async function removeObject(file) {
  const key = String(file?.storage_key || '').replaceAll('\\', '/');
  if (!key || rowStorageBackend(file) !== 'oss') return { deleted: false, reason: 'not-oss' };
  await deleteObject(key);
  return { deleted: true };
}

export function storageOverview() {
  return { ...ossInfo(), withPrefixSample: withPrefix('2026/09/example.png') };
}