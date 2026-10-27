# API 依赖审计

审计命令：

```powershell
pnpm audit:api-dependencies
```

当前结果：22 个 API JavaScript 文件，**0 个未解析的相对依赖**。迁移进来的真实路由已经可以通过 `platform-core` 的 mock 适配层加载。

## 已落地的 Mock 适配

| 原模块 | 新仓库归属 | 当前实现 |
|---|---|---|
| `lib.js` | `packages/platform-core` + `apps/api/src/lib.js` | ApiError、响应、ID、时间、mock 鉴权、内存数据库 |
| `config.js` | `packages/platform-core/src/config.js` | 独立 API 运行配置，不包含 Provider Key |
| `routes/aiGeneration.js` | `apps/api/src/routes/aiGeneration.js` | TEXT/IMAGE/VIDEO/AUDIO 的 mock Provider Selection |
| `routes/billingConfig.js` | `apps/api/src/routes/billingConfig.js` | 本地 mock Provider policy |
| `services/generationProvider.js` | `apps/api/src/services/generationProvider.js` | 文本流式 Mock Provider |
| `services/providerContract.js` | `apps/api/src/services/providerContract.js` | Mock 判定与错误归一化 |
| `services/providerSecret.js` | `apps/api/src/services/providerSecret.js` | 进程内密钥适配，不落盘 |
| `services/fileStorage.js` | `apps/api/src/services/fileStorage.js` | 本地存储最小实现 |
| `services/fileUploadSecurity.js` | `apps/api/src/services/fileUploadSecurity.js` | multipart 解析、大小限制与本地落盘 |

## 尚未接真实平台

以下能力目前仍是 mock，不能直接切生产：

- 共享 MySQL：当前为进程内 mock DB
- 机构登录：当前为 `x-junshi-mock-auth: 1` 或 Bearer 的 mock 会话
- AI Provider：当前为 `local-mock`
- OSS：当前只写本地 `var/uploads`
- 计费/权益：当前只返回 mock policy

切流前必须用正式适配器替换这些实现，并通过真实机构最小验收。