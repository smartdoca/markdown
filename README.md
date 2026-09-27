# exmd-collaborative-editor

基于 React、CodeMirror 6 和 Yjs 的 Markdown 编辑器，面向 Doca 的宿主托管协同场景。

## 使用

```tsx
import { CollaborativeMarkdownEditor } from 'exmd-collaborative-editor'
import 'exmd-collaborative-editor/style.css'

export function MarkdownDocument({ session, canEdit }) {
  return (
    <CollaborativeMarkdownEditor
      collaboration={session}
      mode={canEdit ? 'edit' : 'readonly'}
    />
  )
}
```

`mode` 是唯一权限入口。宿主可用 `components` 替换 UI 区域，用 `selectionActions` 和 `toolbarActions` 增加业务动作，用 `messages` 覆盖稳定国际化键。

## 协同边界

宿主创建并拥有 `CollaborationSession`、Y.Doc、Awareness、连接、认证、ACK、outbox、checkpoint 和重连。编辑器不会在宿主模式下创建额外的 Y.Doc、WebSocket 或 IndexedDB。

Markdown 正文固定存放在 `Y.Text("markdown")`。远端 update 不进入本地 update 回调；只读会话不发布本地正文、光标或选区。评论锚点使用 Yjs relative position，正文和 ACL 仍由 Doca 保存。

资源上传与短期 URL 解析由 `resources` 注入。模型只保存稳定资源标识，不保存 Cookie、签名 URL 或部署域名。

## 文件交换

Markdown 导入导出严格使用 UTF-8，不主动下载、不访问网络、不修改当前协作文档。PDF 导入只提取可验证的文本内容；文件交换结果由宿主决定是否创建新文档。

## 开发

```bash
yarn typecheck
yarn build:lib
yarn test:contract
yarn test:files
yarn test:i18n
```
