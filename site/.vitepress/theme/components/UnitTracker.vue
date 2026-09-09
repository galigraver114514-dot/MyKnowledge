<script setup lang="ts">
// UnitTracker —— 单元页完成挂件 (N5)
// 数据底座: tracker/db.js (IndexedDB, 事件日志为唯一事实)。所有写入即时落盘、仅存本机。
// SSR 安全: 逻辑全部在 onMounted (客户端) 执行, 服务端只渲染占位。
import { ref, onMounted } from 'vue'
import { openDB, recordEvent, getUnitState } from '../../../../tracker/db.js'

const props = defineProps<{ unitId: string }>()

interface St {
  status: 'not_started' | 'in_progress' | 'completed'
  openCount: number
  completedAt: string | null
  lastTs: string | null
}

const state = ref<St | null>(null)
const busy = ref(false)
const error = ref('')
let db: IDBDatabase | null = null

async function ensureDb() {
  if (!db) db = await openDB()
  return db
}

async function refresh() {
  const d = await ensureDb()
  state.value = (await getUnitState(d, props.unitId)) as St
}

async function onToggle() {
  if (!state.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const d = await ensureDb()
    const done = state.value.status === 'completed'
    await recordEvent(d, {
      type: done ? 'unit_uncomplete' : 'unit_complete',
      unitId: props.unitId,
      payload: { via: 'unit-widget', prev: state.value.status }
    })
    await refresh()
  } catch (e) {
    error.value = '写入失败: ' + (e as Error).message
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  try {
    const d = await ensureDb()
    await recordEvent(d, { type: 'unit_open', unitId: props.unitId, payload: { via: 'page' } })
    await refresh()
  } catch (e) {
    error.value = '无法访问本机存储: ' + (e as Error).message
  }
})
</script>

<template>
  <div class="unit-tracker">
    <p v-if="error" class="ut-error">{{ error }}</p>
    <p v-else-if="!state" class="ut-hint">读取本机进度…</p>
    <template v-else>
      <div class="ut-row">
        <span class="ut-pill" :class="'ut-' + state.status">
          {{ state.status === 'completed' ? '已完成' : state.status === 'in_progress' ? '学习中' : '未开始' }}
        </span>
        <span class="ut-meta">打开 {{ state.openCount }} 次</span>
        <span v-if="state.completedAt" class="ut-meta">完成于 {{ state.completedAt.slice(0, 10) }}</span>
      </div>
      <div class="ut-row">
        <button class="ut-btn" :disabled="busy" @click="onToggle">
          {{ state.status === 'completed' ? '撤销完成（重新学习）' : '标记本单元完成' }}
        </button>
        <span class="ut-note">仅存本机浏览器 · 实时落盘 · 可导出复原</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.unit-tracker {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
  background: #f8fafc;
  margin: 0.6rem 0 1.2rem;
}
.ut-row { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; margin: 0.2rem 0; }
.ut-pill { padding: 0.1rem 0.7rem; border-radius: 999px; font-size: 0.85rem; color: #fff; }
.ut-not_started { background: #94a3b8; }
.ut-in_progress { background: #f59e0b; }
.ut-completed { background: #10b981; }
.ut-meta { color: #64748b; font-size: 0.85rem; }
.ut-btn {
  padding: 0.35rem 0.9rem; border-radius: 6px; border: 1px solid #cbd5e1;
  background: #fff; cursor: pointer; font-size: 0.9rem;
}
.ut-btn:hover:not(:disabled) { border-color: #3b82f6; color: #1d4ed8; }
.ut-btn:disabled { opacity: 0.6; cursor: wait; }
.ut-note { color: #94a3b8; font-size: 0.78rem; }
.ut-error { color: #b91c1c; font-size: 0.85rem; }
.ut-hint { color: #94a3b8; font-size: 0.9rem; margin: 0; }
</style>
