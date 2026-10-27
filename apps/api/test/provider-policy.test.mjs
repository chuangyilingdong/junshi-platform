import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeAiProviderPolicy } from '../src/routes/billingConfig.js';
import { providerSelectionForModality } from '../src/routes/aiGeneration.js';

const policy = {
  provider: 'custom',
  model: 'gpt-6-astra',
  channels: [
    { id: 'text-channel', provider: 'custom', protocol: 'RESPONSES', endpoint: 'https://api.deepseek.com', model: 'deepseek-flash', models: ['deepseek-flash', 'deepseek-v4-pro'] },
    { id: 'video-channel', provider: 'custom', protocol: 'CHAT', endpoint: 'https://api.seedance.nz', model: 'MiniMax-H3', requestPaths: { VIDEO: '/v2/video_generation' }, pollPaths: { VIDEO: '/v2/query/video_generation/{id}' } },
  ],
  modalityChannels: { TEXT: 'text-channel', VIDEO: 'video-channel' },
  modalityBackupChannels: {},
  modelRoutes: [],
};

test('provider policy keeps channel routing and paths', () => {
  const normalized = normalizeAiProviderPolicy(policy);
  assert.equal(normalized.mode, 'database');
  assert.equal(normalized.channels.length, 2);
  assert.equal(normalized.channels[1].requestPaths.VIDEO, '/v2/video_generation');

  const text = providerSelectionForModality(normalized, 'TEXT');
  assert.equal(text.channelId, 'text-channel');
  assert.equal(text.provider, 'custom');
  assert.equal(text.model, 'deepseek-flash');
  assert.equal(text.protocol, 'RESPONSES');

  const video = providerSelectionForModality(normalized, 'VIDEO');
  assert.equal(video.channelId, 'video-channel');
  assert.equal(video.pollPaths.VIDEO, '/v2/query/video_generation/{id}');
});

test('provider policy falls back to mock when missing', () => {
  const normalized = normalizeAiProviderPolicy(null);
  assert.equal(normalized.mode, 'mock');
  assert.equal(providerSelectionForModality(normalized, 'TEXT').provider, 'local-mock');
});