// gen-catalog.mjs - mechanical document -> page pipeline (see specs/document-api.md)
// Scans site/**/*.md, derives the nav tree + unit registry + page meta and
// writes site/.vitepress/theme/catalog.gen.ts (committed, regenerated).
// Usage:  node scripts/gen-catalog.mjs [--check]   (--check: exit 1 on errors)
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const SITE = path.join(ROOT, 'site')
const CFG_PATH = path.join(ROOT, 'site/.vitepress/theme/courses.config.json')
const OUT = path.join(ROOT, 'site/.vitepress/theme/catalog.gen.ts')
const CHECK = process.argv.includes('--check')

const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'))
const errors = []

// ---------- tiny frontmatter/yaml parser (subset for our keys) ----------
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return {}
  const fm = {}
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('-')) continue
    const i = line.indexOf(':')
    if (i < 0) continue
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    else if (v === 'true') v = true
    else if (v === 'false') v = false
    else if (!isNaN(Number(v)) && v !== '') v = Number(v)
    fm[k] = v
  }
  return fm
}
function stripFm(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}
function firstH1(text) {
  const m = text.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : null
}
function createdFromGit(rel) {
  try {
    const out = execFileSync('git', ['log', '--diff-filter=A', '--format=%cs', '--', rel], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return out.trim().split(/\n/)[0] || null
  } catch { return null }
}

// ---------- scan ----------
const rootPages = []
const dirs = []
function walk(dir, rel) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'zh', { numeric: true }))
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    if (e.isDirectory()) {
      if (e.name === '.vitepress') continue
      dirs.push({ rel: rel ? rel + '/' + e.name : e.name, abs: path.join(dir, e.name) })
      walk(path.join(dir, e.name), rel ? rel + '/' + e.name : e.name)
    } else if (e.name.endsWith('.md')) {
      if (!rel && e.name !== 'index.md') rootPages.push({ rel: e.name, abs: path.join(dir, e.name) })
    }
  }
}
walk(SITE, '')
dirs.push({ rel: '', abs: SITE })

const parsed = new Map()
function getDoc(abs, rel) {
  if (!parsed.has(abs)) {
    const text = fs.readFileSync(abs, 'utf8')
    parsed.set(abs, { fm: parseFrontmatter(text), body: stripFm(text) })
  }
  return parsed.get(abs)
}

const labelOf = (rel) => {
  const last = rel.split('/').pop() || rel
  return (cfg.labels?.[rel]) ?? (cfg.labels?.[last]) ?? last
}
const sortFiles = (a, b) => a.name.localeCompare(b.name, 'zh', { numeric: true })

