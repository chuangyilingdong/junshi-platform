# 阶段 D：独立部署与无感切流

日期：2026-10-27

## 当前生产基线

- 网站服务：`learning-platform-production`
- 网站端口：`127.0.0.1:8789`
- Nginx 站点：`/etc/nginx/sites-available/aicyld.com`
- 域名：`aicyld.com`
- 生产 MySQL：验证通过
- Junshi 目标端口：`127.0.0.1:8790`

## 新进程

模板：`deploy/systemd/junshi-api.service`

```text
/srv/junshi-platform/current/apps/api/src/index.js
```

环境：

```text
/etc/ai-kids-platform/production.env
/etc/junshi-platform/production.env
```

第二个文件只放 Junshi 非秘密覆盖项，不复制 MySQL 密码。

## Nginx 分流

模板：`deploy/nginx/junshi-api-location.conf`

```text
/api/auth/*    -> 原网站 8789
/api/junshi/*  -> Junshi API 8790
```

include 必须放在通用 `location /api/` 之前。

## 灰度顺序

1. 部署新代码，但不改 Nginx
2. 启动 `junshi-api`
3. 本机验证 `8790/health` 和 `8790/ready`
4. 同时验证 8790 上的 `/api/junshi/overview`
5. 安装 Nginx include，执行 `nginx -t`
6. reload Nginx
7. 从外部验证 `/api/auth/*` 与 `/api/junshi/*`
8. 观察错误率和 SSE 超时
9. 验收通过后再冻结旧 `/junshi`

## 回滚

- 删除 Nginx include
- `nginx -t`
- reload Nginx
- 可选停止 `junshi-api`
- 数据库第一阶段共享，不做破坏性变更

## 禁止项

- 不在同一次操作中删除旧 Junshi 代码
- 不直接修改生产环境文件
- 不使用错误 remote `aicyld-prod`
- 不自动发布客户端