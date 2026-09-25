import { translate, type EditorMessages } from './i18n'

export interface UploadImageOptions {
  endpoint: string
  fieldName?: string
  headers?: HeadersInit
  signal?: AbortSignal
  credentials?: RequestCredentials
  /** Convert a custom server response into the public image URL. */
  resolveUrl?: (response: unknown) => string | Promise<string>
  locale?: string
  messages?: EditorMessages
}

export async function uploadImageToEndpoint(file: File, endpointOrOptions?: string | UploadImageOptions): Promise<string> {
  if (endpointOrOptions) {
    const options = typeof endpointOrOptions === 'string' ? { endpoint: endpointOrOptions } : endpointOrOptions
    const body = new FormData()
    body.append(options.fieldName || 'file', file)
    const response = await fetch(options.endpoint, { method: 'POST', body, headers: options.headers,
      signal: options.signal, credentials: options.credentials })
    if (!response.ok) throw new Error(translate(options.locale, 'upload.failed', { status: response.status }, options.messages))
    const result: unknown = await response.json()
    const url = options.resolveUrl ? await options.resolveUrl(result) : (result as { url?: string })?.url
    if (!url) throw new Error(translate(options.locale, 'upload.missingUrl', undefined, options.messages))
    return url
  }
  return imageToDataUrl(file)
}

export function imageToDataUrl(file: File, options: { locale?: string; messages?: EditorMessages } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(translate(options.locale, 'upload.readFailed', undefined, options.messages)))
    reader.readAsDataURL(file)
  })
}

export interface DownloadMarkdownOptions { fileName?: string; mimeType?: string; locale?: string; messages?: EditorMessages }

export function createMarkdownFile(markdown: string, options: DownloadMarkdownOptions = {}): File {
  // Blob otherwise silently turns lone UTF-16 surrogates into U+FFFD.
  for (let i = 0; i < markdown.length; i++) {
    const unit = markdown.charCodeAt(i)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = markdown.charCodeAt(++i)
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError(translate(options.locale, 'validation.loneSurrogate', undefined, options.messages))
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new TypeError(translate(options.locale, 'validation.loneSurrogate', undefined, options.messages))
  }
  return new File([markdown], normalizeMarkdownFileName(options.fileName || 'document.md'),
    { type: options.mimeType || 'text/markdown;charset=utf-8' })
}

export function downloadMarkdown(markdown: string, options: DownloadMarkdownOptions = {}): void {
  const file = createMarkdownFile(markdown, options)
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url; link.download = file.name; link.click()
  URL.revokeObjectURL(url)
}

function normalizeMarkdownFileName(fileName: string): string {
  const safeName = fileName.replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, '-').trim().replace(/\.markdown$/i, '.md') || 'document.md'
  return /\.md$/i.test(safeName) ? safeName : `${safeName}.md`
}
