<script setup lang="ts">
// DailyScales - GitHub-style daily calendar (mot=green / conc=orange) + line chart.
// Data: local IndexedDB via tracker/db.js, event type 'daily_scale'
// (per-date latest wins). SSR-safe: all window/DB work happens in onMounted.
import { ref, computed, onMounted } from 'vue'
import { openDB, recordEvent, getDailyScales } from '../../../../tracker/db.js'

const RANGES = [7, 14, 30, 100]
const MOT_RGB = '16, 120, 60'     // green
const CONC_RGB = '217, 92, 8'     // orange

const loaded = ref(false)
const error = ref('')
const msg = ref('')
const dbRef = ref<IDBDatabase | null>(null)
const scales = ref<Record<string, { mot: number; conc: number }>>({})
const range = ref(30)
const selectedDate = ref('')
const mot = ref(5)
const conc = ref(5)
const saving = ref(false)

function pad(n: number) { return String(n).padStart(2, '0') }
function fmt(d: Date) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }
function today() {
  const d = new Date()
  return { str: fmt(d), date: d }
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

const rangeDates = computed<string[]>(() => {
  const end = new Date(today().date)
  const start = addDays(end, -(range.value - 1))
  const out: string[] = []
  for (let i = 0; i < range.value; i++) out.push(fmt(addDays(start, i)))
  return out
})
// calendar weeks (Mon-start columns)
const calendarCols = computed(() => {
  const end = today().date
  const first = addDays(end, -(range.value - 1))
  const monOff = (first.getDay() + 6) % 7
  const start = addDays(first, -monOff)
  const colCount = Math.ceil((range.value + monOff) / 7)
  const cols: { date: string; cell: Date }[][] = []
  for (let c = 0; c < colCount; c++) {
    const col: { date: string; cell: Date }[] = []
    for (let d = 0; d < 7; d++) {
      const cell = addDays(start, c * 7 + d)
      col.push({ date: fmt(cell), cell })
    }
    cols.push(col)
  }
  return cols
})

function alphaFor(v: number): number {
  if (!v) return 0
  if (v <= 2) return 0.10
  if (v <= 4) return 0.28
  if (v <= 6) return 0.5
  if (v <= 8) return 0.72
  return 0.95
}
const cellStyle = (d: string, rgb: string) => {
  const s = scales.value[d]
  const v = rgb === MOT_RGB ? (s ? s.mot : 0) : rgb === CONC_RGB ? (s ? s.conc : 0) : 0
  return { background: 'rgba(' + rgb + ',' + alphaFor(v) + ')' }
}

async function ensureDb() {
  if (!dbRef.value) dbRef.value = await openDB()
  return dbRef.value
}
async function refresh() {
  const db = await ensureDb()
  scales.value = await getDailyScales(db)
}
function pick(d: string) {
  selectedDate.value = d
  const s = scales.value[d]
  mot.value = s ? s.mot : 5
  conc.value = s ? s.conc : 5
  msg.value = ''
}
async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const db = await ensureDb()
    await recordEvent(db, {
      type: 'daily_scale', unitId: null,
      payload: { date: selectedDate.value, mot: Math.max(1, Math.min(10, mot.value)), conc: Math.max(1, Math.min(10, conc.value)) },
      source: 'manual'
    })
    await refresh()
    msg.value = 'saved ' + selectedDate.value + '  mot=' + mot.value + ' conc=' + conc.value
  } catch (e) { error.value = 'write failed: ' + (e as Error).message }
  finally { saving.value = false }
}

