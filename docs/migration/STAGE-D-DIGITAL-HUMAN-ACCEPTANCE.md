# 数字人与旧网页生产验收

日期：2026-11-02

## 环境

- 当前 release：`/srv/junshi-platform/releases/20261027T125214Z`
- `junshi-api`：active，`NRestarts=0`
- 公网：`https://aicyld.com/api/junshi/*`

## 数字人最小任务

使用测试机构现有 ORG_ADMIN 创建 30 分钟临时会话，未输出密码或 Token。

输入：

- 文案：`你好，这是数字人验收。`
- 语音：1 段
- 模式：参考音频直出（speaker_id=`reference`）
- 形象：仓库内测试人脸图
- 语速：自然

结果：

```json
{
  "status": "succeeded",
  "elapsedMs": 451315,
  "videoBytes": 755928,
  "videoMime": "video/mp4",
  "segments": 1
}
```

链路覆盖：

- Seedance 人物底片 i2v
- 参考音频 TTS
- 人脸分析
- 单段对口型
- 视频拼接
- OSS 成片入库与下载

## 清理结果

```json
{
  "tempAssets": 0,
  "tempVoices": 0,
  "recentAvatarRuns": 0,
  "tempSessions": 0
}
```

中间分段音视频对象也已按 storage key 删除。

## 旧 `/junshi` 网页回归

```text
/junshi/index.html                  -> 200
GET  /api/junshi/overview           -> 200
GET  /api/junshi/library?limit=1    -> 200
GET  /api/junshi/workbench/bootstrap-> 200
POST /api/junshi/compliance         -> 200
```

合规接口返回有效 verdict，旧网页与新 API 路由兼容。

## 仍未验收

- 音乐生成最小链路
- 数字人失败分段重试
- 自动托管完整确认链路

文本、图片上传/下载、视频生成、数字人和旧网页基础回归均已通过生产验收。
## 自动托管完整确认流程

使用同一测试机构创建临时会话，预填单段口播并走完整托管确认：

- `autoHost=true`
- 单段口播
- 数字人合成
- 自动打包

结果：

```json
{
  "status": "succeeded",
  "autoHostStage": "ready",
  "elapsedMs": 421207,
  "outputBytes": 595058,
  "packageStatus": "ready",
  "packageAssets": 4
}
```

自动打包产出视频、封面、字幕和 ZIP 四类资产。

清理结果：

```json
{
  "tempAssets": 0,
  "tempVoices": 0,
  "recentAvatarRuns": 0,
  "recentWorks": 0,
  "tempSessions": 0
}
```