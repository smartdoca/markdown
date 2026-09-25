export type MessageValues = Record<string, string | number>
export type EditorMessages = Record<string, string>
export type Translate = (key: string, values?: MessageValues) => string

/** Omitted locale stays Chinese. Only `zh` and `en` are recognized; anything else is English. */
export function resolveEditorLocale(locale?: string): 'zh' | 'en' {
  if (locale == null || locale === '') return 'zh'
  return locale === 'zh' ? 'zh' : 'en'
}

export function editorLanguageTag(locale?: string): 'zh-CN' | 'en' {
  return resolveEditorLocale(locale) === 'zh' ? 'zh-CN' : 'en'
}

const en: EditorMessages = {
  'toolbar.label': 'Markdown formatting toolbar',
  'toolbar.undo': 'Undo',
  'toolbar.redo': 'Redo',
  'toolbar.insertCode': 'Insert code block',
  'toolbar.codeLanguage': 'Code language',
  'toolbar.textColor': 'Text color',
  'toolbar.uploadImage': 'Upload image',
  'toolbar.insertDiagram': 'Insert diagram',
  'toolbar.insertFormula': 'Insert math formula',
  'toolbar.viewEdit': 'Edit only',
  'toolbar.viewSplit': 'Split view',
  'toolbar.viewPreview': 'Preview only',
  'format.heading1': 'Heading 1',
  'format.heading2': 'Heading 2',
  'format.heading3': 'Heading 3',
  'format.heading4': 'Heading 4',
  'format.heading5': 'Heading 5',
  'format.bold': 'Bold',
  'format.italic': 'Italic',
  'format.strike': 'Strikethrough',
  'format.inlineCode': 'Inline code',
  'format.quote': 'Quote',
  'format.bulletList': 'Bulleted list',
  'format.orderedList': 'Numbered list',
  'format.task': 'Task list',
  'format.link': 'Link',
  'format.boldPlaceholder': 'bold text',
  'format.italicPlaceholder': 'italic text',
  'format.strikePlaceholder': 'strikethrough text',
  'format.codePlaceholder': 'code',
  'format.linkPlaceholder': 'link text',
  'format.colorPlaceholder': 'colored text',
  'insert.diagram': '\n```mermaid\nflowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Done]\n  B -->|No| D[Revise]\n```\n',
  'insert.codePlaceholder': 'Type code here',
  'diagram.syntaxError': 'The diagram syntax is invalid. Check the Mermaid code.',
  'selection.toolbar': 'Selection actions',
  'notice.imageRequired': 'Choose an image file',
  'notice.readOnly': 'This document is read-only',
  'notice.uploadFailed': 'Image upload failed',
  'notice.downloadFailed': 'Download failed',
  'notice.uploading': 'Processing image…',
  'editor.pane': 'Markdown editor',
  'editor.characters.one': '{count} character',
  'editor.characters.other': '{count} characters',
  'editor.transportRequired': 'roomId and websocketUrl are required, or pass a host-managed collaboration session',
  'preview.pane': 'Document preview',
  'preview.label': 'Preview',
  'preview.updating': 'Updating preview…',
  'preview.syncScroll': 'Scroll sync',
  'preview.live': 'Live render',
  'document.title': 'Collaborative document',
  'status.ready': 'Collaboration ready',
  'status.error': 'Collaboration error',
  'status.offline': 'Offline',
  'status.offlineEditing': 'Offline editing',
  'status.syncing': 'Syncing document',
  'status.loading': 'Loading document',
  'header.room': 'Room · {roomId}',
  'presence.online.one': '{count} person online',
  'presence.online.other': '{count} people online',
  'presence.cursor': '{name}\'s cursor',
  'presence.anonymous': 'Anonymous',
  'loading.document': 'Loading collaborative document…',
  'footer.formats': 'CommonMark · GFM · Mermaid',
  'footer.readOnly': 'Read-only',
  'footer.dropImages': 'Drop or paste images',
  'collaboration.schemaMismatch': 'This document format is not supported',
  'collaboration.initializationFailed': 'Failed to load local collaboration data',
  'pdf.aborted': 'PDF conversion was cancelled',
  'pdf.fileTooLarge': 'PDF exceeds the {maxBytes}-byte limit',
  'pdf.readFailed': 'Could not read the PDF file',
  'pdf.passwordRequired': 'This PDF requires a password. Password-protected PDFs are not supported in this phase',
  'pdf.errorDetail': '{message} ({detail})',
  'pdf.timeout': 'PDF conversion exceeded the {timeoutMs} ms limit',
  'pdf.pageLimit': 'PDF exceeds the {maxPages}-page limit',
  'pdf.unsafeLink': 'Skipped an unsafe or unverifiable PDF link',
  'pdf.multiColumn': 'Possible multi-column layout detected. Text order is reconstructed approximately from PDF coordinates',
  'pdf.imagePixelLimit': 'An image in the PDF exceeds the {maxImagePixels}-pixel limit',
  'pdf.pngFailed': 'Could not convert a PDF image to PNG',
  'pdf.imageSkipped': 'Could not extract an embedded PDF image. It was skipped',
  'pdf.canvasUnavailable': 'No Canvas is available in this environment, so embedded PDF images could not be extracted',
  'pdf.imageParseFailed': 'Failed to parse an embedded PDF image. Text import continued',
  'pdf.noTextPage': 'This page has no extractable text. Scanned PDFs are not OCR\'d in this phase',
  'pdf.imageAlt': 'PDF image',
  'pdf.complexTableImport': 'PDF tables are reconstructed approximately from text coordinates. Complex merged cells may be lossy',
  'pdf.noText': 'The PDF has no extractable text. Scanned PDFs are not OCR\'d in this phase',
  'pdf.invalid': 'The PDF is damaged or uses an unsupported format',
  'pdf.unsafeLinkText': 'Downgraded an unsafe link to plain text',
  'pdf.mathDegraded': 'Math was downgraded to readable plain text',
  'pdf.complexTableExport': 'Tables are drawn at a fixed width. Merged cells and overly wide columns may be lossy',
  'pdf.fontFallback': 'No font covering every character was provided. Unsupported characters were replaced with question marks. Provide a Chinese TTF/OTF font in PdfExportOptions.fontBytes',
  'pdf.fontFallbackCjk': 'No Chinese font was provided. Characters the standard fonts cannot encode are replaced with question marks. Provide a Chinese TTF/OTF font in PdfExportOptions.fontBytes',
  'pdf.imageUnresolved': 'No resolveResource callback was provided for a Markdown image. Alternate text was exported instead',
  'pdf.imageFailed': 'Failed to resolve a Markdown image. Alternate text was exported instead',
  'pdf.inlineImageUnresolved': 'No resolveResource callback was provided for an inline Markdown image. Alternate text was exported instead',
  'pdf.inlineImageUnsupported': 'The inline Markdown image format is unsupported. Alternate text was exported instead',
  'pdf.inlineImageFailed': 'Failed to resolve an inline Markdown image. Alternate text was exported instead',
  'pdf.pageGeometry': 'PDF page size and margins must be positive numbers',
  'validation.positiveInteger': '{name} must be a positive safe integer',
  'validation.nonNegativeInteger': '{name} must be a non-negative safe integer',
  'validation.markdownString': 'markdown must be a string',
  'validation.loneSurrogate': 'Markdown contains an isolated UTF-16 surrogate and cannot be exported to UTF-8 without data loss',
  'markdown.resourcePreserved': 'Only the Markdown source is exchanged. Image, attachment, and internal-link IDs, paths, and addresses are kept as-is. Resources were not read and authorization was not checked. Platform-internal resources are not guaranteed to work outside the platform.',
  'markdown.unsupportedExtension': 'Only .md and .markdown files are supported',
  'markdown.fileTooLarge': 'File exceeds the {maxBytes}-byte limit',
  'markdown.readFailed': 'Could not read the Markdown file',
  'markdown.invalidUtf8': 'The file is not valid UTF-8. Convert the encoding first. No damaged characters were replaced',
  'markdown.binary': 'The file contains a NUL character and may be binary or unsupported UTF-16/UTF-32',
  'markdown.bomRemoved': 'Removed the UTF-8 BOM at the start of the file. U+FEFF in the body was kept',
  'markdown.mixedLineEndings': 'The file mixes line-ending styles. They were kept as-is and not normalized',
  'upload.failed': 'Upload failed ({status})',
  'upload.missingUrl': 'The upload endpoint did not return an image URL',
  'upload.readFailed': 'Could not read the image',
}

