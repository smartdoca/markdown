# exmd-collaborative-editor

基于 React、TypeScript、`react-markdown`、CodeMirror 6 与 Yjs 的可复用协同 Markdown 编辑器。支持 GFM、图片上传、Mermaid、数学公式、代码高亮、格式工具栏、双向同步滚动及只读模式。

## 安装

本次交付版本为 0.4.2 本地 tarball，尚未发布到 npm registry。请安装交付目录中带哈希后缀的 `.tgz`，不要假设 registry 已有此版本。下方包名安装命令适用于发布后。

安装包和构建产物不提交到源码仓库；交付记录中的文件名与哈希用于核对对应的历史产物。需要从源码重新打包时，运行 `yarn install --frozen-lockfile`、`yarn build:lib`、`npm pack`。重新生成的包应重新计算哈希，不沿用历史哈希。

```bash
npm install exmd-collaborative-editor yjs
```

```tsx
import 'exmd-collaborative-editor/style.css'
import 'katex/dist/katex.min.css'
```

## 基础调用

```tsx
import { CollaborativeMarkdownEditor } from 'exmd-collaborative-editor'

export function DocumentPage() {
  return <CollaborativeMarkdownEditor
    roomId="document-42"
    websocketUrl="wss://collab.example.com"
    initialValue="# 新文档"
    user={{ name: '小明', color: '#7357d8' }}
    height="100vh"
    syncScroll
    uploadImage={uploadImage}
    onChange={markdown => console.log(markdown)}
    onConnectionChange={state => console.log(state)}
  />
}

async function uploadImage(file: File) {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch('/api/images', { method: 'POST', body })
  if (!response.ok) throw new Error('上传失败')
  return (await response.json()).url as string
}
```

## PDF 交换

PDF 交换以 Markdown 作为中间格式，不读取编辑器 DOM，也不连接 Doca API 或 Yjs：

```ts
import {
  importPdfFile,
  exportPdfFile,
  type PdfExportOptions,
} from 'exmd-collaborative-editor'

const imported = await importPdfFile(file, {
  maxBytes: 25 * 1024 * 1024,
  maxPages: 100,
  signal: abortController.signal,
})

const exported = await exportPdfFile(markdown, {
  fileName: '文档.pdf',
  signal: abortController.signal,
  resolveResource: async ({ path, alt }) => ({
    // 由宿主按当前 ACL 读取资源；转换器不会抓取 Markdown 中的 URL。
    bytes: await assetService.download(path, { alt }),
  }),
})
```

`importPdfFile` 返回 Markdown、嵌入图片 bytes、PDF 元数据和结构化 warning；宿主负责上传图片并将 `resources[].key` 替换为 Doca 资源 ID。外部 URL 不会被抓取，导入只保留 `http(s)`、`mailto` 和锚点链接。扫描 PDF 第一阶段不执行 OCR，复杂多栏/表格按可读文本近似还原并报告 warning。

`exportPdfFile` 返回固定 MIME `application/pdf` 的 Blob。所有 Markdown 图片都必须经过 `resolveResource`；未提供回调或资源读取失败时会输出替代文本并报告 warning。基础文本、标题、段落、列表、GFM 表格、代码块、链接和数学公式的可读降级均已支持。若需要保留中文等非 WinAnsi 字符，请通过可选的 `fontBytes` 提供宿主打包的 TTF/OTF 中文字体；否则会报告 `FONT_FALLBACK` 并对无法编码的字符替换为问号。

PDF 导入/导出不会创建文档、写入协同状态、改变正文、撤销栈、选区或 presence。超大文件、超大图片、页数超限、损坏/密码 PDF、取消和超时会以 `PdfFileError.code` 明确拒绝。

独立模式需要 `roomId` 和 `websocketUrl`；宿主管理模式传入 `collaboration` 后，`websocketUrl` 可省略。库不会读取宿主项目的环境变量。Next.js 等 SSR 项目应在客户端组件中加载编辑器。

编辑区交互：普通左键点击最后一行下方的空白区域，会聚焦编辑器并将光标收拢到文末，不插入换行或修改正文。空文档同样适用；只读模式仍禁止正文编辑。正文选字、右键菜单、工具栏和滚动条保持原有行为。

## Props

### 大文档编辑性能（0.4.2）

