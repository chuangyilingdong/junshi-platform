# ASR 与转写生产验收

日期：2026-11-02

## 环境

- release：`/srv/junshi-platform/releases/20261027T125214Z`
- 公网：`https://aicyld.com/api/junshi/*`

## 流程

1. 上传 15 秒测试音频到 OSS
2. 调用 `POST /api/junshi/workbench/assets/{id}/transcribe`
3. 轮询 `GET /api/junshi/workbench/transcripts/{id}`
4. 下载/校验转写结果
5. 清理素材、档案、任务和临时会话

## 结果

```json
{
  "status": "succeeded",
  "elapsedMs": 5138,
  "textLength": 44,
  "segments": 3,
  "durationSeconds": 14.95
}
```

## 清理结果

```json
{
  "tempAssets": 0,
  "tempTranscripts": 0,
  "tempSessions": 0
}
```

## 覆盖

- OSS 音频读取
- Seedance ASR 渠道
- 转写分段与时长
- 转写任务状态
- 失败/成功状态落库与清理

## 未覆盖

- 抖音浏览器登录与主页采集 Worker
- 真实抖音视频下载后自动转写
- 同行同步队列的真实平台抓取