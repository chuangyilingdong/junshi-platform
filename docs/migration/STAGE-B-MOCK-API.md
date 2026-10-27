# 阶段 B：独立 Mock API

日期：2026-10-27

## 已完成

- 独立 HTTP 入口：`apps/api/src/index.js`
- `/health` 和 `/api/junshi/health`
- `/api/junshi/*` 路由分发，继续复用迁入的原始 Junshi 路由
- mock 鉴权：`x-junshi-mock-auth: 1` 或 `Authorization: Bearer <token>`
- 进程内 mock MySQL 适配，可完成账号和画像读写
- 本地 mock Provider，可完成 SSE 对话
- `packages/platform-core`：配置、HTTP、API Error、mock DB
- 依赖审计：22 个 API 文件，0 个未解析相对依赖

## 已验证

```powershell
$env:PATH='C:\Users\Administrator\.vibe-coding\node;'+$env:PATH
node --test apps/api/test/api.test.mjs
```

覆盖：

1. 健康检查与基线标识
2. 未带 mock 会话时返回 401
3. Workbench bootstrap
4. 静态知识库 overview
5. 创作账号与机构画像写入/读取
6. `/chat/stream` SSE 完整结束并写入消息历史

## 本地运行

```powershell
$env:PATH='C:\Users\Administrator\.vibe-coding\node;'+$env:PATH
$env:JUNSHI_API_MODE='mock'
node apps/api/src/index.js
```

请求示例：

```powershell
Invoke-RestMethod http://127.0.0.1:8788/health -Headers @{ 'x-junshi-mock-auth'='1' }
Invoke-RestMethod http://127.0.0.1:8788/api/junshi/workbench/bootstrap -Headers @{ 'x-junshi-mock-auth'='1' }
```

## 明确未做

- 未连接现有 MySQL
- 未接入机构登录 Cookie/Token
- 未接入真实 Provider、OSS 和计费
- 未改 Nginx
- 未改生产