export function rowStorageBackend(file = {}) {
  return String(file.storage_backend || file.storageBackend || 'local');
}

export function uploadBackend() {
  return 'local';
}

export async function persistUploadBytes({ relativeKey, buffer, mimeType, writeLocal }) {
  const storagePath = await writeLocal();
  return { storageKey: relativeKey, storageBackend: 'local', storagePath, mimeType, size: buffer.length };
}

export function ossRedirectUrl(file = {}) {
  return file.url || file.publicUrl || null;
}

export function imageProcessFor() {
  return '';
}

export async function objectExists() {
  return false;
}

export async function materializeObject() {
  return false;
}

export async function removeObject() {
  return { ok: true };
}

export function storageOverview() {
  return { backend: 'local', configured: true };
}