源码编辑和 Yjs 增量仍即时处理。默认对达到 10,000 个 UTF-16 单元或 500 行的文档，将昂贵的全文预览合并到最后一次正文变化后 150ms 更新；小文档立即更新。连续输入期间保留上一份完整预览，停止输入后追上最新正文；只编辑模式不调度预览，重新打开预览立即获取当前原文。

可传 `previewDebounceMs={0}` 关闭合并，或指定 0–2000ms 的等待时间（越界截断；非有限数回退自动策略）。这只影响预览，不延迟 `getMarkdown()`、导出、`onChange` 或宿主 outbox。昂贵的宿主 `onChange` 监听仍需自行优化，不能拿预览状态判断保存完成。

预览待更新时显示“预览更新中…”，`aria-busy=true`。旧预览的选区/定位不能用新模型偏移解释，因此待更新时 `captureAnchor()` 返回 null、预览 `revealAnchor()` 返回 false；更新完成后恢复仍存活的相对选区及评论。宿主可等更新完成重试定位，不应强行使用旧偏移。

没有原始 HTML 的文档跳过 HTML 重解析；两条路径都保留 sanitize。模型、协议、评论锚点和编辑器实例不变。尚未实现 Worker/增量 Markdown AST/预览虚拟化；单次全文渲染仍有成本，超大文档、大量图表或海量评论不保证同样性能。可先用仅编辑模式处理此类文档。

### 属性表

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `roomId` | `string` | 独立模式必填 | 协同文档房间 ID |
| `websocketUrl` | `string` | 独立模式必填 | Yjs WebSocket 服务地址 |
| `collaboration` | `CollaborationSession` | - | 宿主注入的稳定协同会话；传入后不创建包内 WebSocket/IndexedDB |
| `initialValue` | `string` | `''` | 仅独立演示模式使用；宿主管理模式始终忽略 |
| `user` | `CollaborationUser` | 随机访客 | 当前用户名称和颜色；生产身份应由服务端覆盖 |
| `uploadImage` | `(file: File) => Promise<string>` | 转 Data URL | 返回写入 Markdown 的图片 URL |
| `persistence` | `boolean` | `true` | 仅独立模式；注入 collaboration 时包内持久化完全关闭 |
| `persistenceKey` | `string` | 根据房间生成 | 自定义 IndexedDB key |
| `defaultViewMode` | `'edit' \| 'split' \| 'preview'` | `'split'` | 初始视图 |
| `syncScroll` | `boolean` | `true` | 分栏时双向同步滚动 |
| `readOnly` | `boolean` | `false` | 禁止编辑且不发布本地光标/选区 |
| `mode` | `'edit' \| 'readonly'` | `'edit'` | 推荐的宿主权限入口，优先级高于兼容属性 `readOnly` |
| `resources` | `EditorResources` | - | 宿主管理的上传和资产 URL 解析回调 |
| `onUploadProgress` | `(percent: number) => void` | - | 上传进度通知 |
| `onDownload` | `(markdown, fileName) => void \| Promise<void>` | 兼容回调 | 仅供自定义 Toolbar 调用；内置工具栏不再显示下载按钮。新宿主使用 `exportMarkdownFile` 接管下载 |
| `title` | `string` | `'协作文档'` | 标题 |
| `height` | `string \| number` | `'100vh'` | 编辑器整体高度 |
| `className` | `string` | `''` | 根节点 class |
| `components` | `CollaborativeMarkdownEditorComponents` | `{}` | 自定义区域组件 |
| `selectionActions` | `MarkdownSelectionAction[]` | `[]` | 宿主选区动作，含图标/title/disabled/onClick |
| `selectionToolbar` | `boolean` | `true` | 有有效选区时悬浮显示动作；false 时固定顶部 |
| `toolbarActions` | `MarkdownSelectionAction[]` | `[]` | 始终出现在顶部的额外宿主动作 |
| `onChange` | `(markdown: string) => void` | - | 本地或远端正文变化时调用 |
| `onConnectionChange` | `(state: ConnectionState) => void` | - | 协同状态变化时调用 |

## 自定义组件

`components` 可替换局部 UI，同时继续复用内置 Yjs 生命周期、图片拖放、编辑命令和滚动逻辑。每个组件的 Props 类型均已导出。

