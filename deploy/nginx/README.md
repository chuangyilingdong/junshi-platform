# Nginx 分流

目标路由：

```text
/api/auth/*    -> 原网站服务 127.0.0.1:8789
/api/junshi/*  -> 独立 Junshi API 127.0.0.1:8790
```

安装方式：

1. 将 `junshi-api-location.conf` 安装到 `/etc/nginx/snippets/junshi-api-location.conf`
2. 在 `aicyld.com` 的 TLS `server` 块中，放在通用 `location /api/` 之前：
   `include /etc/nginx/snippets/junshi-api-location.conf;`
3. 执行 `nginx -t`
4. 先灰度验证，再 reload

回滚：

- 删除 include
- `nginx -t`
- reload Nginx
- 原 `/api/` 会重新指向 `127.0.0.1:8789`