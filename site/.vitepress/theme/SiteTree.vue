<script setup lang="ts">
// SiteTree —— 左侧全站导航树 (N5-R2)
// 行为: 组节点可折叠(持久化 localStorage); 叶子跳转(router.go, 顶部滚动); 支持方向键移动光标。
// SSR 安全: localStorage/路由定位都在 onMounted。
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
  ancestors: string[]   // 向上最近可折叠祖先的 key 链(含直接祖先)
}

const router = useRouter()
const route = useRoute()

const expanded = ref<Set<string>>(new Set())
const cursor = ref<number | null>(null)
const listEl = ref<HTMLElement | null>(null)

function flat(exp: ReadonlySet<string>): Row[] {
  const out: Row[] = []
  const walk = (nodes: NavNode[], depth: number, ancestors: string[]) => {
    for (const n of nodes) {
      if (n.kind === 'page') {
        out.push({ key: n.path, title: n.title, path: n.path, depth, isGroup: false, expanded: false, ancestors })
      } else {
        const e = exp.has(n.key)
        out.push({ key: n.key, title: n.title, depth, isGroup: true, expanded: e, ancestors })
        if (e) walk(n.children, depth + 1, [...ancestors, n.key])
      }
    }
  }
  walk(NAV, 0, [])
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
  const path = route.path
  const need = ancestorsOfPath(path)
  for (const k of need) expanded.value.add(k)
  cursor.value = rows.value.findIndex((r) => r.path === path)
}
function scrollCursorIntoView() {
  requestAnimationFrame(() => {
    if (cursor.value == null || !listEl.value) return
    const el = listEl.value.querySelectorAll('a, button, .mk-node')[cursor.value] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  })
}
function moveCursor(delta: number) {
  if (!rows.value.length) return
  if (cursor.value == null) { cursor.value = delta > 0 ? 0 : rows.value.length - 1 }
  else cursor.value = Math.min(rows.value.length - 1, Math.max(0, cursor.value + delta))
  scrollCursorIntoView()
}

function toggle(key: string, force?: boolean) {
  const now = force ?? !expanded.value.has(key)
  if (now) expanded.value.add(key); else expanded.value.delete(key)
  saveExpanded()
}
function goTo(path: string) {
  if (path === route.path) return
  window.scrollTo(0, 0)
  router.go(path)
}

// --- 键盘接口 (由 Layout 转发) ---
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
  const anc = r.ancestors
  if (!anc.length) return
  const parent = anc[anc.length - 1]
  const idx = rows.value.findIndex((x) => x.key === parent)
  if (idx >= 0) cursor.value = idx
}
function clickRow(i: number) {
  cursor.value = i
  const r = rows.value[i]
  if (r.isGroup) toggle(r.key)
  else if (r.path) goTo(r.path)
}
defineExpose({ moveUp, moveDown, activateCurrent, collapseLeft })

watch(() => route.path, () => { loadExpanded(); syncCursorToRoute() })
onMounted(() => { loadExpanded(); syncCursorToRoute() })
</script>

<template>
  <nav ref="listEl" class="mk-tree" aria-label="站点导航">
    <div v-for="(r, i) in rows" :key="r.key" :class="['mk-node', 'mk-depth-' + r.depth, {
      'mk-cur': i === cursor,
      'mk-current-page': !r.isGroup && r.path === route.path
    }]">
      <button
        v-if="r.isGroup"
        class="mk-row mk-group"
        :aria-expanded="r.expanded"
        @click="clickRow(i)"
      ><span class="mk-glyph">{{ r.expanded ? '−' : '+' }}</span>{{ r.title }}</button>
      <a v-else class="mk-row mk-leaf" :href="r.path" @click.prevent="clickRow(i)">{{ r.title }}</a>
    </div>
    <p v-if="!rows.length" class="mk-empty">(无节点)</p>
  </nav>
</template>
