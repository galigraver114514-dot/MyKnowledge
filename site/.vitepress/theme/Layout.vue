<script setup lang="ts">
// ASCII minimal Layout: left directory tree + content, hjkl keys,
// bottom status bar (current location / reading %) and per-page scroll memory.
// SSR-safe: all listeners and window logic are attached after mount.
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Content, withBase, useRoute, useData, onContentUpdated } from 'vitepress'
import SiteTree from './SiteTree.vue'

const MK_META_KEY = 'mk.page.meta'
const { frontmatter } = useData()
import { NAV, type NavNode } from './nav'

const SCROLL_KEY = 'mk.scroll.positions'

const route = useRoute()
function cur(): string {
  const p = route.path
  const b = withBase('/')
  if (p === b) return '/'
  return p.startsWith(b) ? p.slice(b.length - 1) : p
}
const treeRef = ref<InstanceType<typeof SiteTree> | null>(null)
const open = ref(true)
const showHelp = ref(false)
const crumbs = ref('')
const rawPath = ref('')
const pct = ref(0)
const metaVisible = ref(false)
const metaLine = ref('')
let lastPath = cur()
let ticking = false
let metaTimer: ReturnType<typeof setTimeout> | null = null

// ---------- hidden page meta suffix (key 'm') ----------
function loadMetaPref() {
  try { metaVisible.value = localStorage.getItem(MK_META_KEY) === '1' } catch { /* ignore */ }
}
function saveMetaPref() {
  try { localStorage.setItem(MK_META_KEY, metaVisible.value ? '1' : '0') } catch { /* ignore */ }
}
// heuristic 字数: CJK chars count as one each, latin/digit runs count as words
function countChars(text: string): number {
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/g) || []).length
  const words = (text.match(/[A-Za-z0-9]+/g) || []).length
  return cjk + words
}
function computeMeta() {
  const wrap = document.querySelector('.mk-content')
  if (!wrap) return
  const clone = wrap.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.mk-meta').forEach((el) => el.remove())
  const cnt = countChars(clone.textContent || '')
  const fm = (frontmatter.value || {}) as Record<string, unknown>
  const created = (fm.created as string) || '-'
  const lang = (fm.lang as string) || '-'
  metaLine.value = 'created: ' + created + ' | chars: ' + cnt + ' | lang: ' + lang
}
function toggleMeta() {
  metaVisible.value = !metaVisible.value
  saveMetaPref()
  if (metaVisible.value) {
    metaTimer = setTimeout(computeMeta, 60)   // wait for current content
  } else if (metaTimer) { clearTimeout(metaTimer) }
}

// ---------- bottom status bar data ----------
function findCrumbs(path: string, nodes: NavNode[] = NAV, acc: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.kind === 'page') {
      if (n.path === path) return [...acc, n.title]
    } else {
      const r = findCrumbs(path, n.children, [...acc, n.title])
      if (r) return r
    }
  }
  return null
}
function updateLocation() {
  rawPath.value = cur()
  const bc = findCrumbs(cur())
  crumbs.value = bc ? bc.join(' / ') : cur() === '/' ? '学习地图' : cur()
}
function calcPct(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight
  return max > 0 ? Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100))) : 0
}
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => { ticking = false; pct.value = calcPct() })
}

// ---------- per-page scroll memory (localStorage) ----------
// VitePress natively scrolls to top after a link navigation (router.js), so a
// plain 30ms restore loses the race. Strategy: wait until the page is tall
// enough for the saved offset (or a 2s deadline), set it, then re-assert once
// ~300ms later (only upward: never yank the user back down).
function readPositions(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SCROLL_KEY) || '{}') } catch { return {} }
}
function savePos(path: string) {
  if (typeof window === 'undefined') return
  try {
    const m = readPositions()
    m[path] = window.scrollY
    localStorage.setItem(SCROLL_KEY, JSON.stringify(m))
  } catch { /* ignore */ }
}
function restorePos() {
  const y = readPositions()[cur()] ?? 0
  pct.value = 0
  if (typeof window === 'undefined') return
  if (y <= 0) { window.scrollTo(0, 0); return }
  const start = Date.now()
  const apply = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, Math.min(y, Math.max(0, max)))
    pct.value = calcPct()
  }
  const waitUntilTall = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (max >= y || Date.now() - start > 2000) apply()
    else setTimeout(waitUntilTall, 70)
  }
  waitUntilTall()
  // re-assert after VitePress / async content settle (upward only)
  setTimeout(() => {
    if (window.scrollY < y - 8) apply()
  }, 300)
}

