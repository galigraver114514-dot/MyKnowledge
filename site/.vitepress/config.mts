import { defineConfig } from 'vitepress'
import type MarkdownIt from 'markdown-it'

// 部署路径基座: GitHub Pages 项目站点为 /<仓库名>/
// 自定义域名或用户站时:  BUILD_BASE=/ npm run build
const base = process.env.BUILD_BASE || '/MyKnowledge/'

// Multilingual content in ONE file:  :::lang-en ... :::  (zh / ja likewise)
// Rendered as <div class="langblock" data-lang="xx">; theme CSS shows only the
// block matching html[data-lang] (default: en). No extra dependency needed.
function langBlocks(md: MarkdownIt) {
  const RE = /^:::lang-([a-z]{2})\s*$/
  md.block.ruler.before('fence', 'langblock', (state: any, startLine: number, endLine: number, silent: boolean) => {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    const m = RE.exec(state.src.slice(start, max).trim())
    if (!m) return false
    if (silent) return true
    let closeLine = -1
    for (let i = startLine + 1; i < endLine; i++) {
      const s = state.bMarks[i] + state.tShift[i]
      const e = state.eMarks[i]
      if (state.src.slice(s, e).trim() === ':::') { closeLine = i; break }
    }
    if (closeLine < 0) return false
    const oldParent = state.parentType
    const oldLineMax = state.lineMax
    state.parentType = 'langblock'
    state.lineMax = closeLine
    const open = state.push('langblock_open', 'div', 1)
    open.block = true
    open.attrSet('class', 'langblock')
    open.attrSet('data-lang', m[1])
    md.block.tokenize(state, startLine + 1, closeLine)
    const close = state.push('langblock_close', 'div', -1)
    close.block = true
    state.parentType = oldParent
    state.lineMax = oldLineMax
    state.line = closeLine + 1
    return true
  })
}

export default defineConfig({
  lang: 'en',
  title: 'MyKnowledge',
  description: 'Personal learning site · minimal · local-first tracking',
  base,
  cleanUrls: true,
  markdown: {
    config: (md) => { langBlocks(md as unknown as MarkdownIt) }
  }
})
