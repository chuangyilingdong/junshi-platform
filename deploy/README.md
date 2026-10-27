# Deploy

第一阶段采用独立 `junshi-api` 进程和 Nginx 路径分流。

- `/api/auth/*` 继续由原网站服务承载
- `/api/junshi/*` 切到新 API
- 客户端仍访问 `https://aicyld.com`
- 切换前保留旧 upstream、配置副本和回滚步骤

当前目录只有迁移文件，不包含生产密钥或可直接上线的配置。