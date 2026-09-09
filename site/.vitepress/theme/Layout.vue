<script setup lang="ts">
// 极简 Layout (N5-R2/R3): 无动画、无默认 chrome。
// 结构: 左侧可折叠树(树隐藏时正文全宽) + 正文。全局 hjkl 键控。
// SSR: 键盘/滚动/history/localStorage 均在 onMounted 后。
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Content, useRouter, useRoute } from 'vitepress'
import SiteTree from './SiteTree.vue'

const router = useRouter()
const route = useRoute()
const treeRef = ref<InstanceType<typeof SiteTree> | null>(null)
const open = ref(true)          // 初始一致(SSR/client), 不持久化, 保持可预期
const showHelp = ref(false)
const helpRows = [
  ['j / k', '下/上移动光标 (导航内)'],
  ['h', '折叠当前组; 已在叶子 → 跳到父组'],
  ['l / Enter', '展开组; 叶子 → 打开该页'],
  ['t', '开/关左侧导航'],
  ['Esc', '收起导航'],
  ['(导航隐藏时) j / k', '正文按行滚动'],
  ['(导航隐藏时) h / l', '浏览器后退/前进'],
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
  if (showHelp.value) { showHelp.value = false; return }   // 任意键关闭帮助, 不触发动作
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
      case 'j': window.scrollBy(0, 32); e.preventDefault(); break
      case 'k': window.scrollBy(0, -32); e.preventDefault(); break
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
        <button class="mk-ghost" title="收起导航 (t)" aria-label="收起导航" @click="open = false">×</button>
      </div>
      <SiteTree ref="treeRef" class="mk-tree-scroll" />
      <div class="mk-keys">j/k 移动 · l 打开 · h 折叠 · Esc 收起 · ? 帮助</div>
    </aside>

    <button v-if="!open" class="mk-openbtn" title="打开导航 (t)" @click="open = true">☰ 导航 (t)</button>

    <main class="mk-main" :class="{ 'mk-nopanel': !open }">
      <div class="mk-content"><Content /></div>
    </main>

    <div v-if="showHelp" class="mk-help" role="dialog" aria-label="键盘帮助" @click="showHelp = false">
      <table>
        <caption>键盘 (vim 风格)</caption>
        <tbody>
          <tr v-for="(r, i) in helpRows" :key="i"><td><kbd>{{ r[0] }}</kbd></td><td>{{ r[1] }}</td></tr>
        </tbody>
      </table>
      <p class="mk-help-close">任意键关闭帮助</p>
    </div>
  </div>
</template>
