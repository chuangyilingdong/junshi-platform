# 阶段 E 旧代码清理盘点

日期：2026-11-02

## 结论

阶段 E 尚未执行删除。本文件只记录依赖、风险、访问量和推荐清理顺序。

- 旧仓库：`E:\学习平台正常`
- 分支：`feature/vibecoding-ppt-quality-20260915`
- HEAD：`1b8be1e31b7014edb7221bdf87a0e82c4c6bd5f6`
- 当前工作区不干净：有 `deliverables/` 和 2 份未跟踪交接文档
- E1 前候选：89 个 tracked 文件，约 6.27 MB
- 另有 7 个集成点需要修改，但不应删除

## 旧 `/junshi` 访问量

Nginx 日志按文件统计 `/junshi` 请求：

```text
access.log      29
access.log.1     1
access.log.2-6   0
access.log.7   142
```

结论：

- 最近约 8 天总计 172 次
- 近期流量低，但并非 0
- 不能直接删除旧网页，必须先做产品决策或跳转方案

## 清理分组

### E1 · 重复客户端源码（已完成，本地提交）

```text
apps/junshi-desktop
```

- 21 个 tracked 文件
- 约 414 KB
- 新仓库已有等价 `apps/desktop`
- 已同步修改根 `package.json`、`pnpm-lock.yaml`、`.gitignore`

### E2 · 旧服务端实现（中风险）

路由：

```text
apps/server/src/routes/junshi.js
apps/server/src/routes/junshiWorkbench.js
```

- 2 个文件，约 409 KB
- 仅被 `apps/server/src/index.js` 引用

服务：

```text
complianceEngine.js
junshiAvatar.js
junshiChat.js
junshiDouyin.js
junshiDouyinAssistant.js
junshiDouyinLogin.js
junshiTalkingHead.js
junshiWorkbenchContent.js
junshiWorkbenchHosting.js
junshiWorkbenchPackaging.js
```

- 10 个文件，约 176 KB
- 依赖方仅在旧 Junshi 路由内部
- `openaiCompatibleProvider.js` 和 `generationProvider.js` 被平台其他 AI 功能共用，**不能删**

Python Worker：

```text
apps/server/src/douyin/
```

- 5 个文件，约 29 KB
- 仅服务旧 `/api/junshi/*`

参考数据：

```text
apps/server/data/junshi/
```

- 5 个文件，约 4.37 MB
- 需同步移除 `deploy/production/build-production.sh` 中的数据复制逻辑

安装脚本：

```text
deploy/production/setup-junshi-douyin-browser.sh
deploy/production/setup-junshi-douyin-runtime.sh
```

- 2 个文件，约 5 KB

服务端集成点：

```text
apps/server/src/index.js
deploy/production/build-production.sh
package.json
pnpm-lock.yaml
THIRD-PARTY-NOTICES.md
```

删除前必须确认不再回滚到旧 API。当前 Nginx 切流备份仍依赖旧服务处理 `/api/junshi/*`。

### E3 · 旧网页与扩展（高风险）

```text
apps/website/public/junshi/
apps/website/public/assets/junshi/
apps/website/public/douyin-assistant/
apps/website/scripts/stamp-junshi.mjs
```

- 12 个 tracked 文件，约 695 KB
- 仍由生产 Nginx 提供访问
- 删除前必须确定用户去向：下线提示、桌面客户端下载页或临时兼容跳转

### E4 · 迁移与 Schema 副本（后续）

```text
deploy/production/migrate/27..47-junshi-*.sql
packages/database/src/schema.js
```

- 20 个迁移文件，约 48 KB
- `schema.js` 中有 91 处 Junshi 相关定义
- 新仓库已经持有迁移和 schema 演进责任
- 不得删除 MySQL 表或业务数据，只清理旧仓库代码副本

### 验收脚本

```text
scripts/p149-junshi-published-works.mjs
scripts/p150-video-storyboard-frames.mjs
scripts/p152..p155、p191..p194 junshi-*.mjs
```

- 12 个文件，约 123 KB
- 新仓库已有对应测试或迁移后版本
- 可随对应源码一起移除

## E1 历史处理

旧仓库操作期间出现并发分享修复提交，已将本地历史拆分为：

```text
09175d08 fix(share): keep share labels compact
4543c24e chore(stage-e): remove duplicate junshi desktop source
```

重写前备份分支：

```text
backup/pre-e1-rewrite-20261102125714
```

## 必须保留

- `openaiCompatibleProvider.js`
- `generationProvider.js`
- 文件上传、OSS、鉴权、MySQL 等平台共享模块
- 非 Junshi 的网站、Admin、Org、Student 功能
- Nginx 配置与切流备份，直到旧 API 回滚窗口正式关闭
- `junshi_*` 数据库表与全部业务数据

## 推荐顺序

1. **E0 冻结**：停止向旧 Junshi 源码增加功能，只保留安全修复
2. **E1**：移除重复桌面客户端源码与 workspace 条目
3. **E2**：确认旧 API 回滚窗口关闭后，移除旧路由、服务、Worker、数据和安装脚本
4. **E3**：旧网页访问完成迁移/跳转后，移除静态页面、资源与扩展
5. **E4**：最后清理迁移与 schema 副本；不触碰数据库数据

## 执行门槛

- 旧仓库工作区先清零
- 用户明确授权删除
- 旧网页入口有明确替代方案
- Nginx 回滚策略已重新确认
- 新仓库 CI、安装版客户端、旧网页全量回归均通过
- 每一步单独提交并保留可恢复 tag

## 当前建议

先做 E1 是风险最低的，但在用户明确授权前不执行删除。