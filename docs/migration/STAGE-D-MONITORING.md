# 生产健康检查与告警

日期：2026-11-02

## 覆盖

每 5 分钟检查：

- `http://127.0.0.1:8790/health`
- `http://127.0.0.1:8790/ready`
- `http://127.0.0.1:8790/cutover-ready`
- `https://aicyld.com/api/junshi/health`
- `https://aicyld.com/api/health`
- `junshi-api` systemd
- `nginx` systemd
- `learning-platform-production` systemd

## 文件

- `scripts/check-production-health.mjs`
- `deploy/systemd/junshi-healthcheck.service`
- `deploy/systemd/junshi-healthcheck.timer`

## 告警

默认失败写 journal：

```text
journalctl -u junshi-healthcheck.service
```

可选 Webhook：

```text
JUNSHI_ALERT_WEBHOOK_URL=...
JUNSHI_ALERT_WEBHOOK_FORMAT=generic|feishu
```

仓库只保存占位，不包含真实 Webhook。

## 运行周期

- 开机 2 分钟后首次运行
- 之后每 5 分钟
- 随机延迟 0–20 秒
- `Persistent=true`