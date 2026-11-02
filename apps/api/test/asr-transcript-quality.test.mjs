import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { filterAsrResult, transcriptQualityIssue } from '../src/services/junshiDouyin.js';

test('ASR hallucination-only transcripts are rejected', () => {
  const result = filterAsrResult({
    duration: 61,
    text: 'This is the end of the video. I hope you enjoyed it. Thank you for watching.',
    segments: [
      { start: 0, end: 2, text: 'This is the end of the video.' },
      { start: 2, end: 4, text: 'I hope you enjoyed it.' },
      { start: 4, end: 6, text: 'If you did, please leave a like and subscribe.' },
      { start: 60, end: 62, text: 'Thank you for watching.' },
    ],
  });
  assert.equal(result.text, '');
  assert.deepEqual(result.segments, []);
  assert.equal(transcriptQualityIssue('you'), 'hallucination');
  assert.equal(transcriptQualityIssue('谢谢观看'), 'hallucination');
  assert.equal(transcriptQualityIssue('字幕由Amara.org社区提供'), 'hallucination');
});

test('ASR filtering keeps real Chinese speech and removes boilerplate segments', () => {
  const result = filterAsrResult({
    duration: 20,
    text: '体验课便宜只是入口。后面真正要看的是老师备课、课后点评和下一阶段课程。感谢观看。',
    segments: [
      { start: 0, end: 4, text: '体验课便宜只是入口。' },
      { start: 4, end: 8, text: '后面真正要看的是老师备课、课后点评和下一阶段课程。' },
      { start: 18, end: 20, text: '感谢观看。' },
    ],
  });
  assert.equal(result.text, '体验课便宜只是入口。\n后面真正要看的是老师备课、课后点评和下一阶段课程。');
  assert.equal(result.segments.length, 2);
  assert.equal(transcriptQualityIssue(result.text), '');
});

test('ASR filtering rejects low-confidence no-speech segments before they become copy', () => {
  const result = filterAsrResult({
    text: '这是一段看起来像中文但实际来自背景音乐的幻觉。',
    duration: 10,
    segments: [
      { start: 0, end: 5, text: '这是一段看起来像中文但实际来自背景音乐的幻觉。', noSpeechProb: 0.91, avgLogprob: -1.4 },
    ],
  });
  assert.equal(result.text, '');
  assert.deepEqual(result.segments, []);
});

test('transcript source modes are persisted, retry-safe and support mixed output', () => {
  const route = fs.readFileSync(new URL('../src/routes/junshiWorkbench.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../../desktop/src/app.js', import.meta.url), 'utf8');
  assert.match(route, /new Set\(\['auto', 'speech', 'visual', 'both'\]\)/);
  assert.match(route, /transcriptMode: mode/);
  assert.match(route, /\['auto', 'speech', 'both'\]\.includes\(mode\)/);
  assert.match(route, /mode === 'visual' \|\| mode === 'both'/);
  assert.match(route, /part\.source === 'speech' \? '口播' : '画面文字'/);
  assert.match(route, /return 'mixed'/);
  assert.match(app, /workflow-transcript-mode/);
  assert.match(app, /transcriptMode: composer\.transcriptMode \|\| 'auto'/);
  assert.match(app, /口播 \+ 画面文字合并稿/);
});

test('no-speech video falls back to visual text extraction and marks the source', () => {
  const route = fs.readFileSync(new URL('../src/routes/junshiWorkbench.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../../desktop/src/app.js', import.meta.url), 'utf8');
  assert.match(route, /buildVisualTranscriptPrompt/);
  assert.match(route, /tile=4x2/);
  assert.match(route, /extractVisualTextFromAsset/);
  assert.match(route, /source: 'visual'/);
  assert.match(route, /transcriptSource/);
  assert.match(route, /SELECT status, text, title, nickname, error, segments/);
  assert.match(app, /transcriptSource === 'visual'/);
  assert.match(app, /transcriptSource === 'mixed'/);
  assert.match(app, /这是画面文字，不是口播转写/);
});

test('transcription pipeline has Chinese ASR controls, quality guards, retry and manual fallback', () => {
  const service = fs.readFileSync(new URL('../src/services/junshiDouyin.js', import.meta.url), 'utf8');
  const route = fs.readFileSync(new URL('../src/routes/junshiWorkbench.js', import.meta.url), 'utf8');
  assert.match(service, /form\.append\('language'/);
  assert.match(service, /form\.append\('temperature', '0'\)/);
  assert.match(service, /no_speech_prob/);
  assert.match(route, /transcriptQualityIssue\(transcriptText\)/);
  assert.match(route, /transcriptQualityIssue\(currentState\.transcript\)/);
  assert.match(route, /text='', segments='\[\]', duration_seconds=0/);
  assert.match(route, /SELECT status, text, title, nickname, error, segments FROM junshi_workbench_transcripts/);
  assert.match(route, /extractError: tsRow\.error/);
  assert.match(route, /row\.state = JSON\.stringify\(nextState\)/);
  assert.match(route, /action === 'retry_transcript'/);
  assert.match(route, /\['transcript', 'extract_failed'\]\.includes\(wf\.stage\)/);
});
