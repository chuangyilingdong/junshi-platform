import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeAvatarSegments, selectAvatarRetryTargets } from '../src/services/avatarSegments.js';

function segments() {
  return [
    {
      index: 1, text: 'first', status: 'done', error: '',
      audioSeconds: 1.1, durationSeconds: 1.22,
      audioStorageKey: 'run/seg1-voice.mp3', videoStorageKey: 'run/seg1.mp4',
    },
    { index: 2, text: 'second', status: 'pending', error: '', audioSeconds: 0, durationSeconds: 0 },
    { index: 3, text: 'third', status: 'pending', error: '', audioSeconds: 0, durationSeconds: 0 },
  ];
}

test('full run resets all segments when the base video cannot be reused', () => {
  const list = segments();
  list[0].status = 'failed';
  const plan = selectAvatarRetryTargets(list, { retry: true, canReuseBase: false });
  assert.equal(plan.reset, true);
  assert.deepEqual(plan.targets.map((segment) => segment.index), [1, 2, 3]);
  assert.deepEqual(list.map((segment) => segment.status), ['pending', 'pending', 'pending']);
});

test('retry reuses base and selects only incomplete segments', () => {
  const list = segments();
  list[1].status = 'failed';
  const plan = selectAvatarRetryTargets(list, { retry: true, canReuseBase: true });
  assert.equal(plan.reset, false);
  assert.deepEqual(plan.targets.map((segment) => segment.index), [2, 3]);
});

test('injected segment failure preserves successful segments and retries only the failed one', async () => {
  const list = segments();
  list[1].status = 'failed';
  list[1].error = 'injected timeout';
  const firstPlan = selectAvatarRetryTargets(list, { retry: true, canReuseBase: true });
  const firstCalls = [];
  let failSegment2 = true;
  const first = await executeAvatarSegments({
    segments: list,
    targets: firstPlan.targets,
    persist: async () => {},
    execute: async (segment) => {
      firstCalls.push(segment.index);
      if (segment.index === 2 && failSegment2) {
        failSegment2 = false;
        throw new Error('injected upstream timeout');
      }
      return {
        audioSeconds: 1.2,
        durationSeconds: 1.32,
        audioStorageKey: `run/seg${segment.index}-voice.mp3`,
        videoStorageKey: `run/seg${segment.index}.mp4`,
      };
    },
  });

  assert.deepEqual(firstCalls, [2, 3]);
  assert.equal(first.failures, 1);
  assert.deepEqual(first.remaining.map((segment) => segment.index), [2]);
  assert.equal(list[0].status, 'done');
  assert.equal(list[0].audioStorageKey, 'run/seg1-voice.mp3');
  assert.equal(list[0].videoStorageKey, 'run/seg1.mp4');
  assert.equal(list[1].status, 'failed');
  assert.match(list[1].error, /injected upstream timeout/);
  assert.equal(list[2].status, 'done');
  assert.equal(list[2].videoStorageKey, 'run/seg3.mp4');

  const secondPlan = selectAvatarRetryTargets(list, { retry: true, canReuseBase: true });
  assert.deepEqual(secondPlan.targets.map((segment) => segment.index), [2]);
  const secondCalls = [];
  const second = await executeAvatarSegments({
    segments: list,
    targets: secondPlan.targets,
    persist: async () => {},
    execute: async (segment) => {
      secondCalls.push(segment.index);
      return {
        audioSeconds: 1.25,
        durationSeconds: 1.37,
        audioStorageKey: 'run/seg2-voice-retry.mp3',
        videoStorageKey: 'run/seg2-retry.mp4',
      };
    },
  });

  assert.deepEqual(secondCalls, [2]);
  assert.equal(second.failures, 0);
  assert.equal(second.remaining.length, 0);
  assert.equal(list[0].videoStorageKey, 'run/seg1.mp4');
  assert.equal(list[1].videoStorageKey, 'run/seg2-retry.mp4');
  assert.equal(list[2].videoStorageKey, 'run/seg3.mp4');
  assert.notEqual(list[1].videoStorageKey, list[2].videoStorageKey);
});

test('persist observes running and terminal states for every attempted segment', async () => {
  const list = segments();
  list[0].status = 'pending';
  const states = [];
  await executeAvatarSegments({
    segments: list,
    targets: list,
    persist: async (current) => states.push(current.map((segment) => segment.status).join(',')),
    execute: async () => ({ videoStorageKey: 'ok.mp4' }),
  });
  assert.deepEqual(states, [
    'running,pending,pending',
    'done,pending,pending',
    'done,running,pending',
    'done,done,pending',
    'done,done,running',
    'done,done,done',
  ]);
});