```tsx
import {
  CollaborativeMarkdownEditor,
  MarkdownPreview,
  type EditorHeaderProps,
  type ToolbarProps,
  type MarkdownPreviewProps,
} from 'exmd-collaborative-editor'

function MyHeader({ title, session }: EditorHeaderProps) {
  return <header><strong>{title}</strong><span>{session.state}</span></header>
}

function MyToolbar(props: ToolbarProps) {
  return <nav>
    <button disabled={props.readOnly} onClick={props.onUndo}>撤销</button>
    <button onClick={() => props.onModeChange('preview')}>预览</button>
    <button onClick={props.onDownload}>下载</button>
    {props.hostActions}
  </nav>
}

function MyPreview(props: MarkdownPreviewProps) {
  // 必须透传 interaction 和 resolveImageUrl，才能保留精确评论及图片授权解析。
  return <div className="my-preview"><MarkdownPreview {...props} /></div>
}

export function Page() {
  return <CollaborativeMarkdownEditor
    roomId="document-42"
    websocketUrl="wss://collab.example.com"
    components={{ Header: MyHeader, Toolbar: MyToolbar, Preview: MyPreview }}
  />
}
```

可替换区域：

- `Header: ComponentType<EditorHeaderProps>`
- `Toolbar: ComponentType<ToolbarProps>`
- `Preview: ComponentType<MarkdownPreviewProps>`
- `Loading: ComponentType<EditorLoadingProps>`
- `Footer: ComponentType<EditorFooterProps>`

包还导出默认 `Toolbar`、`MarkdownPreview`、`CodeBlock`、`MermaidDiagram`、`DefaultEditorHeader`、`DefaultEditorLoading` 和 `DefaultEditorFooter`，可以直接组合使用。

## Doca / 宿主管理模式

生产系统应创建并持有一个稳定的 `CollaborationSession`，负责认证、ACL、服务端身份、outbox、持久化 ACK 和重连，再通过 `collaboration` 注入。此时组件不会建立第二条 WebSocket 连接。

固定协议为：Yjs 根名称 `markdown`、codec `markdown-ytext`、schemaVersion `1`、protocolVersion `1`。可通过 `MARKDOWN_HOST_CAPABILITIES` 读取，不要在宿主重复硬编码。

```tsx
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import {
  MARKDOWN_HOST_CAPABILITIES,
  applyRemoteMarkdownUpdate,
  createHostMarkdownSession,
  observeLocalMarkdownUpdates,
} from 'exmd-collaborative-editor'

// 1. Doca 已完成鉴权，并从服务端拿到 epoch/schema/Yjs checkpoint。
const doc = new Y.Doc()
applyRemoteMarkdownUpdate(doc, checkpointBytes)
const text = doc.getText(MARKDOWN_HOST_CAPABILITIES.textRoot) // 固定为 markdown
const awareness = new Awareness(doc)
const undoManager = new Y.UndoManager(text)

// 2. 这里只包装已有模型，不创建 WebSocket、IndexedDB、autosave，也不写 initialValue。
const session = createHostMarkdownSession({
  doc,
  awareness,
  undoManager,
  epochId,
  state: 'ready',
  ready: true,
  saveState: 'clean',
  collaborators: platformPresence,
})

// 3. 只有本地正文 transaction 进入 Doca outbox；远端、初始化和 awareness 会被排除。
const unsubscribe = observeLocalMarkdownUpdates(session, ({ update }) => {
  docaOutbox.enqueue({ epochId, bytes: update })
})
```

只有服务端明确返回“新文档”时，宿主才应在编辑器挂载前调用一次 `initializeMarkdownDocument(doc, initialValue)`，并把产生的 bootstrap 与后续基线原子保存。注入模式下组件自身绝不会读取或写入 `initialValue`。已有文档直接应用 checkpoint/update；schema 或 epoch 不匹配应在 Doca 层拒绝进入 ready。

```tsx
import { useMemo, useRef } from 'react'
import {
  CollaborativeMarkdownEditor,
  type CollaborativeMarkdownEditorHandle,
  type CollaborationSession,
  type EditorResources,
} from 'exmd-collaborative-editor'

function DocaDocument({ session, canEdit }: { session: CollaborationSession; canEdit: boolean }) {
  const editorRef = useRef<CollaborativeMarkdownEditorHandle>(null)
  const resources = useMemo<EditorResources>(() => ({
    uploadImage: (file, { signal, onProgress }) =>
      assetService.upload(file, { signal, onProgress }), // 返回稳定 { path: assetId }
    resolveUrl: path => `/api/assets/${path}/content`,
    resolveDownloadUrl: path => `/api/assets/${path}/download`,
  }), [])

  return <CollaborativeMarkdownEditor
    ref={editorRef}
    roomId="document-42"
    collaboration={session}
    mode={canEdit ? 'edit' : 'readonly'}
    resources={resources}
    onDownload={(markdown, fileName) => exportService.download(markdown, fileName)}
  />
}
```

