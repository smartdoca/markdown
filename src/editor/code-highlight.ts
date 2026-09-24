import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import graphql from 'highlight.js/lib/languages/graphql'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

const languages = { bash, c, cpp, csharp, css, dockerfile, go, graphql, java, javascript, json, kotlin, markdown, php, python, ruby, rust, sql, swift, typescript, xml, yaml }
Object.entries(languages).forEach(([name, grammar]) => { if (!hljs.getLanguage(name)) hljs.registerLanguage(name, grammar) })
hljs.registerAliases(['js', 'jsx'], { languageName: 'javascript' })
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' })
hljs.registerAliases(['sh', 'shell'], { languageName: 'bash' })
hljs.registerAliases(['html', 'svg', 'vue'], { languageName: 'xml' })
hljs.registerAliases(['yml'], { languageName: 'yaml' })
hljs.registerAliases(['cs', 'dotnet'], { languageName: 'csharp' })
hljs.registerAliases(['md'], { languageName: 'markdown' })

export interface HighlightedCodeSegment { text: string; scope?: string }
export interface HighlightedCode { language: string; html: string; lines: HighlightedCodeSegment[][] }

type HighlightNode = string | { children?: HighlightNode[]; scope?: string }

function appendSegment(target: HighlightedCodeSegment[], text: string, scope?: string) {
  if (!text) return
  const last = target.at(-1)
  if (last && last.scope === scope) last.text += text
  else target.push({ text, scope })
}

function flattenNode(node: HighlightNode, target: HighlightedCodeSegment[], inheritedScope?: string) {
  if (typeof node === 'string') { appendSegment(target, node, inheritedScope); return }
  const scope = node.scope || inheritedScope
  for (const child of node.children || []) flattenNode(child, target, scope)
}

function splitLines(segments: HighlightedCodeSegment[]): HighlightedCodeSegment[][] {
  const lines: HighlightedCodeSegment[][] = [[]]
  for (const segment of segments) {
    const parts = segment.text.split('\n')
    for (let index = 0; index < parts.length; index++) {
      appendSegment(lines.at(-1)!, parts[index], segment.scope)
      if (index < parts.length - 1) lines.push([])
    }
  }
  return lines
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return value.replace(/[&<>"']/g, character => entities[character])
}

export function highlightCode(source: string, language: string | undefined): HighlightedCode {
  const requested = (language || '').toLowerCase()
  const normalized = hljs.getLanguage(requested) ? requested : 'plaintext'
  if (normalized === 'plaintext') return { language: normalized, html: escapeHtml(source), lines: source.split('\n').map(text => text ? [{ text }] : []) }
  const result = hljs.highlight(source, { language: normalized })
  const root = (result._emitter as unknown as { rootNode?: HighlightNode }).rootNode
  const segments: HighlightedCodeSegment[] = []
  if (root) flattenNode(root, segments)
  else appendSegment(segments, source)
  return { language: normalized, html: result.value, lines: splitLines(segments) }
}
