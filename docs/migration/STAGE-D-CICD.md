# 生产部署工作流

日期：2026-11-02

## 当前状态

- 部署脚本：`scripts/deploy-production.sh`
- GitHub Actions：`.github/workflows/deploy-production.yml`
- 触发方式：`workflow_dispatch` 人工触发
- 环境：GitHub Environment `production`
- 自动回滚：健康检查失败时切回上一 release
- 当前尚未配置 GitHub production secrets，首次真实工作流部署待执行

## 必填 Secrets

在 GitHub `production` Environment 中配置：

```text
PROD_SSH_HOST
PROD_SSH_USER
PROD_SSH_PRIVATE_KEY
PROD_SSH_KNOWN_HOSTS
```

可选：

```text
PROD_SSH_PORT
```

建议为 `production` Environment 配置 required reviewers。仓库不保存任何私钥或主机密钥。

## 工作流步骤

1. 校验输入是 40 位 commit SHA
2. 校验 commit 属于 `main`
3. 安装依赖并运行现有 CI 门禁
4. 通过 SSH 把 `scripts/deploy-production.sh` 送入生产服务器
5. 创建新 release
6. `corepack pnpm install --prod --frozen-lockfile --ignore-scripts`
7. 运行 release 运行时依赖、迁移、API 和部署模板校验
8. 原子切换 `/srv/junshi-platform/current`
9. 重启 `junshi-api`
10. 验证本地 health/ready、公网 Junshi API、网站 API 和 healthcheck service
11. 任一步失败自动回滚 release、systemd unit 和 API

## 边界

- 不重新拆仓
- 不修改 Nginx 分流
- 不改数据库 schema
- 不写入生产密钥
- 不回滚数据库数据
- 保留上一 release 作为人工回滚点

## 已做验证

`scripts/deploy-production.sh d44a826e209f0e66d4e0a853da64d18d1d624da4 --no-switch`

结果：

```text
verified_release=/srv/junshi-platform/releases/20261102T041408Z
switch_skipped=true
```

该次只创建并验证 release，没有切换生产。

## 首次使用

1. 配置 `production` Environment secrets
2. 建议配置 required reviewer
3. 在 Actions 中选择 `Deploy Production`
4. 输入 `main` 上的完整 40 位 commit SHA
5. 审批后执行
6. 核对 job 输出的 `deployed_release`、`api_active`、`health`、`ready`