同一文档的 `doc/text/awareness/undoManager` 引用必须稳定；`collaboration` 可以更新为保留这些引用的新状态快照。`resources` 和 `components` 宜保持稳定引用。权限变化只调整 `mode`，不会重建 Y.Doc 或编辑器。上传保存稳定资产 ID/path，预览时再经 `resolveUrl` 获取当前有权限的地址；不要把 Cookie、签名 URL 或部署域名写入 Markdown。

连接与保存状态分别由宿主更新。使用 `updateHostMarkdownSession(previous, { state, ready, saveState })` 生成新状态快照会保留原始 `doc/text/awareness/undoManager` 引用，因此不会重建 CodeMirror 或 Y.Doc。`sync-response` 不能设置为已保存；只有匹配数据库提交 ACK、且 outbox 为空后才能设置 `saveState: 'clean'`。

如果 Doca 已有按账号隔离的 IndexedDB/outbox，只传入 `collaboration`，不要再传独立模式的 `websocketUrl`。包内 provider 和 `y-indexeddb` 均不会启动，Doca 的 outbox 是唯一保存通道。

## 选区、远端光标和评论锚点

```tsx
const stopSelection = editorRef.current?.onSelectionChange(selection => {
  // selection 使用 Yjs RelativePosition bytes，不包含正在输入的正文。
  docaPresence.send(selection)
})

editorRef.current?.renderRemoteSelections(remoteSessions)
editorRef.current?.clearRemoteSelections()

const anchor = editorRef.current?.captureAnchor()
if (anchor) await comments.create({ anchor, body: commentBody })
editorRef.current?.revealAnchor(anchor)
const currentRange = editorRef.current?.resolveAnchor(anchor)
```

公开选区类型为 `MarkdownTextSelection`，远端输入类型为 `RemoteMarkdownSelection`。同账号的两个页面用不同 `sessionId`，因此可同时绘制；切到只读会发布 `null` 并清除远端编辑选区。评论正文、作者、回复和解决状态仍完全属于 Doca。

0.3.0 补齐普通插入光标、可见用户名和每会话独立颜色。非空选区同时绘制跨行背景与 focus 端光标；后台模型变化后重新解析 Yjs 相对位置。此路径只使用公开 `renderRemoteSelections`，不依赖包内 awareness 连接。

`renderRemoteSelections` 接收**完整会话快照**（不是增量）：省略离开的会话或传 `selection: null` 清除。Doca 排除当前 sessionId，不排除同账号其他 session；用户身份、颜色和 ACL 由服务端决定。只读、纯预览及断连时清理编辑选区；本页失焦发送 null，宿主须将其转发到其他页面。重连或重新可编辑后应发送最新快照。

评论使用独立的完整快照与激活 API：

```tsx
import type { MarkdownCommentAnchor } from 'exmd-collaborative-editor'

const anchors: MarkdownCommentAnchor[] = comments.map(comment => ({
  id: comment.id,
  anchor: comment.anchor,
  resolved: comment.resolved,
  deleted: comment.deleted,
}))
editorRef.current?.renderAnchors(anchors)

// 区域 → 卡片：包内自动激活区域，宿主打开/滚动到自己的评论卡片。
const stopClick = editorRef.current?.onAnchorClick(id => showCommentCard(id))

// 卡片 → 区域：激活并定位；纯预览只滚动预览，不切回源码。
editorRef.current?.setActiveAnchor(comment.id)
editorRef.current?.revealAnchor(comment.anchor)

// 关闭卡片 / 取消激活，以及清理整个绘制层。
editorRef.current?.setActiveAnchor(null)
editorRef.current?.clearAnchors()
```

源码与内置预览共用上述快照和激活状态：未激活区域显示黄色下划线，激活区域增加黄色背景；resolved/deleted、快照中已移除、解析为 orphan 的区域不显示。重叠评论按照快照顺序轮流激活，每次点击调用同一个 `onAnchorClick(id)`，宿主打开对应卡片。评论允许在只读正文上展示与点击；是否允许新建评论及卡片 UI 由 Doca 的独立评论权限决定。

新创建的锚点为 `markdown-text-range-v2`：start 采用右关联、end 采用左关联，**两端边界插入均不扩展区域，内部插入包含在区域内**。空选区 `captureAnchor()` 返回 null，底层 `createMarkdownTextAnchor` 拒绝空区间。v2 附带原始字符的压缩 CRDT 身份区间；全部原始字符删除后保持 orphan，不附着到随后输入的相邻文字。

