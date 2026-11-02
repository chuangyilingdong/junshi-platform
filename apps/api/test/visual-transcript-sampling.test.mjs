import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildVisualTranscriptPrompt, selectSceneSampleTimes, visualFrameStrategy } from '../src/services/junshiVisualTranscript.js';

test('uniform fallback fills twelve frames and preserves first and last frame', () => {
  const times = selectSceneSampleTimes({ sceneTimes: [], duration: 60, maxSamples: 12 });
  assert.equal(times.length, 12);
  assert.equal(times[0], 0);
  assert.ok(times.at(-1) > 59 && times.at(-1) < 60);
  assert.ok(times.every((value, index) => index === 0 || value > times[index - 1]));
  assert.equal(visualFrameStrategy([]), 'uniform');
});

test('sparse scene changes are retained and filled with uniform frames', () => {
  const scenes = [8.1, 24.2, 41.3];
  const times = selectSceneSampleTimes({ sceneTimes: scenes, duration: 60, maxSamples: 12 });
  assert.equal(times.length, 12);
  assert.ok(scenes.every((scene) => times.some((time) => Math.abs(time - scene) < 0.02)));
  assert.equal(visualFrameStrategy(scenes), 'hybrid');
});

test('dense scene changes compress to twelve frames and keep first and last', () => {
  const scenes = Array.from({ length: 24 }, (_, index) => 2 + index * 2);
  const times = selectSceneSampleTimes({ sceneTimes: scenes, duration: 60, maxSamples: 12 });
  assert.equal(times.length, 12);
  assert.equal(times[0], 0);
  assert.ok(times.at(-1) > 59);
  assert.equal(new Set(times).size, times.length);
  assert.equal(visualFrameStrategy(scenes), 'hybrid');
});

test('visual prompt records frame count and scene strategy', () => {
  const prompt = buildVisualTranscriptPrompt({ duration: 61, frameCount: 12, frameStrategy: 'hybrid', sheetCount: 2 });
  assert.match(prompt, /12 帧拼图，分成 2 张拼图/);
  assert.match(prompt, /场景变化关键帧 \+ 均匀补帧/);
  assert.match(prompt, /detected=false/);
});
