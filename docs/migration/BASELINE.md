# 拆仓基线

- 原仓库：`E:\学习平台正常`
- 基线提交：`bf98fed22be069b1fafd0d0980d48d8608d0c3fa`
- 基线分支：`feature/vibecoding-ppt-quality-20260915`
- 当前 HEAD 不用于拆仓：`e74d9804` 之后的 9 个提交均为作品广场/官网改动

## 迁入范围

| 类型 | 数量 | 目标 |
|---|---:|---|
| 桌面客户端 | 21 | `apps/desktop/` |
| 路由 | 2 | `apps/api/src/routes/` |
| 服务 | 10（9 个 Junshi 服务 + `complianceEngine.js`） | `apps/api/src/services/` |
| Python Worker | 5 | `apps/api/src/douyin/` |
| 静态资料 | 5 | `apps/api/data/junshi/` |
| MySQL 迁移 | 20 | `deploy/migrations/` |
| 验收脚本 | 11 | `scripts/` |
| 交接文档 | 4 | `docs/operations/` |

合计 78 个迁移文件。`complianceEngine.js` 是按文档第 5 节补入的依赖闭环文件；文件哈希见 `baseline-manifest.json`。

## 明确不迁入

- 作品广场、官网和网站后台提交
- 旧 `/junshi` 网页 UI
- 网站主服务、完整平台基础设施
- 生产密钥、Provider Key、OSS Secret、测试密码
- 构建产物、发布目录、运行时上传文件

## 当前已知缺口

迁入的路由仍是网站平台内部模块，依赖 `lib.js`、Provider、上传/OSS、计费策略等。必须通过 `packages/platform-core` 显式适配后，API 才能独立运行。

## 公开仓库前处理

6 个验收脚本原先把旧测试密码硬编码在源码中。迁入后已改为必需读取环境变量 `JUNSHI_TEST_PASSWORD`，并在清单中记录 `redact-hardcoded-test-password` 转换。