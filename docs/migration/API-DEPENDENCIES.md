# API 依赖审计

审计命令：

```powershell
pnpm audit:api-dependencies
```

当前结果：22 个 API JavaScript 文件，**0 个未解析的相对依赖**。迁移进来的真实路由已经可以通过 `platform-core` 适配层加载。

## 已落地适配

| 原模块 | 新仓库归属 | 当前实现 |
|---|---|---|
| `lib.js` | `packages/platform-core` + `apps/api/src/lib.js` | ApiError、响应、ID、时间、MySQL/mock 数据库、机构会话鉴权 |
| `config.js` | `packages/platform-core/src/config.js` | 独立 API 运行配置，不包含 Provider Key |
| `routes/aiGeneration.js` | `apps/api/src/routes/aiGeneration.js` | TEXT/IMAGE/VIDEO/AUDIO 的 Provider Selection |
| `routes/billingConfig.js` | `apps/api/src/routes/billingConfig.js` | 本地 mock Provider policy |
| `services/generationProvider.js` | `apps/api/src/services/generationProvider.js` | 文本流式 Mock Provider |
| `services/providerContract.js` | `apps/api/src/services/providerContract.js` | Mock 判定与错误归一化 |
| `services/providerSecret.js` | `apps/api/src/services/providerSecret.js` | 进程内密钥适配，不落盘 |
| `services/fileStorage.js` | `apps/api/src/services/fileStorage.js` | 本地存储最小实现 |
| `services/fileUploadSecurity.js` | `apps/api/src/services/fileUploadSecurity.js` | multipart 解析、大小限制与本地落盘 |

## 当前适配状态

- 共享 MySQL：已实现 `DB_DRIVER=mysql`，尚未连接受控环境验收
- 机构登录：已实现原平台 `sessions` / `users` / `organizations` 校验，尚未连接受控环境验收
- AI Provider 策略与密钥：已读取共享配置；`custom` 适配器尚未实现
- OSS：已迁入原平台零依赖 OSS 适配，待独立进程环境验证
- 计费/权益：当前只返回 mock policy

切流前必须完成真实 Provider/OSS/计费适配，并让 `/cutover-ready` 返回 200。