// ---------- keys ----------
const helpRows = [
  ['j / k', '光标下/上移 (树内)'],
  ['l / Enter', '展开组 / 打开单元'],
  ['h', '折叠组 / 跳到父组'],
  ['t', '开/关目录树'],
  ['Esc', '收起目录树'],
  ['(树隐藏) j / k', '正文行滚动'],
  ['(树隐藏) h / l', '后退 / 前进'],
  ['?', '本帮助'],
  ['m', '显示/隐藏页面后缀 (创建日期/字数/语言)']
] as const

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (isTypingTarget(e)) return
  const k = e.key
  if (k === '?') { showHelp.value = !showHelp.value; e.preventDefault(); return }
  if (showHelp.value) { showHelp.value = false; return }
  if (k === 'm') { toggleMeta(); e.preventDefault(); return }
  if (open.value) {
    switch (k) {
      case 'j': treeRef.value?.moveDown(); e.preventDefault(); break
      case 'k': treeRef.value?.moveUp(); e.preventDefault(); break
      case 'l':
      case 'Enter': treeRef.value?.activateCurrent(); e.preventDefault(); break
      case 'h': treeRef.value?.collapseLeft(); e.preventDefault(); break
      case 't':
      case 'Escape': open.value = false; e.preventDefault(); break
    }
  } else {
    switch (k) {
      case 't': open.value = true; e.preventDefault(); break
      case 'j': window.scrollBy(0, 28); e.preventDefault(); break
      case 'k': window.scrollBy(0, -28); e.preventDefault(); break
      case 'h': window.history.back(); e.preventDefault(); break
      case 'l': window.history.forward(); e.preventDefault(); break
    }
  }
}

// route changes: save old page scroll, update the status bar, restore new page
watch(() => route.path, () => {
  const prev = lastPath
  lastPath = cur()
  if (prev && prev !== lastPath) savePos(prev)
  updateLocation()
  restorePos()
})
onContentUpdated(() => {
  updateLocation()
  restorePos()
  if (metaVisible.value) metaTimer = setTimeout(computeMeta, 60)
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('scroll', onScroll, { passive: true })
  updateLocation()
  pct.value = calcPct()
  restorePos()
  loadMetaPref()
  if (metaVisible.value) metaTimer = setTimeout(computeMeta, 120)
  window.addEventListener('beforeunload', () => savePos(lastPath))
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('beforeunload', () => savePos(lastPath))
})
</script>

<template>
  <div class="mk">
    <aside v-if="open" class="mk-panel">
      <div class="mk-panel-top">
        <a class="mk-brand" :href="withBase('/')">MyKnowledge</a>
        <button class="mk-ghost" title="收起 (Esc/t)" aria-label="收起" @click="open = false">x</button>
      </div>
      <SiteTree ref="treeRef" class="mk-tree-scroll" />
      <div class="mk-keys">j/k move   l open   h fold   m meta   Esc hide   ? help</div>
    </aside>

    <button v-if="!open" class="mk-openbtn" title="打开 (t)" @click="open = true">nav [t]</button>

    <main class="mk-main" :class="{ 'mk-nopanel': !open }">
      <div class="mk-content"><Content />
        <div v-if="metaVisible" class="mk-meta">{{ metaLine }}</div>
      </div>
    </main>

    <!-- bottom status bar: current location / reading progress / extensible -->
    <footer class="mk-status" aria-label="status">
      <span class="mk-status-left" :title="rawPath">&gt; {{ crumbs }}</span>
      <span class="mk-status-right">
        <span class="mk-status-item mk-pct">{{ pct }}%</span>
        <span class="mk-status-item">t:nav</span>
        <span class="mk-status-item">?:help</span>
      </span>
    </footer>

    <div v-if="showHelp" class="mk-help" @click="showHelp = false">
      <div class="mk-help-inner">
        <h4>keys (vim-like)</h4>
        <table>
          <tbody>
            <tr v-for="(r, i) in helpRows" :key="i"><td>{{ r[0] }}</td><td>{{ r[1] }}</td></tr>
          </tbody>
        </table>
        <p class="mk-help-close">press any key to close</p>
      </div>
    </div>
  </div>
</template>
