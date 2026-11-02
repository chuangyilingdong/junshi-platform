# CI 状态

日期：2026-11-02

## 工作流

- 文件：`.github/workflows/ci.yml`
- 触发：push 到 `main`、Pull Request
- Node：22.13.0
- pnpm：11.19.0

## 检查项

- `pnpm test:platform`
- `pnpm test:api`
- 迁移哈希校验
- API 依赖审计
- 部署模板检查

## 最近结果

- 运行：`41382456106`
- 结论：passed
- 耗时：约 19 秒

当前 CI 只覆盖 API、平台核心和仓库静态检查；Electron 桌面测试仍在本机执行。
## 生产部署

- 工作流：`.github/workflows/deploy-production.yml`
- 触发：`workflow_dispatch`，输入 main 上的完整 commit SHA
- 运行环境：GitHub Environment `production`
- 部署脚本：`scripts/deploy-production.sh`
- 当前状态：脚本已通过 `--no-switch` 验证；production secrets 和首次工作流运行待完成
- 详细说明：`STAGE-D-CICD.md`
