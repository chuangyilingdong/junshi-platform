# 抖音视频转写幻觉修复验收

日期：2026-11-02

## 问题

用户上传一条 61 秒的 DeepSeek 演示类抖音视频后，转写结果出现了三种明显错误：

```text
you
```

```text
This is the end of the video. I hope you enjoyed it. If you did, please leave a like and subscribe.
```

```text
字幕由Amara.org社区提供
```

这些都不是视频里的真实口播。视频本身是节奏型画面演示，音频持续有声音但没有稳定人声；ASR 对背景音乐产生了幻觉。

## 根因

- 旧管线只判断转写文本是否非空，不判断内容是否真的像口播。
- ASR 请求没有强制中文语种、低温度和无口播时不要猜测的约束。
- 逐段结果中的 `no_speech_prob`、`avg_logprob`、`compression_ratio` 没有进入质量过滤。
- 失败后仍会把旧转写留在档案里，界面可能继续显示上一次的幻觉文本。
- 提取失败页没有“重新提取”和“手动粘贴文案”入口。

## 修复

### 转写请求

- `language=zh`
- `temperature=0`
- 提示模型只转写实际说出的中文；没有清晰人声时返回空文本，不补写片尾语或英文套话。

### 结果过滤

- 拒绝空文本和过短文本。
- 过滤 Whisper 常见英文片尾幻觉、重复句、字幕署名和中文片尾套话。
- 丢弃 `no_speech_prob >= 0.6` 且 `avg_logprob < -0.8` 的低置信段。
- 丢弃高压缩比、明显重复的段。
- 过滤后仍为空时，转写档案标记失败，而不是返回一句假文案。

### 工作流恢复

- 旧的 `you`、字幕署名等无效文本在轮询时自动转为 `extract_failed`。
- 重试开始时清空旧 `text/segments/duration`。
- 失败时显示真实原因：没有识别到清晰口播，只检测到背景音乐、环境声或画面文字。
- 界面提供：
  - 重新提取
  - 手动粘贴画面文案并继续拆解改写方案

## 画面文字回退

只有背景音乐、没有清晰人声的视频，ASR 为空后自动进入画面文字识别：

```text
ASR 为空
→ 抽取 8 帧并拼成 4×2 联系表
→ 多模态 TEXT 通道读取画面文案
→ 排除抖音 UI、用户名、按钮、代码和水印
→ 按画面顺序去重
→ 标记 transcriptSource=visual
→ 用户确认后才拆解改写
```

真实生产验收识别出 230 字画面文案，包括：

```text
Hello，我是 DeepSeek V4.1-Flash。
我不是视频生成模型。
我不能凭空生成任何一帧画面。
用代码做视频
以上每一帧，都是一行一行代码写出来的。
```

界面会明确提示：

```text
这是画面文字，不是口播转写
请先核对，必要时直接修改，再进入拆解改写。
```

## 测试

API：

```text
34/34 passed
```

覆盖：

- 英文片尾幻觉整段拒绝
- `you` 和字幕署名拒绝
- 真实中文口播保留
- 低置信无语音段丢弃
- 旧工作流质量守卫
- 重试清空旧文本
- 真实失败原因透传
- 画面文字回退生成 8 帧拼图并标记 visual 来源
- transcriptMode 在重试 payload 中保留
- 自动、口播、画面文字、口播+画面文字四种模式

桌面端：

```text
5/5 套通过
viral.manualFallback.retry=1
viral.manualFallback.manual=1
viral.manualPlanCount=3
viral.visualFallback=pass
```

## 真实生产验收

同一条 61 秒素材：

```text
修复前：transcript = you
第二次：transcript = 英文片尾幻觉
第三次：transcript = 字幕由Amara.org社区提供
```

部署后：

```text
旧工作流：transcript = you -> extract_failed
重新提取：ASR 仍为空
画面文字回退：transcriptSource = visual
画面文字：230 字
状态：transcript，等待用户确认
用户确认后才进入拆解改写
```

## 生产状态

- release：`/srv/junshi-platform/releases/20261102T062208Z`
- production commit：`79c5b792a58d355360fb2b4a96c815f2329a4586`
- CI：`41399416143`，success
- `junshi-api`、Nginx、旧网站服务：active
- `junshi-api` NRestarts：0
- health / ready：通过

## 客户端 0.6.6

- 安装包：`E:\junshi-platform\apps\desktop\release\招生军师-Setup-0.6.6.exe`
- 大小：`121,664,079` bytes
- SHA256：`FB03C481C7FD0E605A57E6C5ED7325F823A9CE2CC2540E97326D9AB9B164DBE3`
- blockmap SHA256：`57D8A7A0EB08D87B6F2C00D50A8F1630621CA2886F8C655F5876842BE63850E0`
- 线上更新：`https://aicyld.com/downloads/junshi-desktop/latest.yml`
- 线上版本：`0.6.6`
- `latest.yml`、exe、blockmap 均返回 200，exe 支持 Range
- 未签名

## 边界

当前策略是“人声口播优先，画面文字回退”。OCR 结果只作为待确认稿，不直接进入改写；清晰度不足、文字被遮挡或没有文字时仍会要求手动粘贴。
