<script setup lang="ts">
// SiteTree - ASCII directory tree.
// Pure-text connectors (|-- / `-- / |), vim-style '>' cursor line,
// [+] collapsed / [-] expanded groups. All navigation uses withBase() real
// hrefs handled by VitePress's own router (no manual router.go calls).
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, withBase } from 'vitepress'
import { NAV, MK_TREE_EXPANDED_KEY, type NavNode } from './nav'
import { useT, courseLabelOf } from './i18n'

const TREE_SCROLL_KEY = 'mk.tree.scroll'
let scrollRaf = false

interface Row {
  key: string
  title: string
  path?: string
  dir?: string | null
  depth: number
  isGroup: boolean
  expanded: boolean
  isLast: boolean
  ind: string
  conn: string
  ancestors: string[]
}

const route = useRoute()
const { t, lang } = useT()
const PAGE_KEYS: Record<string, string> = { '/': 'status.home', '/graph': 'page.graph', '/track': 'page.track', '/english/': 'page.idxEn', '/math/': 'page.idxMath' }
function nodeTitle(r: Row): string {
  if (r.isGroup) return r.dir ? courseLabelOf(r.dir, lang.value) : r.title
  return PAGE_KEYS[r.path as string] ? t(PAGE_KEYS[r.path as string]) : r.title
}
// VitePress route.path includes the base prefix (e.g. /MyKnowledge/english/...);
// normalize to the bare path used by NAV entries.
function cur(): string {
  const p = route.path
  const b = withBase('/')
  if (p === b) return '/'
  return p.startsWith(b) ? p.slice(b.length - 1) : p
}
const expanded = ref<Set<string>>(new Set())
const cursor = ref<number | null>(null)
const listEl = ref<HTMLElement | null>(null)

function flat(exp: ReadonlySet<string>): Row[] {
  const out: Row[] = []
  const walk = (nodes: NavNode[], ind: string, depth: number, ancestors: string[]) => {
    nodes.forEach((n, i) => {
      const last = i === nodes.length - 1
      const conn = depth === 0 ? '' : last ? '`-- ' : '|-- '
      if (n.kind === 'page') {
        out.push({ key: n.path, title: n.title, path: n.path, depth, isGroup: false, expanded: false, isLast: last, ind, conn, ancestors })
      } else {
        const e = exp.has(n.key)
        out.push({ key: n.key, title: n.title, dir: (n as { dir?: string | null }).dir ?? null, depth, isGroup: true, expanded: e, isLast: last, ind, conn, ancestors })
        if (e) {
          const childInd = depth === 0 ? '' : ind + (last ? '    ' : '|   ')
          walk(n.children, childInd, depth + 1, [...ancestors, n.key])
        }
      }
    })
  }
  walk(NAV, '', 0, [])
  return out
}
const rows = computed<Row[]>(() => flat(expanded.value))

