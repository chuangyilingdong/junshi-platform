# junshi-platform

招生军师独立仓库：桌面客户端、独立 API、抖音 Worker、静态资料、数据库迁移和验收脚本。

## 当前状态

- 迁移基线：`bf98fed22be069b1fafd0d0980d48d8608d0c3fa`
- 当前阶段：阶段 A（建仓与白名单盘点）
- 桌面客户端源码已迁入 `apps/desktop`
- `/api/junshi/*` 路由、服务、Worker、资料和迁移已迁入
- API 已可在 mock 环境独立启动，完成静态资料、mock DB、mock Provider 和 SSE 对话
- 未连接生产 MySQL、未改 Nginx、未切流量

## 目录

```text
apps/
  desktop/                 Electron 客户端
  api/                     独立 API（迁入中）
packages/
  contracts/               客户端/API 契约
  platform-core/           最小平台适配内核
deploy/
  migrations/              20 个 Junshi MySQL 迁移
  systemd/                 systemd unit
  nginx/                   Nginx 分流配置
  release/                 发布脚本与清单
docs/
  operations/              交接与验收资料
  migration/               基线清单与迁移记录
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
pnpm install
pnpm --filter @junshi/desktop test
pnpm test:migration
```

`test:migration` 校验从基线迁入的文件内容与清单哈希一致。

Mock API 测试：
ode --test apps/api/test/api.test.mjs。

验收脚本不再包含明文测试密码；需要真实验收时，在本地设置 `JUNSHI_TEST_PASSWORD`。