const zh: EditorMessages = {
  'toolbar.label': 'Markdown 格式工具栏',
  'toolbar.undo': '撤销',
  'toolbar.redo': '重做',
  'toolbar.insertCode': '插入代码块',
  'toolbar.codeLanguage': '代码语言',
  'toolbar.textColor': '文字颜色',
  'toolbar.uploadImage': '上传图片',
  'toolbar.insertDiagram': '插入流程图',
  'toolbar.insertFormula': '插入数学公式',
  'toolbar.viewEdit': '仅编辑',
  'toolbar.viewSplit': '分栏',
  'toolbar.viewPreview': '仅预览',
  'format.heading1': '一级标题',
  'format.heading2': '二级标题',
  'format.heading3': '三级标题',
  'format.heading4': '四级标题',
  'format.heading5': '五级标题',
  'format.bold': '加粗',
  'format.italic': '斜体',
  'format.strike': '删除线',
  'format.inlineCode': '行内代码',
  'format.quote': '引用',
  'format.bulletList': '无序列表',
  'format.orderedList': '有序列表',
  'format.task': '待办事项',
  'format.link': '链接',
  'format.boldPlaceholder': '加粗文字',
  'format.italicPlaceholder': '斜体文字',
  'format.strikePlaceholder': '删除文字',
  'format.codePlaceholder': '代码',
  'format.linkPlaceholder': '链接文字',
  'format.colorPlaceholder': '彩色文字',
  'insert.diagram': '\n```mermaid\nflowchart TD\n  A[开始] --> B{判断}\n  B -->|是| C[完成]\n  B -->|否| D[调整]\n```\n',
  'insert.codePlaceholder': '在这里输入代码',
  'diagram.syntaxError': '流程图语法有误，请检查 Mermaid 代码。',
  'selection.toolbar': '选中文字操作',
  'notice.imageRequired': '请选择图片文件',
  'notice.readOnly': '当前文档为只读模式',
  'notice.uploadFailed': '图片上传失败',
  'notice.downloadFailed': '下载失败',
  'notice.uploading': '正在处理图片…',
  'editor.pane': 'Markdown 编辑器',
  'editor.characters.one': '{count} 字符',
  'editor.characters.other': '{count} 字符',
  'editor.transportRequired': 'roomId 和 websocketUrl 必填，或传入宿主管理的 collaboration 会话',
  'preview.pane': '文档预览',
  'preview.label': '预览',
  'preview.updating': '预览更新中…',
  'preview.syncScroll': '同步滚动',
  'preview.live': '实时渲染',
  'document.title': '协作文档',
  'status.ready': '协同就绪',
  'status.error': '协同错误',
  'status.offline': '离线',
  'status.offlineEditing': '离线编辑',
  'status.syncing': '同步文档中',
  'status.loading': '加载文档中',
  'header.room': '房间 · {roomId}',
  'presence.online.one': '{count} 人在线',
  'presence.online.other': '{count} 人在线',
  'presence.cursor': '{name} 的光标',
  'presence.anonymous': '匿名',
  'loading.document': '正在获取协作文档…',
  'footer.formats': '支持 CommonMark · GFM · Mermaid',
  'footer.readOnly': '只读模式',
  'footer.dropImages': '图片可直接拖入或粘贴',
  'collaboration.schemaMismatch': '文档格式不受支持',
  'collaboration.initializationFailed': '本地协同数据加载失败',
  'pdf.aborted': 'PDF 转换已取消',
  'pdf.fileTooLarge': 'PDF 文件超过 {maxBytes} 字节限制',
  'pdf.readFailed': '无法读取 PDF 文件',
  'pdf.passwordRequired': 'PDF 需要密码，第一阶段不支持密码 PDF',
  'pdf.errorDetail': '{message}（{detail}）',
  'pdf.timeout': 'PDF 转换超过 {timeoutMs} 毫秒限制',
  'pdf.pageLimit': 'PDF 页数超过 {maxPages} 页限制',
  'pdf.unsafeLink': '已跳过不安全或无法验证的 PDF 链接',
  'pdf.multiColumn': '检测到可能的多栏布局，文本顺序按 PDF 坐标近似重建',
  'pdf.imagePixelLimit': 'PDF 内图片超过 {maxImagePixels} 像素限制',
  'pdf.pngFailed': '无法将 PDF 图片转换为 PNG',
  'pdf.imageSkipped': 'PDF 内嵌图片无法提取，已跳过',
  'pdf.canvasUnavailable': '当前运行环境没有可用的 Canvas，无法提取 PDF 内嵌图片',
  'pdf.imageParseFailed': 'PDF 内嵌图片解析失败，已继续导入文本',
  'pdf.noTextPage': '此页没有可提取文本；扫描 PDF 第一阶段不执行 OCR',
  'pdf.imageAlt': 'PDF 图片',
  'pdf.complexTableImport': 'PDF 表格按坐标文本近似还原，复杂合并单元格可能有损',
  'pdf.noText': 'PDF 没有可提取文本；扫描 PDF 第一阶段不执行 OCR',
  'pdf.invalid': 'PDF 文件损坏或格式不受支持',
  'pdf.unsafeLinkText': '已将不安全链接降级为纯文本',
  'pdf.mathDegraded': '数学公式已按可读纯文本降级',
  'pdf.complexTableExport': '表格按固定宽度绘制；合并单元格和超宽列可能有损',
  'pdf.fontFallback': '未提供可覆盖全部字符的字体；不兼容字符已替换为问号。建议在 PdfExportOptions.fontBytes 中提供中文 TTF/OTF 字体',
  'pdf.fontFallbackCjk': '未提供中文字体；导出会将标准字体无法编码的字符降级为问号。请在 PdfExportOptions.fontBytes 中提供中文 TTF/OTF 字体',
  'pdf.imageUnresolved': 'Markdown 图片未提供 resolveResource，已用替代文本导出',
  'pdf.imageFailed': 'Markdown 图片资源解析失败，已用替代文本导出',
  'pdf.inlineImageUnresolved': 'Markdown 行内图片未提供 resolveResource，已用替代文本导出',
  'pdf.inlineImageUnsupported': 'Markdown 行内图片格式不受支持，已用替代文本导出',
  'pdf.inlineImageFailed': 'Markdown 行内图片资源解析失败，已用替代文本导出',
  'pdf.pageGeometry': 'PDF 页面尺寸和页边距必须为正数',
  'validation.positiveInteger': '{name} 必须为正安全整数',
  'validation.nonNegativeInteger': '{name} 必须为非负安全整数',
  'validation.markdownString': 'markdown 必须为字符串',
  'validation.loneSurrogate': 'Markdown 包含孤立 UTF-16 代理字符，无法无损导出为 UTF-8',
  'markdown.resourcePreserved': '仅交换 Markdown 原文；图片、附件和内部链接的 ID/path/地址原样保留，未读取资源或验证授权，平台内部资源离开平台不保证可访问。',
  'markdown.unsupportedExtension': '只支持 .md 和 .markdown 文件',
  'markdown.fileTooLarge': '文件超过 {maxBytes} 字节限制',
  'markdown.readFailed': '无法读取 Markdown 文件',
  'markdown.invalidUtf8': '文件不是有效 UTF-8；请先转换编码，未替换任何损坏字符',
  'markdown.binary': '文件包含 NUL 字符，可能是二进制或不受支持的 UTF-16/UTF-32 编码',
  'markdown.bomRemoved': '已移除文件开头的 UTF-8 BOM；正文内的 U+FEFF 保留',
  'markdown.mixedLineEndings': '文件混用了换行格式；原样保留，未统一换行',
  'upload.failed': '上传失败（{status}）',
  'upload.missingUrl': '上传接口未返回图片地址',
  'upload.readFailed': '读取图片失败',
}

