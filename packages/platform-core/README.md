# @junshi/platform-core

招生军师 API 的最小平台适配层。

计划承接：

- MySQL 连接与 `junshi_*` 事务边界
- 机构登录、Cookie/Token 与角色校验适配
- 上传、OSS 和对象删除
- AI Provider 选择、密钥注入和错误归一化
- 计费/权益策略适配

不在此包复制网站平台完整服务；所有能力必须通过显式接口暴露。