撤销完整删除会恢复正文，但 Yjs 的重建字符身份和本地 undo 映射不能在所有客户端/checkpoint 间等同。为保持一致，旧 v2 锚点继续 orphan；宿主可让用户选中恢复文字后显式重新关联。普通插入、部分删除以及未完全删除的 checkpoint 恢复仍跟随区域。旧 v1 锚点可以解析，但保留其原关联语义且没有 v2 的原始字符覆盖信息。锚点元数据属于评论库，不改变正文 codec/schema，不会重写 Y.Doc。

### 预览精确选区与宿主动作（0.4.0）

`captureAnchor()` 读取当前活动视图。split 模式由最近一次源码/预览操作决定；preview 模式只读取浏览器在当前预览内的原生选区。空选区、选区跨出预览、过期 DOM 投影或不支持的内容返回 null，绝不回退到隐藏的源码遗留选区。

预览使用 micromark 的 token 源偏移和 AST 叶节点位置建立逐 UTF-16 字符映射；实体/转义映射回完整源字符编码。未按段落、行号或全文搜索猜测位置。支持普通文字、嵌套粗斜体/删除线、链接标签、引用链接、跨段/软硬换行、列表、常规 GFM 表格、行内代码和内联颜色文字。重复文本由各自 AST 位置区分。跨格式/跨段选择仍保存一个连续源码范围，因此**两端之间的 Markdown 标记、换行及链接语法属于该范围**，不是所见文本的无标记副本。

```tsx
import { useMemo } from 'react'
import { CollaborativeMarkdownEditor, type MarkdownSelectionAction } from 'exmd-collaborative-editor'

const actions = useMemo<MarkdownSelectionAction[]>(() => [{
  id: 'comment',
  icon: <CommentIcon />,
  title: '添加评论',
  disabled: !canComment, // 与 canEdit 独立，正文只读仍可评论。
  onClick: ({ anchor, view }) => {
    if (anchor) openCommentComposer({ anchor, view })
  },
}], [canComment, openCommentComposer])

<CollaborativeMarkdownEditor
  collaboration={session}
  mode={canEdit ? 'edit' : 'readonly'}
  selectionActions={actions}
  selectionToolbar={false} // Doca 顶部入口：不启用悬浮工具栏。
/>
```

动作默认 `requiresSelection: true`，无有效选区时禁用。明确的全文动作可设置 false，并自行处理 null。selectionToolbar=true 时，在有效选区附近显示动作；无有效选区时回到顶部。toolbarActions 始终在顶部。图标按钮的 pointerdown/mousedown 保持原生选区，点击时重新验证并传入当前锚点，不限制正文只读。宿主仍应在服务端裁决评论权限。

自定义 `components.Toolbar` 必须渲染 `props.hostActions` 才能展示顶部插槽；自定义 `components.Preview` 必须把 `interaction` 原样传给内置 MarkdownPreview。完全自行重写 DOM 的预览组件不自动支持精确映射，会返回 null，而不是猜测位置。只传 value 的独立 MarkdownPreview 不持有协同模型或评论。

`revealAnchor()` 在当前活动视图定位；纯预览保持纯预览。`reveal()` 是源码查找结果定位，仍可切到源码。评论装饰是浏览器 Range 的只读几何投影，不修改可选文字 DOM；滚动、缩放、尺寸/字体变化会更新位置，评论激活不产生 Yjs 更新。装饰与悬浮工具栏使用 document.body portal；宿主若做全量 CSS 作用域化，需同时为 `.exmd-selection-toolbar .exmd-host-actions` 保留样式规则，不能仅限定在编辑器祖先内。

未支持：KaTeX 公式、Mermaid/SVG、图片本体、代码块高亮结果及无法精确映射的任意 HTML 块选区。选区经过这些生成内容时返回 null；可在源码中评论其源文。未实现评论列表弹出菜单（重叠采用轮流点击）、旋转/倾斜变换坐标适配、海量锚点性能专项优化。正文与评论无新网络、autosave 或 codec/schema。

完整可运行宿主示例：`/?host=1`（源码 `src/HostManagedDemo.tsx`）。npm 包内还附 `examples/DocaComments.tsx`，可复制到 React 宿主；注入已有 session 后直接运行，示例评论只放宿主内存。

