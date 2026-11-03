function percentile(values, ratio) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1))];
}

export function evaluateTranscriptHealth(rows, {
  minSamples = 5,
  successRateThreshold = 70,
  p95ThresholdMs = 180000,
} = {}) {
  const extractions = (Array.isArray(rows) ? rows : []).filter((row) => row.status === 'succeeded' || row.status === 'failed');
  const samples = extractions.length;
  const succeeded = extractions.filter((row) => row.status === 'succeeded').length;
  const successRate = samples ? Math.round((succeeded / samples) * 1000) / 10 : 0;
  const p95Ms = Math.round(percentile(extractions.map((row) => row.duration_ms), 0.95));
  const failures = [];
  if (samples >= minSamples && successRate < successRateThreshold) {
    failures.push(`成功率 ${successRate}% 低于阈值 ${successRateThreshold}%`);
  }
  if (samples >= minSamples && p95Ms > p95ThresholdMs) {
    failures.push(`P95 耗时 ${p95Ms}ms 高于阈值 ${p95ThresholdMs}ms`);
  }
  return {
    ok: failures.length === 0,
    skipped: samples < minSamples,
    reason: samples < minSamples ? `样本不足（${samples}/${minSamples}）` : '',
    samples,
    succeeded,
    successRate,
    p95Ms,
    failures,
    thresholds: { minSamples, successRateThreshold, p95ThresholdMs },
  };
}
