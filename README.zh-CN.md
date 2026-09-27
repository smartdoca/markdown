# @smartdoca/markdown

[English](README.md)

可嵌入的 React 协同 Markdown 编辑器。支持 GFM、代码、数学公式、Mermaid 和分屏预览。宿主负责身份、文件、权限和持久保存。

许可证为 [AGPL-3.0-only](LICENSE)。

## 安装

```sh
npm install @smartdoca/markdown react react-dom yjs
```

```tsx
import { CollaborativeMarkdownEditor } from "@smartdoca/markdown";
import "@smartdoca/markdown/style.css";

export function Markdown({ markdown }: { markdown: string }) {
  return <CollaborativeMarkdownEditor initialValue={markdown} mode="edit" height="100%" />;
}
```

宿主托管会话时不需要 `roomId` 和 `websocketUrl`。没有 `collaboration` 时，这两项都必填。

## Props

`CollaborativeMarkdownEditor` 接收 `CollaborativeMarkdownEditorProps`。

| Prop | 类型 | 作用 |
|---|---|---|
| `collaboration` | `CollaborationSession` | 稳定的宿主会话。传入后，包不再打开自己的 WebSocket 或 IndexedDB。 |
| `roomId` | `string` | 演示传输的房间。仅在没有 `collaboration` 时必填。 |
| `websocketUrl` | `string` | 演示传输地址。仅在没有 `collaboration` 时必填。 |
| `initialValue` | `string` | 会话开始时的 Markdown。 |
| `user` | `CollaborationUser` | 内建传输使用的显示身份。 |
| `mode` | `EditorMode` | `readonly` 停止编辑。 |
| `resources` | `EditorResources` | 宿主资源回调。会话期间保持对象引用不变。 |
| `uploadImage` | `(file) => Promise<string>` | 图片上传。默认转为 data URL。 |
| `onChange` | `(markdown) => void` | 本地 Markdown 文本。 |
| `onConnectionChange` | `(state) => void` | 连接状态。 |
| `selectionActions` | `MarkdownSelectionAction[]` | 有效选区旁的操作，没有浮层时退回工具栏。 |
| `selectionToolbar` | `boolean` | 浮动操作。默认 `true`。`false` 时操作留在顶部工具栏。 |
| `toolbarActions` | `MarkdownSelectionAction[]` | 始终显示在顶部工具栏的操作。 |
| `components` | `CollaborativeMarkdownEditorComponents` | 替换页眉、加载或页脚，不替换 Yjs 生命周期。 |
| `defaultViewMode` | `ViewMode` | 初始的编辑、预览或分屏。 |
| `syncScroll` | `boolean` | 预览跟随编辑器滚动。默认 `true`。 |
| `previewDebounceMs` | `number` | 预览防抖。大文档自动为 150ms，否则为 0。 |
| `locale` | `string` | `zh` 或 `en`。省略为中文。未知代码显示英文。切换只更新界面。 |
| `messages` | `EditorMessages` | 替换单个文案。 |
| `title`、`className`、`height` | | 界面和布局。`height` 默认 `100vh`。 |
| `persistence`、`persistenceKey` | | 演示传输的 IndexedDB。宿主会话不要开启。 |

## 协同

把宿主的 `collaboration` 会话交给编辑器，并在文档存活期间保持这个对象。

- 本地文本从会话中观察。远端更新应用到同一个 `Y.Doc`。不要把远端文本再写成一次保存。
- `mode="readonly"` 不发布编辑。
- 选区操作和评论范围使用 `resolveMarkdownTextAnchor`。锚点是文本位置，不是屏幕坐标。
- `locale` 和 `messages` 只改变界面文案。

包根路径还导出 `MarkdownPreview`、`importMarkdownFile`、`exportMarkdownFile`、`importPdfFile` 和 `exportPdfFile`。
