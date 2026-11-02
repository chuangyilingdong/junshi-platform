# junshi-platform

![CI](https://github.com/chuangyilingdong/junshi-platform/actions/workflows/ci.yml/badge.svg)

招生军师独立仓库：桌面客户端、独立 API、抖音 Worker、静态资料、数据库迁移和验收脚本。

## 当前状态

- 迁移基线：`bf98fed22be069b1fafd0d0980d48d8608d0c3fa`
- 当前阶段：阶段 D 完成（独立 API 已部署并完成 Nginx 灰度切流）
- 独立服务：`junshi-api`，`127.0.0.1:8790`，production active
- 当前 release：`/srv/junshi-platform/releases/20261102T063544Z`
- 桌面客户端源码已迁入 `apps/desktop`
- `/api/junshi/*` 路由、服务、Worker、资料和迁移已迁入
- API 可在 mock 环境独立启动，SSE 对话链路已跑通
- 共享 MySQL 与机构会话鉴权适配已实现
- 共享 MySQL、机构会话鉴权、真实 Provider 和 OSS 已完成生产检查
- 真实文本、OSS 上传下载、5 秒视频、单段数字人、ASR 转写生产验收通过
- 自动托管完整确认与自动打包通过
- Electron 客户端登录/采集/工作台/完整 UX 冒烟通过
- 抖音采集助手配对与元数据上报通过
- 真实抖音登录与 CDP 采集通过：捕获 60 条、下载 5 条、转写 5/5
- 安装版 0.6.2 + 真实机构账号逐页回归通过，API/页面错误均为 0
- 数字人失败分段重试通过确定性故障注入：第二次只重跑失败段
- 爆款复刻改为先拆机制、选改写方案，再按同一方案生成 3 个版本（客户端 0.6.3）
- 旧 `/junshi` 网页真实 Chrome 交互回归通过
- 旧 /junshi 全量逐页回归通过：4 页面 / 9 页签 / 7 画像分组 / 0 错误
- observation-only 计费账本已实现并验证
- 生产健康检查每 5 分钟运行，失败写 journal；支持可选 Webhook
- 人工触发生产部署工作流与自动回滚已准备，production secrets 待仓库管理员配置
- 阶段 E E1 已完成：旧仓库重复客户端源码已本地移除，E2-E4 尚未删除
- GitHub Actions CI 已通过
- `/api/junshi/*` 已分流到 `127.0.0.1:8790`
- 原 `/api/*` 继续由网站服务 `8789` 处理
- 切流记录见 `docs/migration/STAGE-D-FINAL-CUTOVER.md`

## 新对话交接

`docs/operations/交接-新对话-招生军师正式上线-20261102.md`

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