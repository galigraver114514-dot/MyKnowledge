<script setup lang="ts">
// ProgressPanel - progress panel for the learning map.
// Units come from the generated catalog (scripts/gen-catalog.mjs), the same
// source the nav tree uses - no manual registry to keep in sync.
// Read-only derived state; never writes events. Logic runs in onMounted.
import { ref, computed, onMounted } from 'vue'
import { withBase } from 'vitepress'
import { openDB, getState } from '../../../../tracker/db.js'
import { UNITS } from '../nav'

type Status = 'not_started' | 'in_progress' | 'completed'
const statusOf = ref<Record<string, Status>>({})
const loaded = ref(false)
const error = ref('')
const hasData = ref(false)

const courses = Object.entries(UNITS.reduce<Record<string, typeof UNITS>>((acc, u) => {
  ;(acc[u.course] ||= []).push(u); return acc
}, {}))

function bar(done: number, total: number) {
  const w = 10
  const fill = total ? Math.round((w * done) / total) : 0
  return '#'.repeat(fill) + '.'.repeat(w - fill)
}
function stat(units: typeof UNITS) {
  const done = units.filter((u) => statusOf.value[u.id] === 'completed').length
  return { done, total: units.length }
}
function pad(s: string, n: number) { return (s + ' '.repeat(n)).slice(0, n) }
function m(u: { id: string }) {
  return statusOf.value[u.id] === 'completed' ? '[x]' : statusOf.value[u.id] === 'in_progress' ? '[~]' : '[ ]'
}
const all = computed(() => stat(UNITS))

onMounted(async () => {
  try {
    const db = await openDB()
    const map = await getState(db)
    hasData.value = map.size > 0
    for (const u of UNITS) { const s = map.get(u.id); if (s) statusOf.value[u.id] = (s as { status: Status }).status }
  } catch (e) { error.value = 'no local state: ' + (e as Error).message }
  finally { loaded.value = true }
})
</script>

<template>
  <div class="pp">
    <p v-if="error" class="pp-err">! {{ error }}</p>
    <p v-else-if="!loaded" class="pp-mut">reading local progress ...</p>
    <template v-else>
      <p v-if="!hasData" class="pp-mut">
        no local records yet -- open any unit page to start tracking,<br>
        or seed it via <code>npm run demo</code> (tracker 演示页).
      </p>
      <template v-else>
        <p class="pp-total">TOTAL: {{ all.done }}/{{ all.total }} [{{ bar(all.done, all.total) }}]</p>
        <div v-for="(units, course) in courses" :key="course" class="pp-course">
          <p class="pp-head">{{ pad(course, 10) }} {{ stat(units).done }}/{{ stat(units).total }} [{{ bar(stat(units).done, stat(units).total) }}]</p>
          <p v-for="u in units" :key="u.id" class="pp-unit"><span class="pp-m">{{ m(u) }}</span> <a :href="withBase(u.path)">{{ u.title }}</a></p>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.pp { font-size: 0.92rem; margin: 0.6rem 0 1.2rem; }
.pp-total, .pp-course { margin: 0.3rem 0; }
.pp-head, .pp-unit { margin: 0.18rem 0; white-space: pre; }
.pp-m, .pp-total, .pp-head { color: var(--accent); }
.pp-mut { color: var(--muted); }
.pp-err { color: var(--err); }
.pp-unit { margin-left: 2ch; }
.pp-unit a { color: var(--fg); }
.pp-unit a:hover { color: var(--accent); }
</style>
