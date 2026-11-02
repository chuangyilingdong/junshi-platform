# 视频转写来源固定回归集

日期：2026-11-02

## 目标

固定验证四种转写模式：

- `auto`：有口播用口播；没有有效口播时自动读画面文字。
- `speech`：只识别口播，不读画面文字。
- `visual`：只识别画面文字，不跑 ASR。
- `both`：同时识别口播和画面文字，合并后交用户确认。

## 固定用例

| 用例 | 素材 | 模式 | 期望 |
|---|---|---|---|
| visual-speech-only | 画面文字视频 | speech | extract_failed，提示没有清晰口播 |
| visual-auto | 画面文字视频 | auto | transcript，来源 visual |
| visual-explicit | 画面文字视频 | visual | transcript，来源 visual |
| speech-auto | 有口播视频 | auto | transcript，来源 speech |
| speech-explicit | 有口播视频 | speech | transcript，来源 speech |
| speech-both | 有口播视频 | both | transcript，来源 speech 或 mixed |
| mixed-both | 口播 + 画面文字视频 | both | transcript，来源 mixed |
| silence-no-text | 纯音乐无文字视频 | auto | extract_failed |
| dialect-speech | 方言口播视频 | speech | transcript，来源 speech |
| long-speech | 5 分钟以上口播视频 | speech | transcript，来源 speech |

后四项为可选扩展素材；前六项必须配置。

## 环境变量

```text
JUNSHI_REGRESSION_ORG_ID
JUNSHI_REGRESSION_USER_ID

JUNSHI_REGRESSION_VISUAL_ASSET_ID
JUNSHI_REGRESSION_SPEECH_ASSET_ID

# 可选
JUNSHI_REGRESSION_MIXED_ASSET_ID
JUNSHI_REGRESSION_NO_TEXT_ASSET_ID
JUNSHI_REGRESSION_DIALECT_ASSET_ID
JUNSHI_REGRESSION_LONG_ASSET_ID
```

视频文件不提交仓库。回归脚本直接使用测试机构素材库里的 asset id，避免把用户视频或大文件带进 Git。

## 执行

```powershell
$env:PATH='C:\Users\Administrator\.vibe-coding\node;'+$env:PATH
$env:JUNSHI_ALLOW_REAL_PROVIDER='1'
$env:JUNSHI_REGRESSION_ORG_ID='...'
$env:JUNSHI_REGRESSION_USER_ID='...'
$env:JUNSHI_REGRESSION_VISUAL_ASSET_ID='...'
$env:JUNSHI_REGRESSION_SPEECH_ASSET_ID='...'
pnpm regression:transcript-sources
```

测试会创建临时机构 session、临时工作流和转写档案，结束后删除；素材本身保留。

## 通过标准

- 失败类型与来源标记符合表格。
- `transcript` 非空。
- 强制 speech 模式不得偷偷读画面文字。
- 强制 visual 模式不得偷偷调用 ASR 并把结果当画面文字。
- both 模式只有两份都成功时才是 mixed。
- 临时 session、workflow、transcript 全部清理。
