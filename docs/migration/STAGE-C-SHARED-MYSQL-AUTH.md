# 阶段 C：共享 MySQL 与机构登录

日期：2026-10-27

## 已完成

- `DB_DRIVER=mock|mysql` 动态驱动选择
- MySQL 连接池适配：`packages/platform-core/src/mysql.js`
- 读写接口：`aq` / `arow` / `arows`
- SQLite → MySQL 兼容翻译：`INSERT OR IGNORE`、`COLLATE NOCASE`、`NULLS LAST/FIRST`、`datetime('now')`、`IS ?`
- 会话鉴权：Bearer Token 与现有平台 Cookie
- 会话表校验：`sessions.token_hash`、`superseded_at`、`expires_at`
- 用户和机构校验：`users`、`organizations`
- 机构冻结、停用、合同到期和用户停用/过期检查
- 只读连通性脚本：`scripts/check-shared-mysql.mjs`

## 鉴权边界

新 API 不提供登录接口。登录仍由原网站服务处理：

```text
/api/auth/* -> 原网站服务
/api/junshi/* -> 独立 Junshi API
```

独立 API 只验证原服务签发的会话：

- `Authorization: Bearer <token>`
- `platform_token` Cookie
- `platform_token_admin` / `platform_token_org` 兼容读取

## 环境变量

```text
JUNSHI_API_MODE=independent
DB_DRIVER=mysql
JUNSHI_MYSQL_HOST=...
JUNSHI_MYSQL_PORT=3306
JUNSHI_MYSQL_USER=...
JUNSHI_MYSQL_PASSWORD=...
JUNSHI_MYSQL_DATABASE=aild_admin
JUNSHI_MYSQL_POOL_SIZE=5
```

也兼容原平台变量：`MYSQL_HOST`、`RDS_HOST`、`MYSQL_USER`、`RDS_USER`、`MYSQL_DATABASE` 等。

## 只读检查

```powershell
$env:PATH='C:\Users\Administrator\.vibe-coding\node;'+$env:PATH
$env:DB_DRIVER='mysql'
node scripts/check-shared-mysql.mjs
```

输出仅包含：

- 连接状态
- sessions 数量
- ORG_ADMIN 数量
- organizations 数量
- `junshi_%` 表数量

不读取用户密码、会话 token 或业务正文。

## 已验证

```powershell
node --test packages/platform-core/test/auth.test.mjs
```

覆盖：

- Bearer 与 Cookie 解析
- 会话有效、过期、被顶下线
- 用户停用
- 机构合同到期
- 用户字段归一化
- MySQL 环境变量优先级

## 独立模式启动检查

```powershell
node scripts/smoke-independent-api.mjs
```

该检查以 `JUNSHI_API_MODE=independent`、`DB_DRIVER=mysql` 启动 API，只请求 `/health`，不连接或查询数据库。
## 生产只读验收

2026-10-27 已通过 `ai-kids-prod` 对生产 MySQL 做只读检查：认证表 3/3、Junshi 表 31 个、鉴权字段 18/18、有效会话 JOIN 50 条。明细见 `STAGE-C-VERIFICATION.md`。

## 尚未完成

- 真实 Provider、OSS 和计费尚未接入
- 尚未创建独立 systemd 进程
- 尚未改 Nginx