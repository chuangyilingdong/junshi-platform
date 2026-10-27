import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageProcessFor, rowStorageBackend } from '../src/services/fileStorage.js';
import { ossConfigured, storageBackend } from '../src/services/objectStorage.js';

function withEnv(values, fn) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    process.env[key] = values[key];
  }
  try { return fn(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('storage stays local unless OSS is explicitly complete', () => {
  withEnv({ FILE_STORAGE: 'local', OSS_BUCKET: '', OSS_ACCESS_KEY_ID: '', OSS_ACCESS_KEY_SECRET: '', OSS_ENDPOINT: '' }, () => {
    assert.equal(storageBackend(), 'local');
    assert.equal(ossConfigured(), false);
  });
  withEnv({ FILE_STORAGE: 'oss', OSS_BUCKET: 'bucket', OSS_ACCESS_KEY_ID: 'id', OSS_ACCESS_KEY_SECRET: 'secret', OSS_ENDPOINT: 'oss-cn-guangzhou.aliyuncs.com', OSS_REGION: 'cn-guangzhou' }, () => {
    assert.equal(storageBackend(), 'oss');
    assert.equal(ossConfigured(), true);
  });
});

test('row storage backend uses persisted metadata', () => {
  assert.equal(rowStorageBackend({ metadata: JSON.stringify({ storageBackend: 'oss' }) }), 'oss');
  assert.equal(rowStorageBackend({ metadata: '{}' }), 'local');
  assert.equal(rowStorageBackend(null), 'local');
});

test('image processing string is bounded', () => {
  assert.equal(imageProcessFor(640), 'image/resize,w_640/format,webp/quality,q_80');
  assert.equal(imageProcessFor(1).includes('w_64'), true);
  assert.equal(imageProcessFor(5000).includes('w_2000'), true);
  assert.equal(imageProcessFor(0), null);
});