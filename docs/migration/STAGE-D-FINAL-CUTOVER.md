# 阶段 D Nginx 灰度切流记录

日期：2026-10-27

## 最终状态

- `junshi-api`：active，`NRestarts=0`
- 独立 API 端口：`127.0.0.1:8790`
- Nginx：active
- 原网站服务 `learning-platform-production`：active
- 当前 release：`/srv/junshi-platform/releases/20261027T081154Z`
- Nginx 配置备份：`/etc/nginx/sites-available/aicyld.com.bak-junshi-cutover-20261027T081224Z`

## 切流门禁

切流前内部检查：

```text
GET http://127.0.0.1:8790/cutover-ready
200 ready
```

结果：

- Provider：ready
- OSS：ready，`backend=oss`
- Billing：ready，`OBSERVATION_ONLY`，`charged=false`
- 4 个 Provider 渠道全部有 Key 和适配器
- 阻断项：0

## Nginx 变更

- 安装 `/etc/nginx/snippets/junshi-api-location.conf`
- 在 `aicyld.com` TLS server 块中、通用 `/api/` 之前加入 include
- `/api/junshi/*` 精确分流到 `127.0.0.1:8790`
- 公网隐藏内部 `/api/junshi/cutover-ready`，返回 404
- `nginx -t` 通过后 reload

## 外部验收

```text
https://aicyld.com/api/health
  -> 200，service=ai-kids-platform

https://aicyld.com/api/junshi/health
  -> 200，service=junshi-api，database=mysql

https://aicyld.com/api/junshi/ready
  -> 200，databaseHealth.ok=true

https://aicyld.com/api/junshi/overview
  -> 200

https://aicyld.com/api/junshi/workbench/bootstrap
  -> 401（未登录，符合预期）

https://aicyld.com/api/junshi/cutover-ready
  -> 404（公网隐藏）
```

## 真实 Provider 账本验收

- 真实文本调用：`custom / deepseek-flash`
- 返回 `OK`
- usage：输入 38，输出 26，总 64 tokens
- `compute_attempts` before/after：11238 → 11239
- `charged=false`
- 测试记录使用专用标识 `org_junshi_cutover_smoke`
- 验收后已删除该测试记录，账本恢复干净

## 回滚

```text
cp -a /etc/nginx/sites-available/aicyld.com.bak-junshi-cutover-20261027T081224Z /etc/nginx/sites-available/aicyld.com
nginx -t
systemctl reload nginx
```

回滚后 `/api/junshi/*` 会重新指向原网站服务 `8789`。独立 API 可保留运行，不影响回滚。

## 未做

- 未删除旧 `/junshi` 网页
- 未修改数据库 schema
- 未迁移客户端更新地址
- 未自动发布客户端