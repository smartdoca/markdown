# Markdown SDK 0.3.0 验收记录 · 2026-09-11

## 范围与结论

本轮在 exmd 包侧修复 Doca 反馈的视图生命周期、公开普通光标、源码区域评论缺口。没有操作 Doca 文档、数据库、平台安装包或其他编辑器。

包侧构建与隔离浏览器通过，不等于 Doca 完整 SDK 验收通过。Doca 应安装新 tarball 后，在隔离文档复验，再解除纯预览临时限制。尤其不能以本报告替代平台 ACK/权限/断网持久恢复测试。

## 实测结果

| 验证 | 结果与范围 |
| --- | --- |
| 库与 demo 类型检查、生产构建 | 通过；demo 仍有大体积 chunk 提示，并非错误 |
| 构建产物 contract | 11 项通过，包括根/版本、初始化零写入、本地更新筛选、无回声、并发、原样重放、undo、v2 边界、删除/orphan、checkpoint、非法锚点 |
| 浏览器生命周期 | 空文档与已有文档各 4 次预览/编辑/分栏循环通过；首次预览、ready/error、保存状态和只读变化不换 EditorView/handle |
| 浏览器模型一致性 | getMarkdown、CodeMirror、两个 Y.Text 相等；预览期间远端输入正常；本地输入、原生 historyUndo、redo、replaceAll 与撤销正常 |
| 浏览器公开选区 | 折叠光标、可见姓名、同账号不同 session 颜色、跨行区域、文本变化后移动、失焦 null、只读/空快照清除通过 |
| 浏览器评论 | 下划线、激活背景、点击回调、卡片 reveal、取消激活、resolved/deleted/orphan 隐藏通过 |
| 浏览器上传 | 预览期间完成上传、同时远端编辑、保存稳定 path、只读触发 AbortSignal、迟到结果丢弃通过 |
| 浏览器宿主边界 | 注入模式监测 WebSocket 构造、IndexedDB.open、Storage.setItem 均为 0 |
| 浏览器真实静置 | 等待 60128ms，期间选择/滚动/尺寸/状态变化，正文更新和 onChange 均为 0；EditorView 与 handle 身份未变 |

浏览器回归共 7 个结果分组。使用两个隔离 iframe 页面，各自拥有 React/CodeMirror/Y.Doc，宿主夹具转发原始 Yjs bytes；并发测试先阻断转发再双向重放。**这不是两个顶层浏览器标签页，也不是实际 Doca WebSocket 重连。** 光标和评论使用公开 ref API，没有用 demo awareness 代替验收。

## 复跑入口

```sh
yarn test:contract
yarn test:idle
yarn build
yarn test:browser
```

浏览器地址 `/tests/browser/index.html`，分别点击“运行回归”和“运行 60 秒静置”。“查看光标与区域评论”是可交互的公开 API 示例；实际宿主管理页面为 `/?host=1`。客户端夹具与完整场景位于 `tests/browser/client.jsx` 和 `tests/browser/runner.js`。

要验证压缩包本身，可解压 tarball，将绝对 `package` 目录传入 `EXMD_TEST_PACKAGE_DIR` 后运行上述浏览器服务。Vite 把包名和样式导入映射至解压目录；React、Yjs、CodeMirror 依赖去重。测试代码不直接导入 src。

## 接口与兼容性

- 保留 `createHostMarkdownSession/updateHostMarkdownSession/observeLocalMarkdownUpdates/applyRemoteMarkdownUpdate`；宿主提供的 `doc.getText('markdown')` 是唯一文本模型，不重新复制 Y.Text。
- `onSelectionChange/renderRemoteSelections/clearRemoteSelections` 支持宿主通道的普通光标、姓名和区域。render 是完整快照；宿主过滤自己当前 session，并转发失焦 null/离开消息。
- `captureAnchor/resolveAnchor/revealAnchor` 新创建 v2。新增 `MarkdownCommentAnchor` 和 `renderAnchors/setActiveAnchor/clearAnchors/onAnchorClick`。
- 正文仍是 `markdown-ytext / schema 1 / protocol 1`，根 `markdown` 与 `exmd:meta` 不变；无需迁移正文或切 epoch。评论存储需接受 v2 并保留 content 身份区间。
- v2 排除两端插入、包括内部插入；全部原始字符删除后 orphan，撤销恢复正文不自动重绑。引用相对位置时忽略仅本地存在的 undo redone 映射，保证各端与 checkpoint 一致。

## 尚未支持 / 尚未验证

- MarkdownPreview 区域高亮、完整评论卡片 UI、重叠多评论的选择菜单、孤儿评论自动重新关联、海量评论性能专项测试未实现/未验收。
- 评论正文、身份、ACL、resolved/deleted 状态的存储和通知全部由宿主处理。
- 原子上传占位、协同上传重试、mention/附件卡片、离线图片打包未实现。附件下载按钮未实现；resolveDownloadUrl 是宿主回调约定，不能据此宣称下载授权测试通过。
- Doca 实际双标签页、WebSocket 断开/重连、数据库提交 ACK、持久 outbox、关闭重开、匿名权限、真实资源鉴权须平台复验。本次未重跑用户提供的 103 项平台测试。
- 包内现有全局样式尚未整体作用域化；Doca 必须保留现有 PostCSS `.doca-markdown` 隔离。
- 本轮针对宿主管理模式；独立 y-websocket demo 没有持久化 ACK，不作为 Doca 生产方案。
