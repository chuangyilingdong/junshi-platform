# Release

第一阶段不自动发布。

上线顺序：

1. 构建并检查仓库
2. 部署到 `/srv/junshi-platform/current`
3. 安装 systemd unit
4. 启动 `junshi-api`，验证 `127.0.0.1:8790/health`
5. 安装 Nginx include，先 `nginx -t`
6. 灰度 reload
7. 验证 `/api/auth/*` 仍由原服务处理
8. 验证 `/api/junshi/*` 返回新 API 响应
9. 保留回滚配置和旧 upstream

生产密钥只能存在于服务器环境文件，不得写入 release 包。