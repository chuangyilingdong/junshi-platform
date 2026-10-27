# junshi-platform

招生军师独立仓库：桌面客户端、独立 API、抖音 Worker、静态资料、数据库迁移和验收脚本。

## 当前状态

- 迁移基线：`bf98fed22be069b1fafd0d0980d48d8608d0c3fa`
- 当前阶段：阶段 D（独立 API 已部署，Nginx 尚未切流）
- 独立服务：`junshi-api`，`127.0.0.1:8790`，production active
- 当前 release：`/srv/junshi-platform/releases/20261027T080202Z`
- 桌面客户端源码已迁入 `apps/desktop`
- `/api/junshi/*` 路由、服务、Worker、资料和迁移已迁入
- API 可在 mock 环境独立启动，SSE 对话链路已跑通
- 共享 MySQL 与机构会话鉴权适配已实现
- 共享 MySQL、机构会话鉴权、真实 Provider 和 OSS 已完成生产检查
- 真实文本最小调用通过；计费适配仍是切流阻断项
- Nginx 未改、未切流量；`/cutover-ready` 仍为阻断状态
- 当前阻断详见 `docs/migration/STAGE-D-CUTOVER-BLOCKERS.md`

## 目录

```text
apps/
  desktop/                 Electron 客户端
  api/                     独立 API
packages/
  contracts/               客户端/API 契约
  platform-core/           MySQL、鉴权、HTTP、Provider 适配
deploy/
  migrations/              20 个 Junshi MySQL 迁移
  systemd/                 systemd unit
  nginx/                   Nginx 分流配置
  release/                 发布脚本与清单
docs/
  operations/              交接与验收资料
  migration/               基线清单、依赖审计和阶段记录
scripts/                   验收脚本与迁移校验
```

## 第一阶段边界

- 共享现有 MySQL，仅访问、演进 `junshi_*` 表
- 共享现有机构登录与角色语义
- 新 API 只接管 `/api/junshi/*`
- 客户端继续访问 `https://aicyld.com`
- 旧 `/junshi` 网页留在原网站仓库并冻结
- 完成独立进程和 Nginx 分流验收前不切生产

## 常用命令

```powershell
$env:PATH='C:\Users\Administrator\.vibe-coding\node;'+$env:PATH
pnpm install
pnpm test:migration
pnpm test:platform
pnpm test:api
```

`test:migration` 校验从基线迁入的文件内容与清单哈希一致。

Mock API：

```powershell
$env:JUNSHI_API_MODE='mock'
node apps/api/src/index.js
```

共享 MySQL 只读检查：

```powershell
$env:DB_DRIVER='mysql'
node scripts/check-shared-mysql.mjs
```

验收脚本不再包含明文测试密码；需要真实验收时，在本地设置 `JUNSHI_TEST_PASSWORD`。