// ---------- line chart ----------
const PADL = 30, PADR = 14, PADT = 8, PADB = 26, H = 190
const chart = computed(() => {
  const W = Math.max(360, rangeDates.value.length * 14 + PADL + PADR)
  const innerW = W - PADL - PADR
  const innerH = H - PADT - PADB
  const x = (i: number) => PADL + (rangeDates.value.length === 1 ? 0 : (i / (rangeDates.value.length - 1)) * innerW)
  const y = (v: number) => PADT + innerH - (v / 10) * innerH
  const line = (key: 'mot' | 'conc') => {
    let d = '', cont = false
    rangeDates.value.forEach((ds, i) => {
      const v = scales.value[ds] ? scales.value[ds][key] : 0
      if (v > 0) { d += (cont ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); cont = true }
      else cont = false
    })
    return d
  }
  const yticks = [0, 2, 4, 6, 8, 10]
  const xlabels = rangeDates.value.length <= 14
    ? rangeDates.value
    : [rangeDates.value[0], rangeDates.value[Math.floor((rangeDates.value.length - 1) / 2)], rangeDates.value[rangeDates.value.length - 1]]
  const avg = (key: 'mot' | 'conc') => {
    const vs = rangeDates.value.map((d) => scales.value[d] ? scales.value[d][key] : 0).filter((v) => v > 0)
    return vs.length ? (vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1) : '—'
  }
  return { W, lineM: line('mot'), lineC: line('conc'), yticks, xlabels, x, y, avgM: avg('mot'), avgC: avg('conc') }
})

onMounted(async () => {
  try {
    await ensureDb()
    await refresh()
  } catch (e) { error.value = 'no local storage: ' + (e as Error).message }
  pick(today().str)
  loaded.value = true
})
</script>

<template>
  <div class="ds">
    <p v-if="error" class="ds-err">! {{ error }}</p>
    <p v-else-if="!loaded" class="ds-mut">reading local state ...</p>
    <template v-else>
      <!-- range switcher -->
      <div class="ds-bar">
        <button v-for="r in RANGES" :key="r" class="ds-range" :class="{ on: r === range }" @click="range = r">{{ r }}天</button>
        <span class="ds-stats">avg mot {{ chart.avgM }} · conc {{ chart.avgC }}</span>
      </div>

      <!-- calendar -->
      <div class="ds-sec">cal: {{ range }} days (click a day to fill / edit)</div>
      <div class="ds-cal">
        <div v-for="(col, ci) in calendarCols" :key="ci" class="ds-col">
          <button
            v-for="c in col" :key="c.date"
            class="ds-cell"
            :class="{ today: c.date === selectedDate }"
            :disabled="c.date > today().str"
            :title="c.date + ' mot=' + (scales[c.date] ? scales[c.date].mot : '-') + ' conc=' + (scales[c.date] ? scales[c.date].conc : '-')"
            @click="pick(c.date)"
          >
            <span class="ds-half" :style="cellStyle(c.date, MOT_RGB)"></span>
            <span class="ds-half" :style="cellStyle(c.date, CONC_RGB)"></span>
          </button>
        </div>
      </div>

      <!-- input form -->
      <div class="ds-sec">rate: {{ selectedDate }}</div>
      <div class="ds-form">
        <span class="ds-label" style="color:#14532d">mot</span>
        <button class="ds-step" @click="mot = Math.max(1, mot - 1)">-</button>
        <span class="ds-val">{{ mot }}</span>
        <button class="ds-step" @click="mot = Math.min(10, mot + 1)">+</button>

        <span class="ds-label" style="color:#7c2d12; margin-left:1.2rem">conc</span>
        <button class="ds-step" @click="conc = Math.max(1, conc - 1)">-</button>
        <span class="ds-val">{{ conc }}</span>
        <button class="ds-step" @click="conc = Math.min(10, conc + 1)">+</button>

        <button class="ds-save" :disabled="saving" @click="save">[ 保存 ]</button>
        <span class="ds-msg">{{ msg }}</span>
      </div>

      <!-- line chart -->
      <div class="ds-sec">trend (7/14/30/100d)</div>
      <svg class="ds-svg" :viewBox="'0 0 ' + chart.W + ' ' + H" preserveAspectRatio="none" role="img" aria-label="mot/concentration trend">
        <g v-for="ty in chart.yticks" :key="ty">
          <line class="ds-grid" :x1="PADL" :x2="chart.W - PADR" :y1="chart.y(ty)" :y2="chart.y(ty)" />
          <text class="ds-tick" :x="PADL - 6" :y="chart.y(ty) + 3">{{ ty }}</text>
        </g>
        <g v-for="(lab, i) in chart.xlabels" :key="lab + i">
          <text class="ds-tick ds-x" :x="chart.x(i * (rangeDates.length - 1) / Math.max(1, chart.xlabels.length - 1))" :y="H - 8">{{ lab }}</text>
        </g>
        <path v-if="chart.lineM" class="ds-line-mot" :d="chart.lineM" />
        <path v-if="chart.lineC" class="ds-line-conc" :d="chart.lineC" />
      </svg>
      <div class="ds-legend">
        <span class="ds-legend-item"><i class="ds-dot" style="background:#16a43a"></i>mot</span>
        <span class="ds-legend-item"><i class="ds-dot" style="background:#d95c08"></i>conc</span>
        <span class="ds-note">cal cell: top = mot, bottom = conc; deeper = higher (1-10)</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ds { font-size: 0.92rem; margin: 0.5rem 0 1.4rem; }
