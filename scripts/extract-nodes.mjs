// extract-nodes.mjs - mechanical node extraction (v0.1, see specs/node-model.md)
// Reads site/.vitepress/theme/nodes.spec.json (pages with node config), extracts
// nodes from structured content deterministically. AI hooks are a later layer.
// Usage: node scripts/extract-nodes.mjs            (dry run: stats + samples)
//        node scripts/extract-nodes.mjs --write    (write nodes.gen.json)
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SPEC = path.join(ROOT, 'site/.vitepress/theme/nodes.spec.json')
const OUT = path.join(ROOT, 'site/.vitepress/theme/nodes.gen.json')
const WRITE = process.argv.includes('--write')

const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'))

function parseFm(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return {}
  const fm = {}
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('-')) continue
    const i = line.indexOf(':')
    if (i < 0) continue
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return fm
}
function stripFm(text) { return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '') }
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '')
}

const TERM_COLS = new Set(['单词', '词', '术语', 'term', 'Term', 'word'])
const DEF_COLS = new Set(['释义', '含义', '核心义', 'definition', '意思', '翻译'])
const SKIP_COLS = new Set(['#', '序号', 'no', '例句', 'example', '例'])

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim())
}
function parseTable(lines, from) {
  const header = cells(lines[from])
  if (!header.length) return null
  const termIdx = header.findIndex((h) => TERM_COLS.has(h))
  const idx = termIdx >= 0 ? termIdx : header.findIndex((h) => !SKIP_COLS.has(h) && !/^\d+$/.test(h)) >= 0 ? header.findIndex((h) => !SKIP_COLS.has(h) && !/^\d+$/.test(h)) : 0
  const nodes = []
  let i = from + 1
  // skip separator row like |---|---|
  if (i < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i]) && lines[i].includes('-')) i++
  const labelDims = []
  for (let c = 0; c < header.length; c++) {
    if (c === idx || SKIP_COLS.has(header[c]) || TERM_COLS.has(header[c])) continue
    if (!DEF_COLS.has(header[c])) labelDims.push(header[c])
  }
  for (; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) break
    const row = cells(lines[i])
    const term = row[idx]
    if (!term || term === '—' || term === '-') continue
    if (/\(\d+\)$/.test(term)) continue            // 例句等单元格残留序号防护
    const labels = {}
    let def = null
    for (let c = 0; c < header.length; c++) {
      const h = header[c]
      const v = row[c]
      if (!v || c === idx) continue
      if (DEF_COLS.has(h)) { def = v; continue }
      if (SKIP_COLS.has(h)) continue
      ;(labels[h] ||= []).push(v)
    }
    nodes.push({
      id: null, // filled later with unit id
      name: term,
      kind: termIdx >= 0 ? 'word' : 'item',
      origin: 'mechanical',
      definition: def,
      labels
    })
  }
  return { nodes, labelDims: [...new Set(labelDims)], termIdx }
}

const pagesOut = []
let total = 0
for (const page of spec.pages || []) {
  const abs = path.join(ROOT, 'site', page.file)
  if (!fs.existsSync(abs)) { console.warn('[nodes] missing file ' + page.file); continue }
  const text = fs.readFileSync(abs, 'utf8')
  const fm = parseFm(text)
  const body = stripFm(text)
  const lines = body.split(/\r?\n/)
  const found = []
  const seen = new Set()
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) continue
    const t = parseTable(lines, i)
    if (!t) continue
    i += 1
    while (i < lines.length && lines[i].trim().startsWith('|')) i++
    i--
    for (const n of t.nodes) {
      const key = n.name
      if (seen.has(key)) continue
      seen.add(key)
      n.id = (page.id || 'p') + '.' + slug(n.name)
      found.push(n)
    }
  }
  total += found.length
  pagesOut.push({ path: page.path, id: page.id, file: page.file, mode: page.mode, prompt: page.prompt, dims: page.dims, nodes: found })
}

if (WRITE) {
  fs.writeFileSync(OUT, JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), pages: pagesOut, stats: { pages: pagesOut.length, nodes: total } }, null, 1))
  console.log('[nodes] wrote ' + OUT + ' (' + pagesOut.length + ' pages, ' + total + ' nodes)')
} else {
  for (const p of pagesOut) {
    console.log('== ' + p.path + (p.prompt ? '  [prompt: ' + p.prompt + ']' : '') + ' :: nodes=' + p.nodes.length)
    if (p.nodes.length) {
      const dims = [...new Set(p.nodes.flatMap((n) => Object.keys(n.labels)))]
      console.log('   dims(cols): ' + (dims.join(', ') || '-') + '   dims(whitelist): ' + (p.dims || []).join(', '))
      for (const n of p.nodes.slice(0, 3)) console.log('   - ' + n.id + '  def=' + (n.definition || '').slice(0, 24))
    } else {
      console.log('   no structured content -> v0.1 leaves to ai-auto (origin=ai-auto), prompt guidance present: ' + (p.prompt ? 'yes' : 'no'))
    }
  }
  console.log('[nodes] dry: pages=' + pagesOut.length + ' mechanical nodes=' + total + '  (add --write to persist)')
}
