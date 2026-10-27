# 阶段 D Provider 与切流门禁验收

日期：2026-10-27

## 当前 release

```text
/srv/junshi-platform/releases/20261027T080202Z
```

服务 `junshi-api`：active。

## 切流门禁

```text
GET http://127.0.0.1:8790/cutover-ready
```

结果：`409 blocked`。

已通过：

- MySQL：`databaseHealth.ok=true`
- Provider 策略：真实 `platform_settings`
- Provider Key：4/4 渠道可读
- Provider Adapter：TEXT / IMAGE / VIDEO / MUSIC 均已加载
- OSS：`backend=oss`、`configured=true`
- 会话鉴权：生产表结构与有效会话 JOIN 已验证

仍阻断：

```text
BILLING_ADAPTER_NOT_IMPLEMENTED
```

## 极小真实文本调用

调用限制：

- 系统提示：只回复 OK，不要解释
- 用户消息：ping
- `maxTokens=512`
- 仅 TEXT，不生成图片、视频、音乐或数字人

结果：

```json
{
  "ok": true,
  "provider": "custom",
  "model": "deepseek-flash",
  "elapsedMs": 949,
  "chars": 2,
  "text": "OK",
  "usage": {
    "inputTokens": 38,
    "outputTokens": 2,
    "totalTokens": 40,
    "cacheHitTokens": 0,
    "cacheMissTokens": 38
  }
}
```

## 安全边界

- 未从生产环境输出 API Key
- 未生成媒体内容
- 未修改 Nginx
- 未切外部流量
- 未写业务数据