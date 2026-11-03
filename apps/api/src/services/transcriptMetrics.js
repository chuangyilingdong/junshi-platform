function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function average(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function percentile(values, ratio) {
  const numbers = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!numbers.length) return 0;
  const index = Math.max(0, Math.min(numbers.length - 1, Math.ceil(numbers.length * ratio) - 1));
  return numbers[index];
}

function levenshtein(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = new Uint16Array(right.length + 1);
  let current = new Uint16Array(right.length + 1);
  for (let index = 0; index <= right.length; index += 1) previous[index] = index;
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    [previous, current] = [current, previous];
  }
  return previous[right.length];
}

/** 人工修改比例；长稿只对前 2000 字做编辑距离，避免阻塞请求。 */
export function textEditRatio(before, after, maxChars = 2000) {
  const original = String(before || '').replace(/\s+/g, ' ').trim();
  const edited = String(after || '').replace(/\s+/g, ' ').trim();
  const left = Array.from(original).slice(0, maxChars);
  const right = Array.from(edited).slice(0, maxChars);
  if (original === edited) return { originalChars: original.length, editedChars: edited.length, editRatio: 0, editCapped: false };
  if (!left.length || !right.length) return { originalChars: original.length, editedChars: edited.length, editRatio: 1, editCapped: original.length > maxChars || edited.length > maxChars };
  const distance = levenshtein(left, right);
  return {
    originalChars: original.length,
    editedChars: edited.length,
    editRatio: round(distance / Math.max(left.length, right.length), 4),
    editCapped: original.length > maxChars || edited.length > maxChars,
  };
}

function countStatus(rows, status) {
  return rows.filter((row) => row.status === status).length;
}

function countField(rows, field, status) {
  return rows.filter((row) => row[field] === status).length;
}

export function metricOut(row) {
  return {
    id: row.id || '',
    eventType: row.event_type || 'extraction',
    mode: row.mode || '',
    status: row.status || '',
    inputSource: row.input_source || '',
    resultSource: row.result_source || '',
    durationMs: Number(row.duration_ms) || 0,
    errorCode: row.error_code || '',
    error: row.error || '',
    asrStatus: row.asr_status || 'skipped',
    asrDurationMs: Number(row.asr_duration_ms) || 0,
    asrChars: Number(row.asr_chars) || 0,
    visualStatus: row.visual_status || 'skipped',
    visualDurationMs: Number(row.visual_duration_ms) || 0,
    visualChars: Number(row.visual_chars) || 0,
    visualFrames: Number(row.visual_frames) || 0,
    resultChars: Number(row.result_chars) || 0,
    resultSegments: Number(row.result_segments) || 0,
    editRatio: Number(row.edit_ratio) || 0,
    originalChars: Number(row.original_chars) || 0,
    editedChars: Number(row.edited_chars) || 0,
    createdAt: row.created_at || '',
  };
}

export function summarizeTranscriptMetrics(rows, days = 7) {
  const list = Array.isArray(rows) ? rows : [];
  const extractions = list.filter((row) => (row.event_type || 'extraction') === 'extraction');
  const confirmations = list.filter((row) => row.event_type === 'confirmation');
  const succeeded = extractions.filter((row) => row.status === 'succeeded');
  const asrRows = extractions.filter((row) => row.asr_status && row.asr_status !== 'skipped');
  const visualRows = extractions.filter((row) => row.visual_status && row.visual_status !== 'skipped');
  const failureMap = new Map();
  for (const row of extractions.filter((item) => item.status === 'failed')) {
    const code = row.error_code || 'WORKBENCH_TRANSCRIPT_FAILED';
    const current = failureMap.get(code) || { code, message: String(row.error || '').slice(0, 160), count: 0 };
    current.count += 1;
    if (!current.message && row.error) current.message = String(row.error).slice(0, 160);
    failureMap.set(code, current);
  }
  const recent = list
    .slice()
    .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
    .slice(0, 20)
    .map(metricOut);
  const byMode = {};
  for (const row of extractions) {
    const mode = row.mode || 'auto';
    const item = byMode[mode] || { mode, total: 0, succeeded: 0, failed: 0 };
    item.total += 1;
    if (row.status === 'succeeded') item.succeeded += 1;
    if (row.status === 'failed') item.failed += 1;
    byMode[mode] = item;
  }
  return {
    days: Number(days) || 7,
    extractions: extractions.length,
    succeeded: succeeded.length,
    failed: countStatus(extractions, 'failed'),
    successRate: extractions.length ? round((succeeded.length / extractions.length) * 100) : 0,
    durationMs: {
      avg: Math.round(average(succeeded.map((row) => row.duration_ms))),
      p50: Math.round(percentile(succeeded.map((row) => row.duration_ms), 0.5)),
      p95: Math.round(percentile(succeeded.map((row) => row.duration_ms), 0.95)),
    },
    asr: {
      attempted: asrRows.length,
      succeeded: countField(asrRows, 'asr_status', 'succeeded'),
      empty: countField(asrRows, 'asr_status', 'empty'),
      failed: countField(asrRows, 'asr_status', 'failed'),
      avgDurationMs: Math.round(average(asrRows.map((row) => row.asr_duration_ms))),
      avgChars: Math.round(average(asrRows.filter((row) => row.asr_status === 'succeeded').map((row) => row.asr_chars))),
    },
    visual: {
      attempted: visualRows.length,
      succeeded: countField(visualRows, 'visual_status', 'succeeded'),
      empty: countField(visualRows, 'visual_status', 'empty'),
      failed: countField(visualRows, 'visual_status', 'failed'),
      avgDurationMs: Math.round(average(visualRows.map((row) => row.visual_duration_ms))),
      avgChars: Math.round(average(visualRows.filter((row) => row.visual_status === 'succeeded').map((row) => row.visual_chars))),
      avgFrames: Math.round(average(visualRows.map((row) => row.visual_frames))),
    },
    confirmations: {
      total: confirmations.length,
      avgEditRatio: round(average(confirmations.map((row) => row.edit_ratio)), 4),
      editedRate: confirmations.length ? round((confirmations.filter((row) => Number(row.edit_ratio) > 0.02).length / confirmations.length) * 100) : 0,
      avgOriginalChars: Math.round(average(confirmations.map((row) => row.original_chars))),
    },
    failureReasons: [...failureMap.values()].sort((left, right) => right.count - left.count).slice(0, 5),
    byMode: Object.values(byMode),
    recent,
  };
}
