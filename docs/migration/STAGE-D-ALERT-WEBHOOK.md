# 生产健康检查 Webhook 配置

日期：2026-11-02

## 当前状态

- `junshi-healthcheck.timer` 正常，每 5 分钟运行
- generic / Feishu 两种 payload 已实现
- Webhook HTTP 失败、Feishu API 返回失败都会写入 journal
- 错误日志不会包含 Webhook URL
- 仓库仅保留空占位，不保存真实地址
- **真实 Webhook 尚未配置，当前失败仍只写 journal**

## 安全边界

真实地址只放：

```text
/etc/junshi-platform/alert-webhook.env
```

要求：

- 文件权限 `600`
- 属主 `root:root`
- 不写入仓库、不贴进 release、不放进命令参数
- 日志中只允许出现 format / HTTP 状态，不允许出现 URL

格式：

```text
JUNSHI_ALERT_WEBHOOK_URL=https://...
JUNSHI_ALERT_WEBHOOK_FORMAT=feishu
```

通用 Webhook 使用：

```text
JUNSHI_ALERT_WEBHOOK_FORMAT=generic
```

## 配置方法

在飞书目标群中添加“自定义机器人”，取得 Webhook 地址后，在服务器交互式执行：

```bash
umask 077
sudo install -m 600 -o root -g root /dev/null /etc/junshi-platform/alert-webhook.env
read -rsp 'Webhook URL: ' JUNSHI_ALERT_WEBHOOK_URL
printf 'JUNSHI_ALERT_WEBHOOK_URL=%s\nJUNSHI_ALERT_WEBHOOK_FORMAT=feishu\n' "$JUNSHI_ALERT_WEBHOOK_URL" \
  | sudo tee /etc/junshi-platform/alert-webhook.env >/dev/null
unset JUNSHI_ALERT_WEBHOOK_URL
sudo chmod 600 /etc/junshi-platform/alert-webhook.env
sudo chown root:root /etc/junshi-platform/alert-webhook.env
sudo systemctl daemon-reload
```

不要把 URL 作为命令行参数，否则会进入 shell history / 进程列表。

## 验证

语法与 payload：

```powershell
$env:PATH='C:\Users\Administrator\.vibe-coding\node;'+$env:PATH
pnpm test:healthcheck
pnpm test:deploy
```

生产真实投递：

```bash
sudo systemd-run --quiet --wait --pipe \
  --property=User=ai-kids-prod \
  --property=EnvironmentFile=/etc/ai-kids-platform/production.env \
  --property=EnvironmentFile=-/etc/junshi-platform/production.env \
  --property=EnvironmentFile=-/etc/junshi-platform/alert-webhook.env \
  /srv/ai-kids-platform/runtime/node/bin/node \
  /srv/junshi-platform/current/scripts/check-production-health.mjs \
  --test-webhook
```

预期：

```json
{"ok":true,"test":true,"format":"feishu","status":200}
```

随后手动跑一次完整健康检查：

```bash
sudo systemctl start junshi-healthcheck.service
sudo journalctl -u junshi-healthcheck.service -n 30 --no-pager -o cat
```

## 故障投递行为

- 健康检查失败时发送一条告警
- 健康检查成功时不发送
- 当前没有告警冷却/恢复通知；若持续失败，每 5 分钟会再发送一次
- 如果后续需要降噪，再增加状态文件与“仅状态变化通知”