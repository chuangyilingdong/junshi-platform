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
JUNSHI_ALERT_WEBHOOK_FORMAT=generic
```

仓库只保存占位，不包含真实 Webhook。

配置、权限、真实投递验证和故障行为见 `STAGE-D-ALERT-WEBHOOK.md`。

## 运行周期

- 开机 2 分钟后首次运行
- 之后每 5 分钟
- 随机延迟 0–20 秒
- `Persistent=true`
## 部署状态

2026-11-02 已部署：

- 当前 release：`/srv/junshi-platform/releases/20261102T063544Z`
- `junshi-healthcheck.timer`：active
- 手动运行：通过
- 首次定时运行：通过
- 周期：5 分钟
- 下次运行时间：`2026-11-02 11:18:17 CST`

当前未配置 Webhook，失败告警写入 journal。配置 `JUNSHI_ALERT_WEBHOOK_URL` 后可自动推送。