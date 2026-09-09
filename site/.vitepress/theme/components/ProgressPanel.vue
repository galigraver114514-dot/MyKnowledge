<script setup lang="ts">
// ProgressPanel —— 学习地图进度面板 (N5)
// 与 site/.vitepress/config.mts sidebar 同源的单元注册表 (v0 手工维护; 未来可自动生成)
// 只读派生状态, 不写任何事件。逻辑在 onMounted (客户端)。
import { ref, onMounted } from 'vue'
import { openDB, getState } from '../../../../tracker/db.js'

const UNITS = [
  { id: 'e-vocab-001', course: '词汇 · 核心', title: 'Unit 01 高频动词 12', path: '/english/vocab-core/unit-01-core-verbs' },
  { id: 'e-vocab-002', course: '词汇 · 核心', title: 'Unit 02 高频名词 12', path: '/english/vocab-core/unit-02-core-nouns' },
  { id: 'e-vocab-003', course: '词汇 · 核心', title: 'Unit 03 学习话题词', path: '/english/vocab-core/unit-03-study-words' },
  { id: 'e-gram-001', course: '基础语法', title: 'Unit 01 时态总览', path: '/english/grammar-basics/unit-01-tenses' },
  { id: 'e-gram-002', course: '基础语法', title: 'Unit 02 句子成分', path: '/english/grammar-basics/unit-02-sentence-parts' }
]

type Status = 'not_started' | 'in_progress' | 'completed'
interface St { status: Status }

const statusOf = ref<Record<string, Status>>({})
const loaded = ref(false)
const error = ref('')
const hasData = ref(false)

const courses = Object.entries(
  UNITS.reduce<Record<string, typeof UNITS>>((acc, u) => {
    ;(acc[u.course] ||= []).push(u)
    return acc
  }, {})
)

function courseStat(units: typeof UNITS) {
  const done = units.filter((u) => statusOf.value[u.id] === 'completed').length
  return { done, total: units.length, pct: Math.round((done / units.length) * 100) }
}
const all = courseStat(UNITS)

onMounted(async () => {
  try {
    const db = await openDB()
    const map = await getState(db)
    hasData.value = map.size > 0
    for (const u of UNITS) {
      const s = map.get(u.id) as St | undefined
      if (s) statusOf.value[u.id] = s.status
    }
  } catch (e) {
    error.value = '无法读取本机进度: ' + (e as Error).message
  } finally {
    loaded.value = true
  }
})
</script>

<template>
  <div class="progress-panel">
    <p v-if="error" class="pp-error">{{ error }}</p>
    <p v-else-if="!loaded" class="pp-hint">加载本地进度…</p>
    <template v-else>
      <p v-if="!hasData" class="pp-hint">
        还没有本地记录 —— 打开任意单元页即开始追踪（unit_open 自动记录），
        或先用 <code>npm run demo</code> 手动录入验证。
      </p>
      <div v-else class="pp-summary">
        总进度 {{ all.done }}/{{ all.total }}（{{ all.pct }}%）
      </div>
      <div v-for="(units, course) in courses" :key="course" class="pp-course">
        <div class="pp-course-head">
          <strong>{{ course }}</strong>
          <span class="pp-count">{{ courseStat(units).done }}/{{ courseStat(units).total }}</span>
        </div>
        <ul class="pp-units">
          <li v-for="u in units" :key="u.id" class="pp-unit">
            <span class="ut-pill" :class="'ut-' + (statusOf[u.id] || 'not_started')">
              {{ statusOf[u.id] === 'completed' ? '✓' : statusOf[u.id] === 'in_progress' ? '▶' : '○' }}
            </span>
            <a :href="u.path">{{ u.title }}</a>
            <code class="pp-id">{{ u.id }}</code>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.progress-panel { margin: 0.8rem 0 1.4rem; }
.pp-summary { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.6rem; }
.pp-hint, .pp-error { color: #64748b; font-size: 0.9rem; }
.pp-error { color: #b91c1c; }
.pp-course { margin: 0.7rem 0; padding: 0.7rem 1rem; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
.pp-course-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
.pp-count { color: #64748b; font-size: 0.85rem; }
.pp-units { list-style: none; margin: 0; padding: 0; }
.pp-unit { display: flex; align-items: center; gap: 0.6rem; padding: 0.15rem 0; }
.pp-unit a { color: #1d4ed8; }
.pp-id { font-size: 0.75rem; color: #94a3b8; }
.ut-pill { padding: 0.05rem 0.6rem; border-radius: 999px; font-size: 0.8rem; color: #fff; min-width: 1.9rem; text-align: center; }
.ut-not_started { background: #94a3b8; }
.ut-in_progress { background: #f59e0b; }
.ut-completed { background: #10b981; }
</style>
