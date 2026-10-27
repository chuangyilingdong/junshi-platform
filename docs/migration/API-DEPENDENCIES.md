# API 依赖审计

审计命令：

```powershell
pnpm audit:api-dependencies
```

当前结果：12 个 API JavaScript 文件，23 个未解析的相对依赖。`complianceEngine.js` 已按依赖闭环从基线迁入，其余均应在 `packages/platform-core` 或明确的 API 适配层中实现，不能从旧网站仓库深层反向引用。

## 待适配能力

| 旧模块 | 当前使用方 | 新仓库归属 | 处理要求 |
|---|---|---|---|
| `lib.js` | 路由和多个服务 | `platform-core` | MySQL、鉴权、错误、CORS、ID、时间适配 |
| `config.js` | Workbench/Avatar/Douyin | `platform-core` | 只保留运行时配置读取，不复制密钥 |
| `routes/aiGeneration.js` | Workbench/`junshiChat` | API adapter | Provider 选择和生成选项 |
| `routes/billingConfig.js` | Workbench/`junshiChat` | API adapter | 套餐、权益和 Provider 策略 |
| `services/generationProvider.js` | Workbench/`junshiChat` | `platform-core` | Provider 客户端 |
| `services/providerContract.js` | Workbench/`junshiChat` | `platform-core` | Provider 错误与 mock 判定 |
| `services/providerSecret.js` | Workbench/Avatar/Douyin | `platform-core` | 密钥读取与解密 |
| `services/fileStorage.js` | Workbench | `platform-core` | OSS/本地存储、跳转与删除 |
| `services/fileUploadSecurity.js` | Workbench | `platform-core` | multipart、大小限制和落盘安全 |

## 已完成

- `complianceEngine.js` 与 `data/junshi/compliance-rules.json` 已迁入，可独立加载和扫描。
- 静态资料路径在新目录结构下仍解析到 `apps/api/data/junshi/`。

## 下一道门槛

在未实现 `lib.js`、Provider、存储和上传适配前，API 不应宣称可独立启动，也不应切生产流量。