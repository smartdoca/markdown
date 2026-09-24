# 0.4.1 · Markdown 原文文件交换交付

## 安装产物

```sh
npm install /Users/zhangsiwen/dev/exmd/exmd-collaborative-editor-0.4.1-231d8941.tgz
```

- SHA-1：`231d89411ed3b83f7cc97bf9ec8648284a23cd73`
- SHA-256：`37d43157c22bb06b81c8489f0ced8fd5a3e415e51c7d9ac4befba556935c05e8`
- 75,218 bytes，53 files；未发布 npm registry。安装包、构建产物和临时消费工程继续由 `.gitignore` 排除。
- 实际安装：`tests/.consumer-041-QOgFed`，Yarn offline 安装上述唯一文件名的 tarball，React/ReactDOM 19.3.0、Yjs 13.6.32，保留 lockfile。上游可选/传递 peer 警告仍存在。
- 安装后 `dist/index.js` 与当前源码构建逐字节一致。安装包内宿主文件示例通过 TypeScript 消费检查；完整生产构建通过，demo 存在既有大 chunk 提示。

## 接口与兼容性

`importMarkdownFile(file, { maxBytes? })` 返回明确的成功/失败判别结果、UTF-8/BOM/换行信息、错误及警告；默认上限 512 KiB。`exportMarkdownFile(handle.getMarkdown(), { fileName? })` 返回 Blob、文件名、MIME 和资源边界警告，不自动下载。

`handle.replaceMarkdown(markdown, { expectedMarkdown? })` 为宿主确认后的单次、可撤销正文替换；相同原文零写入。拒绝只读、未就绪和异步期间原文冲突。不作为初始化/远端同步 API。内置下载按钮移除，旧 `createMarkdownFile/downloadMarkdown/onDownload` 和自定义 Toolbar 回调保留兼容。

codec `markdown-ytext`、schema/protocol 1、Y.Text 根与评论 v2 不变。未改 Doca、其他模块、数据库、ACK、网络或 autosave。包含上次的文末空白点击修复。

## 实测

- 安装包 Node 文件专项 11 项 + 模型合约 11 项 + 真实 60 秒 idle 1 项：23/23 通过，idle 60006.069ms，零内容更新。
- 安装包浏览器文件专项 6 组通过：288,017 字节/9,001 行导入，双页单事务不回声；删除/输入/撤销重做；BOM/CRLF/中文/emoji；只读与延迟导入冲突；导出再导入与 checkpoint 新页面恢复；空/标题/超限/非法编码。
- 真实键盘 `Cmd+A → Backspace → 输入`，编辑区正确显示“全选删除后继续输入😀”。
- 安装包原有浏览器协同/模式切换/光标/评论/上传回归 7 组通过。ESM/CJS 入口均可导入新方法，ESM 原文 Blob 往返通过。
- 安装包真实浏览器持续 60582ms，期间每秒导出原文并变更选区/滚动/尺寸/保存状态：零正文更新，CodeMirror 实例保持不变。

## 调用文档及复跑

- [README](README.md) 中“纯 Markdown 文件交换（0.4.1）”包含全部方法、结果类型、错误码、资源策略和示例。
- [宿主 React 示例](examples/DocaMarkdownFiles.tsx) 注入已有 session，并将替换确认、错误提示及下载交给 Doca。
- [专项验收与复跑说明](docs/ACCEPTANCE-0.4.1.md)。浏览器入口 `/tests/browser/index.html` 使用 `EXMD_TEST_PACKAGE_DIR` 指向安装产物运行。

## 限制

仅 UTF-8 Markdown；不转换 Word/JSON/其他编码，不打包离线资源，不扫描/验证资产或链接。BOM 按文件签名处理；刻意放在正文开头的 U+FEFF 再导入时也视作 BOM。全量导入沿用旧评论删除/orphan 策略。资源 ID/path/内部相对链接原样导出，不保证离开平台可用；如需读取资源，由宿主授权回调处理。

协同测试使用隔离 iframe + 宿主 bytes 转发 + 原始 checkpoint，不等同于 Doca 生产 WebSocket、数据库、outbox 或资产服务验收。
