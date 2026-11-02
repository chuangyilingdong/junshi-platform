# 旧 `/junshi` 浏览器交互回归

日期：2026-11-02

## 方式

使用测试机构临时会话写入 localStorage，通过本地 Google Chrome + Playwright 打开真实生产页面：

```text
https://aicyld.com/junshi/index.html
```

未使用账号密码，测试后删除临时 session。

## 结果

页面：

- 标题：`招生军师 · 专家团 · 灵动ai学院`
- 机构：`示例创新学校`
- 未出现登录页
- 无页面 JavaScript 错误
- 无控制台 error

点击“内容工作台”后：

- 工作台正常渲染
- 账号、任务、素材、视频、数字人、文案、转写等面板可读
- 触发 20+ 个 `/api/junshi/workbench/*` 请求
- 全部返回 200

关键接口：

```text
/api/junshi/experts
/api/junshi/overview
/api/junshi/conversations
/api/junshi/workbench/bootstrap
/api/junshi/workbench/refs
/api/junshi/workbench/copy
/api/junshi/workbench/chat
/api/junshi/workbench/videos
/api/junshi/workbench/assets
/api/junshi/workbench/jobs
/api/junshi/workbench/memories
/api/junshi/workbench/workflows
/api/junshi/workbench/voices
/api/junshi/workbench/transcripts
/api/junshi/workbench/avatar/runs
/api/junshi/workbench/plans
/api/junshi/workbench/profile
/api/junshi/workbench/brains
/api/junshi/workbench/video/works
/api/junshi/workbench/video/renders
```

## 结论

旧 `/junshi` 网页在切流后仍能正常加载并访问新 API。没有发现布局白屏、鉴权回环或接口 5xx。