.ds-err { color: var(--err); }
.ds-mut { color: var(--muted); }
.ds-bar { display: flex; align-items: center; gap: 0.4rem; margin: 0.4rem 0 0.8rem; flex-wrap: wrap; }
.ds-range {
  border: 1px solid var(--dimline); background: none; color: var(--muted);
  cursor: pointer; font: inherit; font-size: 0.84rem; padding: 0.1rem 0.6rem;
}
.ds-range.on { background: #000; color: #fff; border-color: #000; }
.ds-stats { color: var(--muted); font-size: 0.82rem; margin-left: auto; }
.ds-sec { color: var(--muted); font-size: 0.82rem; margin: 1rem 0 0.4rem; }
.ds-cal { display: flex; gap: 3px; overflow-x: auto; padding-bottom: 0.3rem; }
.ds-col { display: flex; flex-direction: column; gap: 3px; }
.ds-cell {
  width: 15px; height: 15px; padding: 0; border: 1px solid var(--dimline);
  background: #fafafa; cursor: pointer; display: flex; flex-direction: column; overflow: hidden;
}
.ds-cell:hover { border-color: #000; }
.ds-cell.today { outline: 1px solid #000; outline-offset: 1px; }
.ds-cell:disabled { opacity: 0.35; cursor: default; }
.ds-half { flex: 1; display: block; }
.ds-form { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin: 0.3rem 0 0.4rem; }
.ds-label { font-weight: 700; }
.ds-step {
  border: 1px solid var(--dimline); background: none; cursor: pointer;
  font: inherit; width: 1.6rem; height: 1.6rem; line-height: 1;
}
.ds-step:hover { border-color: #000; }
.ds-val { min-width: 1.2rem; text-align: center; font-weight: 700; }
.ds-save {
  margin-left: 0.6rem; border: 1px solid var(--dimline); background: none;
  color: #000; cursor: pointer; font: inherit; padding: 0.15rem 0.7rem;
}
.ds-save:hover:not(:disabled) { background: #000; color: #fff; }
.ds-msg { color: var(--muted); font-size: 0.82rem; }
.ds-svg { width: 100%; height: 200px; border: 1px solid var(--dimline); background: #fff; display: block; }
.ds-grid { stroke: var(--dimline); stroke-width: 0.6; }
.ds-tick { fill: var(--muted); font-size: 9px; font-family: var(--mono); }
.ds-x { text-anchor: middle; }
.ds-line-mot { fill: none; stroke: #16a43a; stroke-width: 1.6; }
.ds-line-conc { fill: none; stroke: #d95c08; stroke-width: 1.6; }
.ds-legend { display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem; font-size: 0.84rem; flex-wrap: wrap; }
.ds-legend-item { display: inline-flex; align-items: center; gap: 0.35rem; }
.ds-dot { width: 0.7rem; height: 0.7rem; display: inline-block; }
.ds-note { color: var(--muted); font-size: 0.78rem; margin-left: auto; }
</style>
