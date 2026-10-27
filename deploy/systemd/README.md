# systemd

模板文件：`junshi-api.service`

安装目标：

```text
/etc/systemd/system/junshi-api.service
/etc/junshi-platform/production.env
```

原则：

- 继续使用现有 `ai-kids-prod` 系统用户
- 先加载现有 `/etc/ai-kids-platform/production.env`，共享 MySQL 配置
- Junshi 自己的非秘密配置放在 `/etc/junshi-platform/production.env`
- 不在新仓库复制数据库密码
- 独立端口默认 `8790`
- 安装前需要先部署代码到 `/srv/junshi-platform/current`