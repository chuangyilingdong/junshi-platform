# 阶段 D 生产客户端验收

日期：2026-10-27

## 当前环境

- release：`/srv/junshi-platform/releases/20261027T125214Z`
- 代码提交：`2208a02`
- `junshi-api`：active，`NRestarts=0`
- 公网入口：`https://aicyld.com/api/junshi/*`

## 验收方式

使用测试机构 `org_2df1a02d1c7741a69f2b` 的现有 ORG_ADMIN 用户创建 5–20 分钟临时会话，测试结束后删除会话。未输出密码或 Token。

## 通过项

```text
workbench/bootstrap  -> true
chat/stream          -> event: done
OSS asset upload     -> true
OSS asset download   -> true
temporary cleanup    -> true
```

覆盖：

- 原平台 Bearer 会话鉴权
- 新 API bootstrap
- 真实文本 Provider SSE
- `compute_attempts` 机构归属
- OSS 上传与签名下载
- 临时账号、素材、聊天、会话清理

## 最小真实视频

参数：

- 模型：`MiniMax-H3`
- 时长：5 秒
- 分辨率：480P
- 比例：9:16
- 输出：MP4

结果：

```json
{
  "status": "succeeded",
  "elapsedMs": 191178,
  "assetBytes": 958886,
  "assetMime": "video/mp4"
}
```

过程中修复了两个 Provider 适配问题：

1. H3 请求模板需要被原样使用，不能走默认请求体
2. `providerConfig()` 必须保留 `modelRequestTemplates`、`requestPaths`、`pollPaths`

最终修复提交：`2208a02 fix(provider): preserve channel templates and paths`

## 清理

已清理：

- 临时 sessions
- 临时创作账号
- 临时 OSS 素材
- 临时视频渲染行与任务行
- 视频与文本验收产生的 compute_attempts

## 尚未验收

- 数字人口播最小链路
- 音乐生成最小链路
- 旧 `/junshi` 网页全量回归

视频、文本与 OSS 主链路已通过生产验收。