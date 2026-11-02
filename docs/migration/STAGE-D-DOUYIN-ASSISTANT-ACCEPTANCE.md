# 抖音采集助手 API 验收

日期：2026-11-02

## 覆盖

- 机构会话生成一次性配对码
- 配对码换长期 assistant token
- assistant token 上报自己主页作品元数据
- 作品幂等写入 `junshi_workbench_published_works`
- 配对撤销与测试数据清理

## 结果

```json
{
  "pairing": true,
  "pair": true,
  "ingestStatus": 200,
  "accepted": 1,
  "created": 1
}
```

清理结果：

```json
{
  "pairings": 0,
  "publishedWorks": 0,
  "sessions": 0
}
```

## 边界

本次不上传抖音 Cookie、密码或浏览器登录态，也不触发真实视频下载。

## 尚未覆盖

- 真实抖音主页登录与浏览器 CDP 捕获
- 抖音视频下载后自动 ASR
- 同行同步队列真实抓取