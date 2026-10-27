# @junshi/platform-core

招生军师 API 的最小平台适配层。

## 当前已实现

- HTTP 上下文、JSON 响应、CORS、ApiError
- 进程内 mock 数据库：`aq` / `arow` / `arows`
- 独立 API 运行配置
- 后续真实适配的稳定落点

## 后续待实现

- MySQL 连接与 `junshi_*` 事务边界
- 机构登录、Cookie/Token 与角色校验
- 上传、OSS 和对象删除
- 真实 AI Provider、密钥注入和错误归一化
- 计费/权益策略

不在此包复制网站平台完整服务；所有能力必须通过显式接口暴露。