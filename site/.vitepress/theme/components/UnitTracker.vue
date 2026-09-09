<script setup lang="ts">
// UnitTracker —— ASCII 版: 纯文本状态行 + 括号按钮, 无卡片/彩色胶囊。
import { ref, computed, onMounted } from 'vue'
import { openDB, recordEvent, getUnitState } from '../../../../tracker/db.js'

const props = defineProps<{ unitId: string }>()

interface St {
  status: 'not_started' | 'in_progress' | 'completed'
  openCount: number
  completedAt: string | null
}
const state = ref<St | null>(null)
const busy = ref(false)
const error = ref('')
let db: IDBDatabase | null = null

const mark = computed(() => (state.value?.status === 'completed' ? '[x]' : state.value?.status === 'in_progress' ? '[~]' : '[ ]'))
const statusZh = computed(() => (state.value?.status === 'completed' ? '已完成' : state.value?.status === 'in_progress' ? '学习中' : '未开始'))
const date = computed(() => state.value?.completedAt?.slice(0, 10) ?? '')

async function ensureDb() { if (!db) db = await openDB(); return db }
async function refresh() {
  const d = await ensureDb()
  state.value = (await getUnitState(d, props.unitId)) as St
}
async function onToggle() {
  if (!state.value || busy.value) return
  busy.value = true; error.value = ''
  try {
    const d = await ensureDb()
    await recordEvent(d, {
      type: state.value.status === 'completed' ? 'unit_uncomplete' : 'unit_complete',
      unitId: props.unitId, payload: { via: 'unit-widget' }
    })
    await refresh()
  } catch (e) { error.value = 'write failed: ' + (e as Error).message }
  finally { busy.value = false }
}
onMounted(async () => {
  try {
    const d = await ensureDb()
    await recordEvent(d, { type: 'unit_open', unitId: props.unitId, payload: { via: 'page' } })
    await refresh()
  } catch (e) { error.value = 'no local storage: ' + (e as Error).message }
})
</script>

<template>
  <div class="ut">
    <p v-if="error" class="ut-err">! {{ error }}</p>
    <p v-else-if="!state" class="ut-mut">reading local state ...</p>
    <template v-else>
      <p class="ut-line"><span class="ut-mark">{{ mark }}</span> {{ statusZh }}<span> | open:{{ state.openCount }}</span><span v-if="state.completedAt"> | completed: {{ date }}</span><span class="ut-mut"> (local)</span></p>
      <p class="ut-line">
        <button class="ut-btn" :disabled="busy" @click="onToggle">{{ state.status === 'completed' ? '[ 撤销完成 ]' : '[ 标记完成 ]' }}</button>
        <span class="ut-mut"> indexdb / 实时落盘</span>
      </p>
    </template>
  </div>
</template>

<style scoped>
.ut { margin: 0.7rem 0 1.1rem; font-size: 0.92rem; }
.ut-line { margin: 0.2rem 0; }
.ut-mark { color: var(--accent); }
.ut-mut { color: var(--muted); }
.ut-err { color: #e5534b; }
.ut-btn {
  background: none; border: 1px solid var(--border); color: var(--accent);
  cursor: pointer; font: inherit; font-size: 0.92rem; padding: 0.15rem 0.5rem;
}
.ut-btn:hover:not(:disabled) { color: var(--bg); background: var(--accent); border-color: var(--accent); }
.ut-btn:disabled { opacity: 0.5; cursor: default; }
</style>
