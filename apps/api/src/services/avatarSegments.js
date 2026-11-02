/**
 * 数字人分段执行状态机。
 *
 * 抽成纯模块的目的：可以在不调用付费 Provider 的前提下注入分段失败，
 * 验证重试只重新执行失败/未完成分段，已成功分段的音频与视频资产不会被覆盖。
 */

export function selectAvatarRetryTargets(segments, {
  retry = false,
  canReuseBase = false,
  segmentIndices = null,
} = {}) {
  const list = Array.isArray(segments) ? segments : [];
  if (!canReuseBase) {
    for (const segment of list) {
      segment.status = 'pending';
      segment.error = '';
    }
    return { targets: list, reset: true };
  }
  const selected = Array.isArray(segmentIndices) && segmentIndices.length
    ? new Set(segmentIndices.map((value) => Number(value)).filter((value) => value > 0))
    : null;
  return {
    targets: list.filter((segment) => segment.status !== 'done' && (!selected || selected.has(Number(segment.index)))),
    reset: !retry,
  };
}

/**
 * 执行一组分段。execute 负责真正调用 Provider；persist 负责落库。
 * 失败只影响当前分段，已成功分段保持原状态和资产字段。
 */
export async function executeAvatarSegments({
  segments,
  targets,
  execute,
  persist,
}) {
  if (!Array.isArray(segments)) throw new Error('segments must be an array');
  if (!Array.isArray(targets)) throw new Error('targets must be an array');
  if (typeof execute !== 'function') throw new Error('execute must be a function');
  if (typeof persist !== 'function') throw new Error('persist must be a function');

  let failures = 0;
  for (const segment of targets) {
    if (segment.status === 'done') continue;
    segment.status = 'running';
    segment.error = '';
    segment.note = '';
    await persist(segments);
    try {
      const patch = await execute(segment);
      Object.assign(segment, patch || {}, { status: 'done', error: '' });
    } catch (error) {
      failures += 1;
      segment.status = 'failed';
      segment.error = String(error?.message || error).slice(0, 500);
    }
    await persist(segments);
  }
  return {
    failures,
    remaining: segments.filter((segment) => segment.status !== 'done'),
  };
}