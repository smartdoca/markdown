import { highlightCode } from '../editor/code-highlight'

export interface CodeBlockProps { code: string; language: string }
export function CodeBlock({ code, language }: CodeBlockProps) {
  const source = code.replace(/\n$/, '')
  const highlighted = highlightCode(source, language)
  return <pre className="highlighted-code"><code className={`hljs language-${highlighted.language}`} dangerouslySetInnerHTML={{ __html: highlighted.html }} /></pre>
}
