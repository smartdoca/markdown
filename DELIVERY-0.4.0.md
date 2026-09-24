# Markdown 预览精确评论 · 0.4.0 交付

## 安装

```sh
npm install /Users/zhangsiwen/dev/exmd/exmd-collaborative-editor-0.4.0-02a40d05.tgz
```

- 文件：`exmd-collaborative-editor-0.4.0-02a40d05.tgz`
- SHA-1：`02a40d053720408925576f960cf9ad5d4da7ab5d`
- SHA-256：`45bfff33b87e6fbb135304d881eb689d0baaa3b88418288bf34c16a9ffb169ce`
- 66,536 bytes，47 个文件，包含 ESM/CJS、声明、样式、README、验收报告和可复制的宿主示例。
- 未发布 npm registry；旧 `0.3.0-3bd2e866` 包保留。没有修改 Doca 的安装包或数据库。

## 实现与接入

逐字符映射基于 micromark token/AST 源偏移，覆盖普通文字、嵌套格式、链接、换行、重复文本及常规列表/表格等，不全文搜索猜位置。`captureAnchor()` 读取活动视图，预览无有效选区返回 null。原有评论 API 在两侧共享，纯预览 reveal 不强制切源码；重叠评论点击轮流激活。

新增 `selectionActions`、`selectionToolbar`、`toolbarActions`，动作类型 `MarkdownSelectionAction` 含 id/icon/title/disabled/requiresSelection/onClick。`onClick` 收到 `{ view, anchor }`；正文只读不禁用宿主评论权限。Doca 顶部入口使用 `selectionToolbar={false}`。自定义 Toolbar 渲染 `props.hostActions`，自定义 Preview 透传 `props.interaction`。

正文 codec/schema/protocol、根 `markdown/exmd:meta` 与 v2 评论锚点不变，不需要迁移。CRLF 原文也不在挂载时自动改写。没有新增网络或保存通道。

## 实际产物验证

- 在隔离消费工程 `tests/.consumer-040-Kke1Gw` 用 Yarn 离线安装 tarball 和 React/ReactDOM/Yjs 成功；不是只解压源码测试。保留安装 lockfile。Yarn Classic 有上游可选/传递 peer 警告，运行验证正常。
- 安装产物 dist 与源码构建 dist 逐字节一致。
- 安装包的 11 项 contract + 1 项 60 秒 idle：12/12 通过；Node 实际等待 60004.833ms，0 内容更新。
- 安装包浏览器原有回归 7 组通过；新增预览精确评论 7 组通过。
- 安装包真实浏览器静置 60155ms：交替源码/预览选区、更新状态、滚动与尺寸变化，0 正文更新，CodeMirror 实例保持不变。
- 安装包内 `examples/DocaComments.tsx` 的 TypeScript 消费检查通过；ESM/CJS 分别在独立 Node 进程导入成功。Node 提示实验性 localStorage 不可用，不是写入或连接。
- 生产构建和类型检查通过；demo 仍有大 chunk 提示。
- 真实鼠标操作：源码与预览选中 Bravo 并点击宿主动作，都得到范围 8..13、源文 Bravo，点击保留选区。

## 文档与可运行示例

- [README](README.md)：精确映射、活动视图、动作插槽与限制。
- [详细验收](docs/ACCEPTANCE-0.4.0.md)：场景与复跑步骤。
- [宿主示例](examples/DocaComments.tsx)：注入已有 session，可复制到 React 项目；示例评论存宿主内存。
- `/tests/browser/index.html`：浏览器回归与原生鼠标操作入口。
- `/?host=1`：源码工程内完整宿主管理示例，支持两侧选区、顶部评论动作和卡片联动。

## 边界

生成公式、Mermaid/SVG、图片本体、代码块高亮结果及无法严格映射的 HTML 块，预览捕获返回 null；可评论源码。跨格式选择是连续源码范围，包含两端之间的 Markdown 语法。整段删除后的 orphan 策略不变，撤销不自动重绑。

没有重叠列表弹窗（采用轮流点击），未验收旋转/倾斜变换、海量锚点、移动端/多浏览器专项。Doca 的全量 CSS 祖先隔离如需悬浮工具栏，应保留 body portal 的对应样式；顶部模式不需要悬浮样式。

浏览器协同验证使用隔离 iframe 与宿主 bytes 转发，不等同于真实 Doca WebSocket/数据库端到端验收。权限、评论正文/持久化、卡片、ACK 和通知仍由 Doca 负责。
