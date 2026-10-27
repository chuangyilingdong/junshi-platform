# 阶段 C 生产只读验收

日期：2026-10-27

## 验收入口

- SSH：`ai-kids-prod`
- 服务：`learning-platform-production`
- 服务状态：`active`
- 工作目录：`/srv/ai-kids-platform/production/current`
- 当前 release：`/srv/ai-kids-platform/production/releases/20261027T065405Z`
- 服务启动时间：`2026-10-27 14:54:21 CST`
- 环境文件：`/etc/ai-kids-platform/production.env`
- 数据库：`aild_admin`

本次只执行 `SELECT` 和 `SHOW COLUMNS`，未执行 INSERT、UPDATE、DELETE 或 DDL。

## 连接结果

```json
{
  "ok": true,
  "database": "aild_admin",
  "sessions": 1157,
  "orgAdmins": 12,
  "organizations": 22,
  "authTables": 3,
  "junshiTables": 31
}
```

## 鉴权字段兼容

| 表 | 必需字段 | 已存在 |
|---|---:|---:|
| `sessions` | 4 | 4 |
| `users` | 10 | 10 |
| `organizations` | 4 | 4 |

必需字段：

- `sessions`：`token_hash`、`user_id`、`expires_at`、`superseded_at`
- `users`：`id`、`org_id`、`login`、`display_name`、`role`、`permissions`、`status`、`expires_at`、`must_bind_phone`、`deleted_at`
- `organizations`：`id`、`name`、`status`、`contract_expires_at`

会话 JOIN 检查：

```json
{
  "validSessionJoin": 50
}
```

该结果证明当前生产库可以完成：

```text
sessions -> users -> organizations
```

且有效会话、活跃用户和组织关联字段均可用。

## 安全边界

- 未输出账号、密码、Token、Token Hash、用户资料或业务正文
- 未读取 `.env` 内容到工作区
- 未向生产数据库写入任何数据
- 未重启服务、未改 Nginx、未发布新进程