# 阶段 D 独立 API 部署记录

日期：2026-10-27

## 最终状态

- 服务：`junshi-api`
- 状态：`active`
- 开机启动：`enabled`
- 监听：`127.0.0.1:8790`
- 当前 release：`/srv/junshi-platform/releases/20261027T075157Z`
- current 链接：`/srv/junshi-platform/current`
- NRestarts：0
- ActiveEnterTimestamp：`2026-10-27 15:52:10 CST`

## 部署内容

- 代码来自 `main@30f964d`
- 依赖安装：`pnpm install --filter @junshi/api... --prod --frozen-lockfile --ignore-scripts`
- systemd unit：`/etc/systemd/system/junshi-api.service`
- Junshi 环境覆盖：`/etc/junshi-platform/production.env`
- 共享 MySQL 环境：`/etc/ai-kids-platform/production.env`
- 数据目录：`/srv/junshi-platform/data`
- 上传目录：`/srv/junshi-platform/uploads`
- 日志目录：`/srv/junshi-platform/logs`

Junshi 环境覆盖不含数据库密码：

```text
JUNSHI_API_MODE=independent
DB_DRIVER=mysql
PORT=8790
FILE_UPLOAD_ROOT=/srv/junshi-platform/uploads
JUNSHI_MAX_BODY_BYTES=209715200
```

## 验收结果

```text
/health  -> 200
/ready   -> 200，databaseHealth.ok=true
overview -> 200
无效 Token 访问 bootstrap -> 401
```

`/ready` 成功执行 MySQL 健康检查：

```json
{
  "status": "ready",
  "mode": "independent",
  "database": "mysql",
  "databaseHealth": {
    "ok": true,
    "driver": "mysql",
    "database": "aild_admin"
  }
}
```

## 外部流量

Nginx 尚未修改：

```text
https://aicyld.com/api/health           -> 原网站服务 8789
https://aicyld.com/api/junshi/overview  -> 原网站服务 8789
```

已验证两个外部地址均保持 200，生产网站未切流。

## 启动故障与修复

首次部署 `20261027T075029Z` 启动失败，原因有两个：

1. systemd 模板误用了不存在的 `/srv/junshi-platform/runtime/node/bin/node`
2. 入口判断在 `current` 符号链接下比较路径失效

修复：

- 复用 `/srv/ai-kids-platform/runtime/node/bin/node`
- 使用 realpath 比较入口
- 发布新 release `20261027T075157Z`

失败 release 保留用于审计，未成为 current。

## 回滚

当前 Nginx 未切流，回滚不影响网站：

```text
systemctl disable --now junshi-api
```

如需回到失败前状态，删除 current 链接并停用 systemd unit 即可。