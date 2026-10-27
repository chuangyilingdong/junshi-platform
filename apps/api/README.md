# Junshi API

独立招生军师 API。当前支持 mock 模式和共享 MySQL / 机构会话鉴权适配。

## 当前能力

- `GET /health`
- `GET /ready`（执行数据库健康检查）
- `GET /cutover-ready`（检查 Provider、OSS 和切流阻断项）
- `GET /api/junshi/health`
- `GET /api/junshi/overview`
- `GET /api/junshi/workbench/bootstrap`
- `GET|POST|DELETE /api/junshi/workbench/accounts`
- `GET|PUT /api/junshi/workbench/profile`
- `GET|DELETE /api/junshi/workbench/chat`
- `POST /api/junshi/workbench/chat/stream`（SSE）

## 鉴权模式

- `JUNSHI_API_MODE=mock`：使用 mock 会话
- `JUNSHI_API_MODE=independent`：读取原平台 Bearer/Cookie 会话

Mock 请求头：

```http
x-junshi-mock-auth: 1
```

或：

```http
Authorization: Bearer mock-token
```

## 数据驱动

- `DB_DRIVER=mock`：进程内内存数据库，默认用于测试
- `DB_DRIVER=mysql`：连接共享 MySQL，读取原平台 `sessions`、`users`、`organizations` 和 `junshi_*` 表

## 运行

```powershell
$env:PATH='C:\Users\Administrator\.vibe-coding\node;'+$env:PATH
$env:JUNSHI_API_MODE='mock'
$env:DB_DRIVER='mock'
node apps/api/src/index.js
```

## 测试

```powershell
$env:PATH='C:\Users\Administrator\.vibe-coding\node;'+$env:PATH
node --test apps/api/test/api.test.mjs
node --test packages/platform-core/test/auth.test.mjs
```

## 边界

- mock DB 只在进程内，重启清空
- mock Provider 不生成真实图片/视频/数字人
- 本地上传目录为 `var/uploads`
- 共享 MySQL 和机构会话鉴权需用受控环境变量做只读验收
- 真实 Provider、OSS、计费和 Nginx 尚未接入