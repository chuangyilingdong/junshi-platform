const DEFAULT_MAX_SAMPLES = 12;

function roundTime(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function uniqueSorted(values) {
  return [...new Set(values.map(roundTime).filter((value) => Number.isFinite(value)))].sort((a, b) => a - b);
}

function pickEvenly(values, count) {
  if (values.length <= count) return values;
  if (count <= 1) return [values[0]];
  const picked = [];
  for (let index = 0; index < count; index += 1) {
    picked.push(values[Math.round((index * (values.length - 1)) / (count - 1))]);
  }
  return [...new Set(picked)];
}

/** 场景变化时间优先；不足 12 个时用均匀时间补足，过多时均匀压缩，首尾始终保留。 */
export function selectSceneSampleTimes({ sceneTimes = [], duration = 0, maxSamples = DEFAULT_MAX_SAMPLES } = {}) {
  const total = Math.max(0, Number(duration) || 0);
  const limit = Math.max(1, Math.min(24, Math.round(Number(maxSamples) || DEFAULT_MAX_SAMPLES)));
  const end = total > 0.12 ? total - 0.08 : Math.max(0, total);
  const scenes = uniqueSorted(sceneTimes).filter((value) => value >= 0.04 && value <= end + 0.04);
  if (limit === 1) return [0];
  const baseCount = Math.min(limit, Math.max(1, Math.floor((limit * 2) / 3)));
  const uniform = Array.from({ length: limit }, (_, index) => (end * index) / (limit - 1));
  const selected = pickEvenly(uniform, baseCount);
  const isNear = (time) => selected.some((value) => Math.abs(value - time) < 0.35);
  const sceneRoom = Math.max(0, limit - selected.length);
  for (const time of pickEvenly(scenes.filter((value) => !isNear(value)), sceneRoom)) {
    selected.push(time);
  }
  for (const time of uniform) {
    if (selected.length >= limit) break;
    if (!selected.some((value) => Math.abs(value - time) < 0.02)) selected.push(time);
  }
  return uniqueSorted(selected).slice(0, limit);
}

export function visualFrameStrategy(sceneTimes = []) {
  return uniqueSorted(sceneTimes).length > 0 ? 'hybrid' : 'uniform';
}
export function buildVisualTranscriptPrompt({ duration = 0, frameCount = 0, frameStrategy = 'uniform' } = {}) {
  const strategy = frameStrategy === 'hybrid' || frameStrategy === 'scene' ? '场景变化关键帧 + 均匀补帧' : '均匀采样帧';
  return `【任务】这是一条抖音视频的 ${frameCount || '多'} 帧拼图（${strategy}），按从左到右、从上到下的顺序阅读。请只提取画面中明确可见的文案、字幕、标题、口播字幕和必要的英文产品名，整理成一条可读文案。

【不要提取】
- 抖音界面、用户名、头像、点赞/评论/收藏数字、按钮、进度条、水印、时间码。
- 代码编辑器里的代码、终端日志和装饰性符号。
- 看不清、被遮挡或无法确认的文字。
- 不要根据常识补全，不要把相邻帧的文字强行改写成通顺的长句。

【要求】
1. 按画面出现顺序合并重复文字。
2. 保留原文措辞和标点；只有明显重复的同一句才去重。
3. 没有可读文案时返回 detected=false。
4. 只输出一个 JSON 对象，不要解释或代码围栏。

【视频信息】时长约 ${Math.round(Number(duration) || 0)} 秒，采样 ${frameCount || '若干'} 帧，策略为${strategy}。

【输出格式】
{"detected":true,"text":"按顺序整理出的画面文案","segments":["第一段","第二段","第三段"],"notes":"识别不确定之处的简短说明"}
没有可读文案时输出：{"detected":false,"text":"","segments":[],"notes":"没有清晰可读的画面文字"}`;
}