function assertSameKeys(left: EditorMessages, right: EditorMessages) {
  const missing = Object.keys(left).filter(key => !Object.prototype.hasOwnProperty.call(right, key))
  const extra = Object.keys(right).filter(key => !Object.prototype.hasOwnProperty.call(left, key))
  if (missing.length || extra.length) {
    throw new Error(`Message catalog mismatch. Missing zh: ${missing.join(', ')}. Extra zh: ${extra.join(', ')}`)
  }
}
assertSameKeys(en, zh)

const catalogs = { en, zh }

export function editorMessageKeys(): { en: string[]; zh: string[] } {
  return { en: Object.keys(en).sort(), zh: Object.keys(zh).sort() }
}

export function translate(locale: string | undefined, key: string, values?: MessageValues, messages?: EditorMessages): string {
  const lang = resolveEditorLocale(locale)
  const count = values && typeof values.count === 'number' ? values.count : undefined
  const candidates = count === undefined ? [key] : [`${key}.${count === 1 ? 'one' : 'other'}`, key]
  const sources: Array<EditorMessages | undefined> = [messages, catalogs[lang], catalogs.en]
  let template: string | undefined
  for (const source of sources) {
    if (!source) continue
    for (const candidate of candidates) {
      if (Object.prototype.hasOwnProperty.call(source, candidate)) {
        template = source[candidate]
        break
      }
    }
    if (template !== undefined) break
  }
  if (template === undefined) template = candidates[0]
  if (!values) return template
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => {
    const value = values[name]
    return value == null ? match : String(value)
  })
}

export function bindTranslate(locale?: string, messages?: EditorMessages): Translate {
  return (key, values) => translate(locale, key, values, messages)
}

export function collaborationErrorText(error: { code: string; message: string; cause?: unknown }, locale?: string, messages?: EditorMessages): string {
  if (error.code === 'INITIALIZATION_FAILED') return translate(locale, 'collaboration.initializationFailed', undefined, messages)
  if (error.code === 'SCHEMA_MISMATCH' && !(error.cause instanceof Error)) return translate(locale, 'collaboration.schemaMismatch', undefined, messages)
  return error.message
}
