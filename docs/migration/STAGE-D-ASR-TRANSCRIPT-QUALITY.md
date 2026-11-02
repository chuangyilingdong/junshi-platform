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
38/38 passed
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
- 同工作流切换来源并保留上一稿快照
- 新提取失败后恢复上一稿
- 场景变化关键帧与均匀帧混合采样
- 12 帧拆成两张 3×2 拼图，避免整体缩放压小文字

桌面端：

```text
5/5 套通过
viral.manualFallback.retry=1
viral.manualFallback.manual=1
viral.manualPlanCount=3
viral.visualFallback=pass
viral.transcriptModeSwitchCount=4
viral.restorePrevious=pass
viral.visualMeta=hybrid/12 frames/2 sheets
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

- release：`/srv/junshi-platform/releases/20261102T065138Z`
- production commit：`8f890c5ca46ca7cfac21faae1141ee9de5659837`
- CI：`41402535785`，success
- `junshi-api`、Nginx、旧网站服务：active
- `junshi-api` NRestarts：0
- health / ready：通过

## 客户端 0.6.8

- 安装包：`E:\junshi-platform\apps\desktop\release\招生军师-Setup-0.6.8.exe`
- 大小：`121,664,488` bytes
- SHA256：`DA5D12B6ED5F72FC3ACFF584B8BA8BE5011C47998F1F62596146BB1ABE232E00`
- blockmap SHA256：`11E0B27AFB8AA7113709D2E764A1E36C57207906FE70F2E4628F62D9839D6EA3`
- 线上更新：`https://aicyld.com/downloads/junshi-desktop/latest.yml`
- 线上版本：`0.6.8`
- `latest.yml`、exe、blockmap 均返回 200，exe 支持 Range
- 未签名

## 边界

当前策略是“人声口播优先，画面文字回退”。OCR 结果只作为待确认稿，不直接进入改写；清晰度不足、文字被遮挡或没有文字时仍会要求手动粘贴。

## 工作流内切换来源验收

真实生产验收：

```text
初始来源：visual / 274 字
切换来源：speech
结果：extract_failed
上一稿：previousTranscript 快照存在
恢复上一稿：visual / 原 274 字完整恢复
```

临时 workflow、transcript、session 已清理。

## 场景变化抽帧验收

同一条 61 秒画面文字视频：

```text
纯场景变化帧：35 字
单一 4×3 拼图：165 字
场景变化 + 均匀补帧：215 字
frameCount：12
frameStrategy：hybrid
拼图：2 张 3×2
```

结论：场景变化帧必须保留均匀覆盖，且 12 帧不能压在一张图里。