## 命令句柄与查找替换

```tsx
const ref = useRef<CollaborativeMarkdownEditorHandle>(null)

const matches = ref.current?.find('待修改', { caseSensitive: false }) ?? []
if (matches[0]) {
  ref.current?.reveal(matches[0])
  ref.current?.replace(matches[0], '已修改')
}

ref.current?.replaceAll('旧名称', '新名称') // 单次编辑事务，可整体撤销
ref.current?.insertText('新增内容')
ref.current?.undo()
```

句柄还提供 `focus()`、`getMarkdown()`、`getEditorView()`、`redo()` 和 `queryFormatState()`。查找结果绑定内容 revision；文档在替换前发生变化时，旧 match 会被拒绝，宿主应重新查找。只读模式下所有修改命令返回 `false` 或 `0`。

## 独立图片上传

默认接口响应格式为 `{ "url": "https://..." }`：

```tsx
import { uploadImageToEndpoint } from 'exmd-collaborative-editor'

const url = await uploadImageToEndpoint(file, {
  endpoint: '/api/assets',
  fieldName: 'image',
  credentials: 'include',
  headers: { 'X-Document-Id': 'document-42' },
})
```

自定义响应结构：

```tsx
const url = await uploadImageToEndpoint(file, {
  endpoint: '/api/assets',
  resolveUrl: result => (result as { data: { publicUrl: string } }).data.publicUrl,
})
```

也支持简写 `uploadImageToEndpoint(file, '/api/images')`。没有上传服务时可调用 `imageToDataUrl(file)`；Data URL 仅适合演示或小图片。

## 纯 Markdown 文件交换（0.4.1）

只支持 `.md/.markdown` 导入、`.md` 导出，不含 Word、JSON 或 HTML 转换。内置下载按钮已移除；文件入口、替换确认、权限及下载均由 Doca 提供。完整 React 接入见 [examples/DocaMarkdownFiles.tsx](examples/DocaMarkdownFiles.tsx)。

```tsx
import { importMarkdownFile, exportMarkdownFile } from 'exmd-collaborative-editor'

// 先捕获目标实例和原文，再异步解码/弹确认框，避免覆盖期间到达的编辑。
const editor = editorRef.current!
const expectedMarkdown = editor.getMarkdown()
const result = await importMarkdownFile(file, { maxBytes: 512 * 1024 })
if (!result.ok) {
  host.showError(result.error.code, result.error.message)
} else if (await host.confirmImport(result.warnings)) {
  if (editorRef.current !== editor || !editor.replaceMarkdown(result.markdown, { expectedMarkdown })) {
    host.showError('文档已变化、未就绪或只读，请重新导入')
  }
}

// 原文快照，不读取预览 DOM；返回 Blob + 文件名 + MIME，不自动下载。
const output = exportMarkdownFile(editor.getMarkdown(), { fileName: '项目说明.md' })
host.showWarnings(output.warnings)
await host.download(output.blob, output.fileName, output.mimeType)
```

公开接口：

- `importMarkdownFile(file: File, options?: MarkdownImportOptions): Promise<MarkdownImportResult>`。默认字节上限 `DEFAULT_MARKDOWN_IMPORT_MAX_BYTES = 524288`，可显式配置；`maxBytes` 非法时抛 `RangeError`。扩展名不区分大小写，不依赖浏览器提供的 MIME。空文件和不完整 Markdown 语法合法，不做格式修复。
- 成功：`{ ok: true, markdown, fileName, byteLength, encoding: 'utf-8', hadBom, lineEndings, warnings }`。`lineEndings` 为 `none | lf | crlf | cr | mixed`。失败：`{ ok: false, error: { code, message }, warnings }`，没有可误用的 `markdown` 字段。
- 错误码：`UNSUPPORTED_EXTENSION / FILE_TOO_LARGE / INVALID_UTF8 / BINARY_CONTENT / READ_FAILED`。严格 UTF-8 解码，不猜测 GBK/UTF-16，不静默替换非法字节；NUL 按疑似二进制拒绝。
- `exportMarkdownFile(markdown: string, options?: MarkdownExportOptions): MarkdownExportResult`，返回 `{ blob, fileName, mimeType, warnings }`。复用 `createMarkdownFile`，MIME 固定 `MARKDOWN_FILE_MIME = 'text/markdown;charset=utf-8'`；文件名去除路径/控制字符、`.markdown` 改为 `.md`。不添加 BOM，不改写原文/CRLF。孤立 UTF-16 代理字符抛 `TypeError`，防止 Blob 隐式替换损坏数据。
- `handle.replaceMarkdown(markdown, { expectedMarkdown? }): boolean`：显式替换全部正文，一次 CodeMirror/Y.Text 内容事务，独立撤销单元；只读、未就绪、已卸载、模型投影不一致或预期原文不匹配时返回 false。相同原文成功但零正文事务。不重建编辑器，也不是初始化/远端同步入口。新建文档仍由服务端初始化流程负责。

