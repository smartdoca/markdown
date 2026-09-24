# 0.4.1 · 纯 Markdown 文件交换

## 变更

- 新增独立 `importMarkdownFile` / `exportMarkdownFile` 及完整结果/错误/警告类型。
- 严格 UTF-8、文件签名 BOM、字节上限和 NUL 校验；不猜编码、不替换损坏字符；保留 CRLF、中文和 emoji。
- 导出复用 `createMarkdownFile`；返回 Blob、文件名、MIME，不读取预览 HTML、不触发下载。旧文件生成接口也拒绝孤立代理字符。
- 新增 `handle.replaceMarkdown`，显式、单事务、可撤销的全量替换；支持 `expectedMarkdown` 冲突保护。相同源文零事务，不用它做服务器初始化或远端同步。
- 移除内置工具栏下载按钮，旧自定义 Toolbar 回调继续兼容。
- 包含此前文末空白点击聚焦修复；README 与 `examples/DocaMarkdownFiles.tsx` 说明宿主确认/下载/权限边界。

不改 codec/schema/protocol，不创建新网络或 autosave。图片、附件与内部链接原样保留；每次交换返回固定资源边界警告，不代表扫描/验证了资源。资源下载仍需宿主授权。只读允许导出，不允许应用导入。

## 可复跑测试

```sh
yarn test:files
yarn test:contract
yarn test:browser
```

浏览器入口依次点击“运行 Markdown 文件交换验收”“运行回归”“运行文末空白点击验收”“运行 60 秒静置”。文件专项源构建已通过 6 组：

1. 288,017 字节、9,001 行大文档，原文/CRLF 保留，一次本地更新，双页收敛不回声，实例不变。
2. 全选删除、继续输入、撤销重做和远端同步。
3. UTF-8 BOM、中文、emoji、混合换行及整次导入撤销重做。
4. 只读导入拒绝/导出允许；解码/确认期间远端编辑导致过期替换拒绝。
5. 导出再导入、原文相同零写入；原始 checkpoint 重建页面后的源文一致；没有内置下载按钮。
6. 空文件、标题文件、超限/损坏编码/不支持格式及失败不写模型。

Node 文件专项 11 项及模型合约 11 项已通过。包含约 900 KB 文件按配置放大上限、截断/非法 UTF-8、UTF-16、NUL、读取失败、按字节限制、BOM、U+FEFF、孤立代理、资源原文和零抓取/零下载调用。安装产物、浏览器最终复验及静置实测记录见仓库根 `DELIVERY-0.4.1.md`。

## 明确限制

仅支持 UTF-8 的 `.md/.markdown`，不是 Word/JSON/HTML 转换、离线资源包或流式导入。格式错误的 Markdown 原文仍合法。BOM 作为文件签名从导入内容移除，不保证保留文件字节级 BOM；CRLF 不改写。全量替换不迁移旧评论锚点，沿用删除/orphan 策略。默认 512 KiB 上限可由宿主显式调整；没有宣称任意规模文档的性能。

浏览器用隔离 iframe、宿主原始 bytes 转发和 checkpoint 恢复，不代表 Doca 生产 WebSocket、数据库、持久 outbox 或资产服务端到端验收。包不实现资产下载路径，因此没有新增资产授权绕过，也不宣称验收了宿主下载授权。
