# Junshi API

独立招生军师 API，当前处于 mock 可运行阶段。

## 当前能力

- `GET /health`
- `GET /api/junshi/health`
- `GET /api/junshi/overview`
- `GET /api/junshi/workbench/bootstrap`
- `GET|POST|DELETE /api/junshi/workbench/accounts`
- `GET|PUT /api/junshi/workbench/profile`
- `GET|DELETE /api/junshi/workbench/chat`
- `POST /api/junshi/workbench/chat/stream`（SSE）

Mock 鉴权：

```http
x-junshi-mock-auth: 1
```

或：

```http
Authorization: Bearer mock-token
```

## 运行

```powershell
$env:PATH='C:\Users\Administrator\.vibe-coding\node;'+$env:PATH
$env:JUNSHI_API_MODE='mock'
node apps/api/src/index.js
```

## 测试

```powershell
$env:PATH='C:\Users\Administrator\.vibe-coding\node;'+$env:PATH
node --test apps/api/test/api.test.mjs
```

## 边界

- mock DB 只在进程内，重启清空
- mock Provider 不生成真实图片/视频/数字人
- 本地上传目录为 `var/uploads`
- 真实 MySQL、机构登录、OSS、Provider、计费和 Nginx 尚未接入