function pageNode(fileRel, abs, groupLabel) {
  const doc = getDoc(abs, fileRel)
  const slug = path.basename(fileRel, '.md')
  const orderNum = (slug.match(/^(\d+)/) || [])[1]
  const bodyTitle = firstH1(doc.body)
  const title = (doc.fm.title || bodyTitle || slug).replace(/^#\s*/, '')
  if (doc.fm.title === undefined && !bodyTitle) errors.push('missing title (no # H1 and no title:) in ' + fileRel)
  const id = doc.fm.id || fileRel.replace(/\.md$/, '').replace(/\//g, '.')
  return {
    title, path: '/' + fileRel.replace(/\.md$/, ''), id,
    created: doc.fm.created || createdFromGit(fileRel),
    lang: doc.fm.lang || null,
    track: doc.fm.type !== 'page' && doc.fm.track !== false,
    order: doc.fm.order ?? (orderNum ? Number(orderNum) : Infinity),
    groupLabel
  }
}

const pageFiles = new Map() // page path -> meta
const navRoot = []
const homePath = path.join(SITE, 'index.md')
if (fs.existsSync(homePath)) {
  const h = getDoc(homePath, 'index.md')
  navRoot.push({ kind: 'page', title: h.fm.title || '首页', path: '/' })
  pageFiles.set('/', { id: null, created: h.fm.created || null, lang: h.fm.lang || null, track: false, title: h.fm.title || '首页' })
}

function buildDir(rel, depth) {
  const info = dirs.find((d) => d.rel === rel)
  if (!info) return null
  const children = []
  const indexAbs = path.join(info.abs, 'index.md')
  if (fs.existsSync(indexAbs)) {
    const idx = getDoc(indexAbs, (rel ? rel + '/' : '') + 'index.md')
    const p2 = rel ? '/' + rel + '/' : '/'
    const nodeTitle = depth === 0 ? (cfg.courseIndexLabel || '赛道首页') : labelOf(rel)
    children.push({ kind: 'page', title: idx.fm.navTitle || nodeTitle, path: p2 })
    pageFiles.set(p2, { id: null, created: idx.fm.created || null, lang: idx.fm.lang || null, track: false, title: idx.fm.title || nodeTitle })
  }
  if (rel) {
    const files = fs.readdirSync(info.abs, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md' && !e.name.startsWith('.'))
      .map((e) => ({ name: e.name, abs: path.join(info.abs, e.name), rel: rel + '/' + e.name }))
      .sort(sortFiles)
    for (const f of files) {
      const u = pageNode(f.rel, f.abs, labelOf(rel))
      children.push({ kind: 'page', title: u.title, path: u.path })
      pageFiles.set(u.path, u)
    }
  }
  let subdirs = dirs.filter((d) => d.rel !== rel && d.rel.startsWith(rel ? rel + '/' : '') && d.rel.split('/').length === (rel ? rel.split('/').length + 1 : 1))
  const orderList = cfg.dirOrder?.[rel] || []
  const rank = (r) => { const i = orderList.indexOf(r); return i === -1 ? 999 : i }
  subdirs = subdirs.sort((a, b) => (rank(a.rel.split('/').pop()) - rank(b.rel.split('/').pop())) || a.rel.localeCompare(b.rel, 'zh', { numeric: true }))
  for (const sd of subdirs) {
    const sub = buildDir(sd.rel, depth + 1)
    if (sub && sub.children.length) children.push(sub)
  }
  if (!children.length) return null
  const key = rel ? 'g-' + rel.replace(/\//g, '-') : 'g-root'
  return { kind: 'group', key, title: labelOf(rel), children }
}
for (const top of dirs.filter((d) => d.rel && !d.rel.includes('/')).sort((a, b) => a.rel.localeCompare(b.rel, 'zh', { numeric: true }))) {
  const g = buildDir(top.rel, 0)
  if (g) navRoot.push(g)
}
for (const f of rootPages) {
  const u = pageNode(f.rel, f.abs, '')
  navRoot.push({ kind: 'page', title: u.title, path: u.path })
  pageFiles.set(u.path, { ...u, track: false })
}

// ---------- flatten unit registry (ProgressPanel) ----------
const units = []
for (const [p, m] of pageFiles) {
  if (m.track && m.id) units.push({ id: m.id, title: m.title, path: p, course: m.groupLabel || '未分类' })
}
units.sort((a, b) => a.path.localeCompare(b.path, 'zh', { numeric: true }))

// ---------- validation ----------
const seenIds = new Map(), seenPaths = new Set()
for (const [p, m] of pageFiles) {
  if (seenPaths.has(p)) errors.push('duplicate page path: ' + p)
  seenPaths.add(p)
  if (m.id && seenIds.has(m.id)) errors.push('duplicate id "' + m.id + '" (' + p + ' vs ' + seenIds.get(m.id) + ')')
  else if (m.id) seenIds.set(m.id, p)
}

// ---------- write output (string concat on purpose, no template nesting) ----------
const lines = []
lines.push('// AUTO-GENERATED by scripts/gen-catalog.mjs - do not edit by hand.')
lines.push('// Authoring contract & pipeline: specs/document-api.md')
lines.push('')
lines.push('export const NAV = ' + JSON.stringify(navRoot, null, 1))
lines.push('')
lines.push('export const UNITS = ' + JSON.stringify(units, null, 1))
lines.push('')
const metaObj = {}
for (const [p, m] of pageFiles) metaObj[p] = { id: m.id ?? null, created: m.created ?? null, lang: m.lang ?? null, track: !!m.track, title: m.title }
lines.push('export const PAGE_META = ' + JSON.stringify(metaObj, null, 1))
lines.push('')
fs.writeFileSync(OUT, lines.join('\n'))

if (!CHECK) {
  const dump = []
  const render = (nodes, d) => { for (const n of nodes) { dump.push('  '.repeat(d) + (n.kind === 'group' ? n.title + '/' : n.title + '  ->  ' + n.path)); if (n.kind === 'group') render(n.children, d + 1) } }
  render(navRoot, 0)
  console.log('[gen] nav tree:\n' + dump.join('\n'))
  console.log('[gen] pages=' + pageFiles.size + ' units=' + units.length)
  console.log('[gen] wrote ' + OUT)
}
if (errors.length) {
  console.error('[gen] ERRORS (' + errors.length + '):')
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}
if (CHECK) console.log('[check] ok - ' + pageFiles.size + ' pages, ' + units.length + ' units')
