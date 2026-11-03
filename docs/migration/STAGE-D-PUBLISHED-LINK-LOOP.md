# 发布作品 ↔ 生成方案数据闭环 · 2026-11-03

## 目标

把实际发布后的抖音作品与生成它的内容方案、视频任务和发布包关联起来，让数据复盘能比较：

- 哪个钩子带来的播放、点赞、收藏更好；
- 哪类方案目标更容易转化；
- 哪个发布标题和方案组合值得复用。

本轮采用手动确认，不按标题自动匹配，避免同名内容误关联。

## 数据模型

新增迁移：

```text
deploy/migrations/48-junshi-workbench-published-links-mysql.sql
```

新表：

```text
junshi_workbench_published_links
```

关键约束：

- 一个发布作品最多关联一个生成成片；
- 一个生成成片最多关联一个发布作品；
- 关联记录保存发布作品 ID、aweme ID、视频任务 ID、方案 ID 和发布包 ID；
- 不修改 `published_works`、`video_works`、`plans`、`video_packages` 现有列。

## API

关联：

```text
POST /api/junshi/workbench/published-works/:publishedId/link
body: { "packageId": "jwvpkg_xxx", "accountId": "default" }
```

取消关联：

```text
DELETE /api/junshi/workbench/published-works/:publishedId/link?accountId=default
```

`GET /api/junshi/workbench/reports` 现在额外返回：

- `counts.linked`：已关联作品数；
- `linkable`：还未关联的已生成发布包候选；
- 每条已发布作品上的 `link` 和 `strategy`：方案标题、钩子、目标、发布包标题。

## 数据建议

`buildReviewsInsightPrompt()` 会把已关联的方案标题、钩子和目标加入分析上下文，并要求模型基于关联信息比较内容效果，而不是只按作品标题猜测。

## 桌面端

“我的数据”页新增：

- 每条已发布作品显示“未关联 / 已关联”；
- 选择已完成的发布包并确认关联；
- 随时取消关联；
- 显示当前关联的方案标题和钩子；
- 关联或取消后清空旧数据建议，避免继续展示过期结论。

## 验证

已通过：

```text
API: 43/43
Desktop UX: publishedLink.linked=true, publishedLink.unlinked=true
```

API 回归覆盖：

- 未关联时返回 1 个可关联发布包；
- 关联后 `counts.linked=1`，候选列表清空；
- 复盘条目返回方案标题、钩子与目标；
- 取消关联成功。

桌面 UX 回归覆盖：

- 打开关联选择器；
- 选择发布包并确认；
- 显示已关联方案；
- 取消关联并恢复未关联状态；
- 1100×720 无横向溢出。

## 部署注意

生产 MySQL 需要先执行迁移 48，再部署对应 API；否则关联接口会因表不存在而失败。当前改动尚未提交或部署。
