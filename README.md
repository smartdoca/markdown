# @smartdoca/markdown

[中文](README.zh-CN.md)

Embeddable collaborative Markdown editor for React. It renders GFM, code, math, Mermaid, and a split preview. The host owns identity, files, permissions, and the durable save path.

Licensed under [AGPL-3.0-only](LICENSE).

## Install

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

A host-managed session replaces `roomId` and `websocketUrl`. Without `collaboration`, both `roomId` and `websocketUrl` are required.

## Props

`CollaborativeMarkdownEditor` accepts `CollaborativeMarkdownEditorProps`.

| Prop | Type | Role |
|---|---|---|
| `collaboration` | `CollaborationSession` | Stable host session. When set, the package does not open its own WebSocket or IndexedDB transport. |
| `roomId` | `string` | Demo transport room. Required only without `collaboration`. |
| `websocketUrl` | `string` | Demo transport URL. Required only without `collaboration`. |
| `initialValue` | `string` | Markdown used when the session starts. |
| `user` | `CollaborationUser` | Display identity for the built-in transport. |
| `mode` | `EditorMode` | `readonly` stops editing. |
| `resources` | `EditorResources` | Host asset callbacks. Keep the object reference stable for the session. |
| `uploadImage` | `(file) => Promise<string>` | Image upload. Defaults to a data URL. |
| `onChange` | `(markdown) => void` | Local markdown text. |
| `onConnectionChange` | `(state) => void` | Connection state. |
| `selectionActions` | `MarkdownSelectionAction[]` | Actions near a valid selection, or in the toolbar as fallback. |
| `selectionToolbar` | `boolean` | Floating actions. Defaults to `true`. `false` keeps actions in the top toolbar. |
| `toolbarActions` | `MarkdownSelectionAction[]` | Actions always shown in the top toolbar. |
| `components` | `CollaborativeMarkdownEditorComponents` | Replaces header, loading, or footer without replacing the Yjs lifecycle. |
| `defaultViewMode` | `ViewMode` | Initial editor, preview, or split view. |
| `syncScroll` | `boolean` | Scrolls the preview with the editor. Defaults to `true`. |
| `previewDebounceMs` | `number` | Preview debounce. Automatic timing is 150ms for large documents, otherwise 0. |
| `locale` | `string` | `zh` or `en`. Omitted stays Chinese. Unknown codes show English. Switching updates chrome only. |
| `messages` | `EditorMessages` | Replaces individual catalog entries. |
| `title`, `className`, `height` | | Chrome and layout. `height` defaults to `100vh`. |
| `persistence`, `persistenceKey` | | Built-in IndexedDB for the demo transport. Leave them off for a host session. |

## Collaboration

Give the host `collaboration` session to the editor and keep that object for the life of the document.

- Local text updates are observed from the session. Remote updates are applied to the same `Y.Doc`. Do not echo remote text into a second save request.
- `mode="readonly"` does not publish edits.
- Selection actions and comment ranges use `resolveMarkdownTextAnchor`. Anchors are text positions, not screen coordinates.
- `locale` and `messages` change interface copy only.

Other entry points on the package root include `MarkdownPreview`, `importMarkdownFile`, `exportMarkdownFile`, `importPdfFile`, and `exportPdfFile`.
