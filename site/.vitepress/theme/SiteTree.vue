<script setup lang="ts">
// SiteTree —— ASCII 目录树 (N5-R2 v2)
// 纯文本连接线树 (|-- / `-- / |   ), vim 式光标行, [+] 折叠 / [-] 展开。
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vitepress'
import { NAV, MK_TREE_EXPANDED_KEY, type NavNode } from './nav'

interface Row {
  key: string
  title: string
  path?: string
  depth: number
  isGroup: boolean
  expanded: boolean
  isLast: boolean
  ind: string      // 祖先延续列 (纯空格/| 的 4 字符列)
  conn: string     // 自身分支符: '' (根层) | '|-- ' | '`-- '
  ancestors: string[]
}

const router = useRouter()
const route = useRoute()

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
        out.push({ key: n.key, title: n.title, depth, isGroup: true, expanded: e, isLast: last, ind, conn, ancestors })
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
  const need = ancestorsOfPath(route.path)
  for (const k of need) expanded.value.add(k)
  cursor.value = rows.value.findIndex((r) => r.path === route.path)
}
function scrollCursorIntoView() {
  requestAnimationFrame(() => {
    if (cursor.value == null || !listEl.value) return
    const els = listEl.value.querySelectorAll('.mk-line')
    ;(els[cursor.value] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' })
  })
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
function goTo(path: string) {
  if (path === route.path) return
  window.scrollTo(0, 0)
  router.go(path)
}

function moveUp() { moveCursor(-1) }
function moveDown() { moveCursor(1) }
function activateCurrent() {
  if (cursor.value == null) return
  const r = rows.value[cursor.value]
  if (!r) return
  if (r.isGroup) toggle(r.key)
  else if (r.path) goTo(r.path)
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
function clickRow(i: number) {
  cursor.value = i
  const r = rows.value[i]
  if (r.isGroup) toggle(r.key)
  else if (r.path) goTo(r.path)
}
function mark(i: number, r: Row): string {
  if (i === cursor.value) return '>'
  if (!r.isGroup && r.path === route.path) return '*'
  return ' '
}
defineExpose({ moveUp, moveDown, activateCurrent, collapseLeft })

watch(() => route.path, () => { loadExpanded(); syncCursorToRoute() })
onMounted(() => { loadExpanded(); syncCursorToRoute() })
</script>

<template>
  <nav ref="listEl" class="mk-tree" aria-label="站点导航">
    <template v-for="(r, i) in rows" :key="r.key">
      <button
        v-if="r.isGroup"
        class="mk-line"
        :class="{ 'mk-cur': i === cursor }"
        :aria-expanded="r.expanded"
        @click="clickRow(i)"
      ><span>{{ mark(i, r) }}</span><span class="mk-guide">{{ r.ind }}{{ r.conn }}</span>{{ r.title }}<span class="mk-exp">{{ r.expanded ? ' [-] ' : ' [+] ' }}</span></button>
      <a
        v-else
        class="mk-line"
        :class="{ 'mk-cur': i === cursor, 'mk-current-page': r.path === route.path }"
        :href="r.path"
        @click.prevent="clickRow(i)"
      ><span>{{ mark(i, r) }}</span><span class="mk-guide">{{ r.ind }}{{ r.conn }}</span>{{ r.title }}</a>
    </template>
    <p v-if="!rows.length" class="mk-empty">(no nodes)</p>
  </nav>
</template>
