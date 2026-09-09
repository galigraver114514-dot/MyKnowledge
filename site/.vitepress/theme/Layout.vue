<script setup lang="ts">
// ASCII 极简 Layout: 左目录树 + 正文, hjkl 键控, 零图形/动画。
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Content, useRouter } from 'vitepress'
import SiteTree from './SiteTree.vue'

const router = useRouter()
const treeRef = ref<InstanceType<typeof SiteTree> | null>(null)
const open = ref(true)
const showHelp = ref(false)
const helpRows = [
  ['j / k', '光标下/上移 (树内)'],
  ['l / Enter', '展开组 / 打开单元'],
  ['h', '折叠组 / 跳到父组'],
  ['t', '开/关目录树'],
  ['Esc', '收起目录树'],
  ['(树隐藏) j / k', '正文行滚动'],
  ['(树隐藏) h / l', '后退 / 前进'],
  ['?', '本帮助']
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
onMounted(() => { window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey) })
</script>

<template>
  <div class="mk">
    <aside v-if="open" class="mk-panel">
      <div class="mk-panel-top">
        <a class="mk-brand" href="/" @click.prevent="router.go('/')">MyKnowledge</a>
        <button class="mk-ghost" title="收起 (Esc/t)" aria-label="收起" @click="open = false">x</button>
      </div>
      <SiteTree ref="treeRef" class="mk-tree-scroll" />
      <div class="mk-keys">j/k move   l open   h fold   Esc hide   ? help</div>
    </aside>

    <button v-if="!open" class="mk-openbtn" title="打开 (t)" @click="open = true">nav [t]</button>

    <main class="mk-main" :class="{ 'mk-nopanel': !open }">
      <div class="mk-content"><Content /></div>
    </main>

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
