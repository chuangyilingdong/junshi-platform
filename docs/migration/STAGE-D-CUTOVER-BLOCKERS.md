# Nginx 切流阻断项

日期：2026-10-27

## 当前结论

暂不切 `/api/junshi/*`。

独立 API 已部署，数据库、鉴权、真实 Provider 和 OSS 均已通过检查；当前唯一阻断是计费/权益适配。直接切流会跳过现有计费策略。

## 已清除

- 共享 MySQL 只读验收
- 原平台会话鉴权
- 共享 Provider 策略读取：`platform_settings.id=1.ai_provider_policy`
- 共享 Provider 密钥文件读取
- 阿里云 OSS 适配
- `/cutover-ready` 阻断检查

## 仍阻断

1. 真实 Provider 已完成 OpenAI-compatible 适配，极小文本调用已通过
   - 生产 TEXT 渠道：`api.deepseek.com`
   - 生产 VIDEO/IMAGE/MUSIC 渠道：`api.seedance.nz`
   - 当前 `getGenerationProvider()` 对 `custom` 明确抛错，不再静默使用 mock
2. 计费/权益仍为最小策略，`BILLING_ADAPTER_NOT_IMPLEMENTED` 仍阻止切流
3. 视频、数字人、ASR 和 OSS 上传/下载全链路尚未在新 API 私有端口验收
4. `FILE_STORAGE=oss` 尚未在独立进程环境打开并做真实上传/下载验证

## 操作门禁

```text
GET http://127.0.0.1:8790/cutover-ready
```

返回：

- `200`：允许进入切流评审
- `409`：仍有阻断项，禁止 reload Nginx

只有该接口返回 `200`，且真实机构最小验收通过后，才考虑 Nginx 灰度切流。