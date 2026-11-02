# 数字人失败分段重试验收

日期：2026-11-02

## 目标

验证数字人分段合成在单段失败后：

- 已成功分段不被覆盖
- 复用有效底片
- 只重新执行失败或未完成分段
- 第二次重试成功后全部进入 `done`

## 方式

本次使用可注入执行器做确定性故障注入，不调用付费 Provider：

```text
seg1: done
seg2: 第一次执行注入 upstream timeout
seg3: pending
```

第一次重试选择分段 `2, 3`，实际执行顺序也是 `2, 3`。

结果：

```text
seg2: failed
seg3: done
remaining: [2]
```

第二次重试只选择分段 `2`，确认调用记录为：

```text
[2]
```

最终：

```text
seg1: done，原音视频资产键保持不变
seg2: done，使用新的重试资产键
seg3: done，原音视频资产键保持不变
remaining: []
```

## 覆盖断言

- 底片不可复用时，所有分段重置并整单重跑
- 底片可复用时，只选择未完成分段
- 显式分段选择与未完成状态求交集
- 注入第 2 段失败不影响第 1、3 段
- 成功分段保留 `audioStorageKey` / `videoStorageKey`
- 失败分段写入错误，下一次只重跑该段
- 每段落库状态按 `running → terminal` 更新

## 代码

```text
apps/api/src/services/avatarSegments.js
apps/api/src/routes/junshiWorkbench.js
apps/api/test/avatar-segments.test.mjs
```

API 测试结果：

```text
21/21 passed
```

## 结论

数字人失败分段重试状态机已通过确定性故障注入验证。
## 生产部署

- release：`/srv/junshi-platform/releases/20261102T035410Z`
- `junshi-api`：active，NRestarts=0
- 本地 health / ready：通过
- 公网 `/api/junshi/health` / `/api/health`：通过