UTF-8 BOM 作为文件签名只移除开头一个，并返回 `UTF8_BOM_REMOVED`；正文中的 U+FEFF 保留。中文、emoji、CRLF 原样保留；混合换行返回 `MIXED_LINE_ENDINGS`，不自动统一。若模型刻意以 U+FEFF 开头，导出保持该字符，但重新导入时会按文件 BOM 处理：本接口不区分“开头的正文 U+FEFF”和 BOM。

资源策略：每次交换均附 `RESOURCE_REFERENCES_PRESERVED` 提示。这是固定的能力边界警告，**不是已经扫描或验证资源的报告**。图片、附件链接、内部文档链接和外部地址原样保存，不抓取、不嵌入、不改为临时签名 URL。平台 UUID/path、相对地址和 `#/r/...` 离开平台不保证可访问；导出的 `.md` 不是含资源的离线包。原有 Data URL 会保留，但不会自动将资源转换为 Data URL。若宿主另行读取或下载资产，必须通过宿主授权的 `resources.resolveUrl / resolveDownloadUrl` 及自己的下载逻辑；本轮交换流程不读取资产，因此不调用这些接口。导入不等于信任原文 HTML/链接，预览仍使用既有安全策略。

限制：不支持其他编码转换、资源离线打包、语法完整性/链接可访问性校验或流式超大文件导入。全量替换会使被删除旧内容的评论锚点进入既有 orphan 策略，不迁移旧评论；宿主应先确认替换。导出只生成当前原文快照，不产生协同更新、自动保存或新网络连接。

独立旧接口仍保留（Doca 推荐使用上面的 Blob 返回接口）：

```tsx
import { createMarkdownFile, downloadMarkdown } from 'exmd-collaborative-editor'

// 浏览器直接下载，自动补充 .md 扩展名
downloadMarkdown('# 文档内容', { fileName: '项目说明' })

// 只创建 File，由宿主自行上传、保存或交给其他 API
const file = createMarkdownFile('# 文档内容', {
  fileName: '项目说明.md',
  mimeType: 'text/markdown;charset=utf-8',
})
```

## 单独使用协同 Hook 或预览

```tsx
import { MarkdownPreview, useCollaboration } from 'exmd-collaborative-editor'

function CustomEditor() {
  const session = useCollaboration({ roomId: 'document-42', websocketUrl: 'wss://collab.example.com' })
  return <MarkdownPreview value={session.text.toString()} />
}
```

公开状态为 `loading`、`syncing`、`ready`、`disconnected`、`error`。`ready` 表示协同基线可用，不代表服务端数据库已经提交。内置 `y-websocket` 适配器没有持久化 ACK，因此 `session.saveState` 为 `unavailable`。

## 开发与打包

```bash
yarn install
yarn dev
```

打开 `http://localhost:5173/?room=demo`，再打开第二个相同房间页面即可测试协同。默认 WebSocket 地址为 `ws://localhost:1234`。

无需任何 WebSocket 的完整宿主管理示例：

```text
http://localhost:5173/?host=1
http://localhost:5173/?host=1&readonly=1
```

实现位于 `src/HostManagedDemo.tsx`：服务端基线在编辑器挂载前完成，组件只接收已有 Y.Doc/Y.Text；示例还演示稳定资源 path、URL 解析、本地 update 订阅和模拟 ACK 状态。生产环境用 Doca 的共享会话、资源服务和 outbox 替换示例内存实现。

```bash
yarn build:lib
yarn build:demo
npm pack --dry-run
```

npm 产物位于 `dist/`，包含 ESM、CommonJS、类型声明和 `style.css`。生产协同服务还需实现服务端鉴权、ACL、持久化 ACK、更新去重、epoch、checkpoint 与断线 outbox；边界见 `docs/COLLABORATION.md`。

## 当前能力边界

