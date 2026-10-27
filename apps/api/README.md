# Junshi API

本目录承接原网站仓库中的 `/api/junshi/*` 服务和抖音 Worker。

## 已迁入

- `src/routes/junshi.js`
- `src/routes/junshiWorkbench.js`
- `src/services/junshi*.js` 共 9 个模块\n- `src/services/complianceEngine.js`（本地合规规则引擎）
- `src/douyin/*.py` 共 5 个 Worker
- `data/junshi/*.json` 共 5 份静态资料

## 尚未完成

原路由仍依赖网站平台的数据库、鉴权、Provider、上传/OSS、计费和合规能力。当前不能直接启动，后续通过 `packages/platform-core` 或明确适配器补齐，不能反向引用旧网站仓库。

首个可运行目标：

1. 建立独立 HTTP 入口和 `/api/junshi/*` 路由分发；
2. 以 mock 鉴权、mock Provider、临时目录存储跑通最小请求；
3. 接入共享 MySQL、机构登录、OSS 和 Provider；
4. 完成真实机构最小验收后再讨论切流。