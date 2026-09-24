# Doca Markdown 0.3.0 交付清单

## 安装产物

- 文件：`exmd-collaborative-editor-0.3.0-3bd2e866.tgz`
- 包名/版本：`exmd-collaborative-editor@0.3.0`
- SHA-1：`3bd2e866f92ec92360df6ac67e454f6710553334`
- SHA-256：`c205c21707041a6dff964a8dc2123d1bfa52e95adc10525ee262a42b29b3d76c`
- 50,865 bytes，39 个文件；含 ESM、CJS、声明、样式、README、变更清单和验收记录。未发布 npm registry。

```sh
npm install /Users/zhangsiwen/dev/exmd/exmd-collaborative-editor-0.3.0-3bd2e866.tgz
```

在 Doca 工程执行安装命令。本轮没有修改 Doca 依赖或解除其预览防护，没有触碰 slatetsx、Excel、画板和数据库。

## 实际压缩包复验

不是只测试源码：解压上述包后，Node 测试和浏览器夹具均加载解压目录的 dist。使用现有工程依赖完成验证；未在 Doca 执行安装或新建全空依赖环境联网安装。

- 11 项 contract + 1 项实际 60 秒 idle：12/12 通过。Node idle 60005.865ms，正文更新 0。
- 浏览器 7 组：全部通过；空/已有文档预览循环、初始预览与 ready/error、并发原样重放、公开光标、区域评论、延迟上传。
- 浏览器真实 60130ms：正文 update 与 onChange 均为 0；选择、滚动、尺寸、保存状态变化不重建 EditorView/handle。
- 解压包导出类型消费检查通过；ESM、CJS 分别在独立 Node v24.15.0 进程成功创建使用同一个注入 Y.Doc/Y.Text 的会话。
- 不要在同一运行时混用两种模块格式的 Yjs；探索性混用会触发 Yjs 重复导入警告。Doca 应沿用单一 ESM 入口并去重 React/Yjs/CodeMirror。
- 类型检查和生产构建通过；demo 仍有大 chunk 告警。

完整场景与限制见 [验收记录](docs/ACCEPTANCE-0.3.0.md)，变更见 [CHANGELOG](docs/CHANGELOG-0.3.0.md)，调用见 [README](README.md)。

## 公开接口

生命周期和保存边界：`createHostMarkdownSession`、`updateHostMarkdownSession`、`observeLocalMarkdownUpdates`、`applyRemoteMarkdownUpdate`。会话包装宿主 `doc.getText('markdown')`，状态快照不重建模型。

光标：`onSelectionChange`、`renderRemoteSelections`、`clearRemoteSelections`，类型 `MarkdownTextSelection` / `RemoteMarkdownSelection`。渲染输入为完整快照；null、离开、只读/失焦需要宿主按文档会话转发。

评论：`captureAnchor`、`resolveAnchor`、`revealAnchor`、`renderAnchors`、`setActiveAnchor`、`clearAnchors`、`onAnchorClick`，类型 `MarkdownTextAnchor` / `MarkdownCommentAnchor`。卡片与区域双向定位无需 Doca 操作 CodeMirror 内部。

## 复跑与示例

```sh
yarn test:browser
```

访问 `http://127.0.0.1:5198/tests/browser/index.html`。点击“运行回归”“运行 60 秒静置”或“查看光标与区域评论”。第三个入口允许直接点击评论下划线，观察激活与宿主回调。`/?host=1` 是不启动包内 WebSocket 的宿主管理编辑示例。

压缩包模式复跑可设置 `EXMD_TEST_PACKAGE_DIR` 为解压后 package 绝对目录，启动同一个 Vite 服务；Node 测试使用 `EXMD_TEST_PACKAGE_ENTRY` 指向其 dist/index.js。

## 兼容性结论与平台复验要求

正文 `markdown-ytext / schema 1 / protocol 1`、根 `markdown/exmd:meta` 不变，不需要迁移正文或切 epoch。新评论锚点 kind 为 v2，平台需放行并保存 content 身份区间。两端插入不扩大区域；全部原始文字删除后持续 orphan，撤销恢复文字不自动重绑。

源码区域评论装饰已实现；MarkdownPreview 区域映射、重叠评论选择菜单、孤儿自动重绑、完整卡片 UI、原子上传占位和附件下载按钮未实现。现有全局 CSS 隔离防护继续保留。

双页面测试使用隔离 iframe 和宿主转发夹具，不是实际平台双标签页/WebSocket/数据库。Doca 必须复验真实连接、ACK、持久 outbox、权限、关闭重开和资源鉴权，再放开纯预览。本次不宣称 Doca 的 103 项平台用例或完整 SDK 验收已重新通过。