- Markdown 是纯文本 CRDT，目前没有富文本式原子 mention/资源卡片节点；内部引用应先使用稳定相对 ID 的链接形式，自定义字段需要新的 codec、迁移和剪贴板协议。
- 查找替换为模型层字面量匹配，支持大小写选项，不支持正则表达式；不会通过 DOM/HTML 替换。
- 上传会保留发起时的 Yjs 相对选区并在卸载时取消，但当前 Markdown 模型没有可协同的原子上传占位节点。
- 包内 `y-websocket` 仅供独立运行和演示；Doca 应注入共享协同会话，不得把该连接与平台 outbox 同时启用。
- 已提供源码与预览共用的相对评论锚点、批量装饰、激活/取消激活与点击回调；评论卡片、正文、权限和持久化由宿主实现。生成内容的预览选区限制见上文。
- 上传使用相对选区并支持 AbortSignal；切只读或卸载会取消，迟到结果不会插入。Markdown 暂无跨客户端原子上传占位节点和失败重试节点。
- ACK 去重、持久 outbox、断网跨刷新恢复、epoch 冲突恢复副本、ACL/身份校验由 Doca 实现，本包不声称已经实现。

## 验证

```bash
yarn test:contract
yarn test:idle
yarn typecheck
yarn build
npm pack --dry-run
```

`test:contract` 使用隔离 Y.Doc 验证 host-only 无连接、本地 update 筛选、远端无回声、并发收敛、断线 update 重放、纯删除重复同步、同账号双 session、相对锚点及撤销。`test:idle` 实际等待 60 秒，验证 awareness 选区变化产生零正文 update。浏览器示例还验证只读 DOM/工具栏保护、延迟上传在切只读后取消，以及 Markdown 保存 UUID path、预览通过 resolver 得到 URL。

浏览器回归（包含 0.4.0 精确预览）：

```bash
yarn build:lib
yarn dev:web --host 127.0.0.1 --port 5198 --strictPort
# 打开 http://127.0.0.1:5198/tests/browser/index.html
# 点击“运行回归”和“运行 60 秒静置”
# 以及“运行预览精确评论验收”
```

浏览器夹具从 npm 入口加载构建产物，在两个隔离 iframe 页面中注入宿主管理会话并传递原始 Yjs bytes。覆盖真实 CodeMirror 挂载、空/已有文档预览循环、预览期间远端编辑和上传、只读取消迟到结果、模型撤销替换、公开选区/评论 API 及 60 秒滚动/选择/尺寸/保存状态变化零正文更新。它验证 SDK 浏览器行为；Doca 真正的 WebSocket、数据库 ACK、权限和整站端到端结果仍需平台复验。

## 0.3.0 升级说明

- 同一文档的 CodeMirror 在 edit/split/preview 中始终保留，preview 只隐藏面板；Yjs 绑定与撤销历史不随模式切换重建。宿主应在切换文档/epoch 时显式创建新会话并挂载新文档。
- 宿主管理入口不再运行独立连接 hook，也不创建额外 Y.Doc/Awareness。
- `CollaborationSession`、正文根 `markdown`、`exmd:meta`、codec/schema/protocol 均保持不变，不需要迁移正文或更换 epoch。
- 新增 `MarkdownCommentAnchor` 与 ref 的 `renderAnchors/setActiveAnchor/clearAnchors/onAnchorClick`；`RemoteMarkdownSelection.selection` 允许 null，表示离开/失焦。
- 新锚点数据版本为 v2；Doca 若校验评论锚点 kind，应放行 v2 并保存完整 content 身份区间。bytes 传输/存储时转 base64 或 number[]，读取时恢复 Uint8Array。
- 源码 Markdown 导出继续保留稳定资源 path，不是离线媒体打包格式。`resolveDownloadUrl` 目前是供宿主附件 UI 使用的回调约定，编辑器没有内置附件下载按钮；不要据此宣称已经验证附件下载授权。

## 0.4.0 升级说明

- 保留正文 `markdown-ytext / schema 1 / protocol 1` 和 v2 评论锚点，不需要迁移评论或正文。
- 新增预览字符级映射、两侧共享评论装饰、宿主动作插槽；captureAnchor 和 revealAnchor 的活动视图语义见上文。
- CodeMirror 按 LF 分隔逻辑行，同时保留原文的 CR 字符，避免加载 CRLF 文档时改写原模型或令偏移漂移。新增输入换行是 LF，已有源文不自动规范化。
- 旧版本验收报告为历史记录；本版结果和明确限制见 `docs/ACCEPTANCE-0.4.0.md`。