function saveExpanded() {
  try { localStorage.setItem(MK_TREE_EXPANDED_KEY, JSON.stringify([...expanded.value])) } catch { /* ignore */ }
}
function loadExpanded() {
  try {
    const raw = localStorage.getItem(MK_TREE_EXPANDED_KEY)
    if (raw) expanded.value = new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
}
function collectGroupKeys(nodes: NavNode[], acc: string[] = []): string[] {
  for (const n of nodes) if (n.kind === 'group') { acc.push(n.key); collectGroupKeys(n.children, acc) }
  return acc
}
// First visit (nothing stored yet): expand everything so the full tree is visible.
function seedExpandedOnce() {
  let had = false
  try { had = localStorage.getItem(MK_TREE_EXPANDED_KEY) !== null } catch { /* ignore */ }
  if (had) return
  for (const k of collectGroupKeys(NAV)) expanded.value.add(k)
  saveExpanded()
}
function ancestorsOfPath(path: string): string[] {
  const walk = (nodes: NavNode[], acc: string[]): string[] | null => {
    for (const n of nodes) {
      if (n.kind === 'page' && n.path === path) return acc
      if (n.kind === 'group') {
        const r = walk(n.children, [...acc, n.key])
        if (r) return r
      }
    }
    return null
  }
  return walk(NAV, []) ?? []
}
function syncCursorToRoute() {
  const need = ancestorsOfPath(cur())
  let changed = false
  for (const k of need) { if (!expanded.value.has(k)) { expanded.value.add(k); changed = true } }
  if (changed) saveExpanded()   // auto-expanded ancestors must survive panel close/reopen
  cursor.value = rows.value.findIndex((r) => r.path === cur())
}
function cursorEl(): HTMLElement | null {
  if (cursor.value == null || !listEl.value) return null
  const els = listEl.value.querySelectorAll('.mk-line')
  return (els[cursor.value] as HTMLElement | undefined) ?? null
}
function scrollCursorIntoView() {
  requestAnimationFrame(() => {
    const c = listEl.value, el = cursorEl()
    if (!c || !el) return
    const cr = c.getBoundingClientRect(), er = el.getBoundingClientRect()
    const inside = er.top >= cr.top && er.bottom <= cr.bottom
    if (!inside) el.scrollIntoView({ block: 'nearest' })
  })
}
function onTreeScroll() {
  if (scrollRaf || !listEl.value) return
  scrollRaf = true
  requestAnimationFrame(() => {
    scrollRaf = false
    try { localStorage.setItem(TREE_SCROLL_KEY, String(listEl.value?.scrollTop ?? 0)) } catch { /* ignore */ }
  })
}
function restoreTreeScroll() {
  if (!listEl.value) return
  try { listEl.value.scrollTop = Number(localStorage.getItem(TREE_SCROLL_KEY) || 0) } catch { /* ignore */ }
}
function moveCursor(delta: number) {
  if (!rows.value.length) return
  if (cursor.value == null) cursor.value = delta > 0 ? 0 : rows.value.length - 1
  else cursor.value = Math.min(rows.value.length - 1, Math.max(0, cursor.value + delta))
  scrollCursorIntoView()
}
function toggle(key: string, force?: boolean) {
  if (force ?? !expanded.value.has(key)) expanded.value.add(key)
  else expanded.value.delete(key)
  saveExpanded()
}

function moveUp() { moveCursor(-1) }
function moveDown() { moveCursor(1) }
// Keyboard activation = real click on that row (group toggles / link goes
// through VitePress routing), same path as mouse.
function activateCurrent() {
  if (cursor.value == null) return
  const el = listEl.value?.querySelectorAll('.mk-line')[cursor.value] as HTMLElement | undefined
  el?.click()
}
function collapseLeft() {
  if (cursor.value == null) return
  const r = rows.value[cursor.value]
  if (!r) return
  if (r.isGroup && r.expanded) { toggle(r.key, false); return }
  const parent = r.ancestors[r.ancestors.length - 1]
  if (!parent) return
  const idx = rows.value.findIndex((x) => x.key === parent)
  if (idx >= 0) cursor.value = idx
}
function onRowClick(i: number, isGroup: boolean) {
  cursor.value = i
  if (isGroup) toggle(rows.value[i].key)   // groups: toggle only; links: native <a> + VitePress
}
function mark(i: number, r: Row): string {
  if (i === cursor.value) return '>'
  if (!r.isGroup && r.path === cur()) return '*'
  return ' '
}
defineExpose({ moveUp, moveDown, activateCurrent, collapseLeft })

watch(() => route.path, () => {
  seedExpandedOnce(); loadExpanded(); syncCursorToRoute(); scrollCursorIntoView()
})
onMounted(() => {
  seedExpandedOnce(); loadExpanded(); syncCursorToRoute()
  restoreTreeScroll()
  try {
    if (!Number(localStorage.getItem(TREE_SCROLL_KEY) || 0)) scrollCursorIntoView()
  } catch { scrollCursorIntoView() }
  listEl.value?.addEventListener('scroll', onTreeScroll, { passive: true })
})
onBeforeUnmount(() => { listEl.value?.removeEventListener('scroll', onTreeScroll) })
</script>

<template>
  <nav ref="listEl" class="mk-tree" aria-label="站点导航">
    <template v-for="(r, i) in rows" :key="r.key">
      <button
        v-if="r.isGroup"
        class="mk-line mk-group"
        :class="{ 'mk-cur': i === cursor }"
        :aria-expanded="r.expanded"
        @click="onRowClick(i, true)"
      ><span class="mk-mark">{{ mark(i, r) }}</span><span class="mk-guide">{{ r.ind }}{{ r.conn }}</span>{{ nodeTitle(r) }}<span class="mk-exp">{{ r.expanded ? ' [-] ' : ' [+] ' }}</span></button>
      <a
        v-else
        class="mk-line"
        :class="{ 'mk-cur': i === cursor, 'mk-current-page': r.path === cur() }"
        :href="withBase(r.path)"
        @click="onRowClick(i, false)"
      ><span class="mk-mark">{{ mark(i, r) }}</span><span class="mk-guide">{{ r.ind }}{{ r.conn }}</span>{{ nodeTitle(r) }}</a>
    </template>
    <p v-if="!rows.length" class="mk-empty">(no nodes)</p>
  </nav>
</template>
