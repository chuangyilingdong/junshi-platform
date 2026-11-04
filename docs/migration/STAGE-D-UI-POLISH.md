# 桌面端 UI 收口 · 2026-11-03

## 目标

在不改变业务逻辑的前提下，降低长页面操作成本、减少遮挡，并补齐基础键盘与动效适配。

## 本轮调整

### 制作页操作栏吸底

- 内容方案、编导稿、渲染、发布包和发布页的主操作栏改为吸底。
- 长文案或合规详情不会再把主按钮推到首屏之外。
- 保留页面原滚动能力，按钮始终可见。

### 合规体检折叠

- 默认只显示体检结论和待核对数量。
- 规则说明、命中项和修改建议收起。
- 有命中项或错误时自动展开。
- 通过时保持折叠，减少对定稿和制作操作的挤压。

### Toast 位置

- 从右下角移到顶部居中、顶栏下方。
- 不再遮挡底部提交、保存和发布按钮。
- Toast 增加 `role=status` 与 `aria-live`。

### 键盘与焦点

- 同行采集教程弹窗打开后自动聚焦主按钮。
- Tab / Shift+Tab 在弹窗内循环。
- Escape 可关闭弹窗。
- 关闭后焦点返回原来的“教程”按钮。

### 可读性与动效

- 提高制作字段说明、工作流标签、任务中心、素材库和文案大脑中偏小字号。
- 文案大脑的英文 profile key 改为中文标签。
- 增加 `prefers-reduced-motion` 适配，关闭加载动画和过渡。
- 增加按钮键盘焦点轮廓。

## 验证

```text
Desktop: 5/5
uiPolish.complianceDetailsOpen=false
uiPolish.productionFooterPosition=sticky
uiPolish.footerBottomGap=0
uiPolish.reportRowSingleLine=true
uiPolish.modalFocusOpen=true
uiPolish.modalFocusClosed=true
1100×720 无横向溢出
```

已重新截图检查：首页/做内容、工作流、制作方式、定稿、发布包、文案大脑。

## 边界

- 本轮不调整业务流程、接口或数据库。
- 当前改动只在本地工作区，尚未提交或部署。
