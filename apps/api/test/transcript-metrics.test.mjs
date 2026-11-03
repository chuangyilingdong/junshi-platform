import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeTranscriptMetrics, textEditRatio } from '../src/services/transcriptMetrics.js';

test('text edit ratio detects manual changes and caps long input', () => {
  assert.equal(textEditRatio('家长先了解课程', '家长先了解课程').editRatio, 0);
  assert.ok(textEditRatio('家长先了解课程', '家长先了解课程安排').editRatio > 0);
  const capped = textEditRatio('a'.repeat(2500), 'a'.repeat(2499), 500);
  assert.equal(capped.originalChars, 2500);
  assert.equal(capped.editCapped, true);
});

test('transcript metrics summarize extraction, ASR, visual and confirmation quality', () => {
  const summary = summarizeTranscriptMetrics([
    {
      id: 'm1', event_type: 'extraction', mode: 'auto', status: 'succeeded', input_source: 'douyin', result_source: 'visual',
      duration_ms: 12000, asr_status: 'empty', asr_duration_ms: 5000, asr_chars: 0,
      visual_status: 'succeeded', visual_duration_ms: 6000, visual_chars: 215, visual_frames: 12,
      result_chars: 215, result_segments: 8, created_at: '2026-11-03T01:00:00.000Z',
    },
    {
      id: 'm2', event_type: 'extraction', mode: 'speech', status: 'succeeded', input_source: 'upload', result_source: 'speech',
      duration_ms: 18000, asr_status: 'succeeded', asr_duration_ms: 17000, asr_chars: 1800, asr_segments: 22,
      visual_status: 'skipped', result_chars: 1800, result_segments: 22, created_at: '2026-11-03T02:00:00.000Z',
    },
    {
      id: 'm3', event_type: 'extraction', mode: 'both', status: 'failed', input_source: 'upload', result_source: '',
      duration_ms: 30000, asr_status: 'failed', asr_duration_ms: 9000, asr_error_code: 'WORKBENCH_ASR_FAILED',
      visual_status: 'empty', visual_duration_ms: 12000, visual_frames: 12, error_code: 'WORKBENCH_TRANSCRIPT_EMPTY',
      error: '没有拿到可用文案', created_at: '2026-11-03T03:00:00.000Z',
    },
    {
      id: 'm4', event_type: 'confirmation', mode: 'auto', status: 'confirmed', result_source: 'visual',
      original_chars: 215, edited_chars: 220, edit_ratio: 0.08, created_at: '2026-11-03T04:00:00.000Z',
    },
  ], 7);
  assert.equal(summary.extractions, 3);
  assert.equal(summary.successRate, 66.7);
  assert.equal(summary.asr.succeeded, 1);
  assert.equal(summary.asr.empty, 1);
  assert.equal(summary.asr.failed, 1);
  assert.equal(summary.visual.succeeded, 1);
  assert.equal(summary.visual.empty, 1);
  assert.equal(summary.confirmations.total, 1);
  assert.equal(summary.confirmations.editedRate, 100);
  assert.equal(summary.failureReasons[0].code, 'WORKBENCH_TRANSCRIPT_EMPTY');
  assert.equal(summary.recent[0].id, 'm4');
});
