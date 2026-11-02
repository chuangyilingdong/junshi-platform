# 生产部署工作流

日期：2026-11-02

## 当前状态

- 部署脚本：`scripts/deploy-production.sh`
- GitHub Actions：`.github/workflows/deploy-production.yml`
- 触发方式：`workflow_dispatch` 人工触发
- 环境：GitHub Environment `production`
- 自动回滚：健康检查失败时切回上一 release
- SSH 使用受限部署密钥：只能执行 `deploy <commit>` / `verify <commit>`，不能获得交互式 shell
- 当前尚未配置 GitHub production secrets，首次真实工作流部署待执行
- 2026-11-02 尝试配置时，当前 GitHub 账号无仓库 admin 权限：创建 environment 返回 403
- 临时专用密钥未写入 GitHub，已从生产 authorized_keys 撤销并删除本地私钥

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
4. 通过受限 SSH 强制命令提交 `deploy <commit>`
5. 服务端校验 commit 属于 main，再从目标 commit 加载 `scripts/deploy-production.sh`
6. 创建新 release
7. `corepack pnpm install --prod --frozen-lockfile --ignore-scripts`
8. 运行 release 运行时依赖、迁移、API 和部署模板校验
9. 原子切换 `/srv/junshi-platform/current`
10. 重启 `junshi-api`
11. 验证本地 health/ready、公网 Junshi API、网站 API 和 healthcheck service
12. 任一步失败自动回滚 release、systemd unit 和 API

## 服务端强制命令

仓库文件：

```text
deploy/server/junshi-deploy-authorized
```

安装目标：

```text
/usr/local/sbin/junshi-deploy-authorized
```

`authorized_keys` 中使用 `restrict,command="/usr/local/sbin/junshi-deploy-authorized"` 限制该密钥。即使拿到密钥，也只能提交白名单 commit 的部署命令，不能执行任意 shell。

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