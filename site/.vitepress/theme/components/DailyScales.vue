<script setup lang="ts">
// DailyScales - GitHub-style calendar (switch mot=green / conc=orange) +
// 10-square picker + dual line chart with hover crosshair.
// Data: local IndexedDB (event 'daily_scale', per-date latest wins).
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { openDB, recordEvent, getDailyScales, clearDailyScale } from '../../../../tracker/db.js'
import { useT } from '../i18n'
const { t } = useT()
const fmtT = (k: string, m: Record<string, string | number>) => {
  let s = t(k)
  for (const key of Object.keys(m)) s = s.split('{' + key + '}').join(String(m[key]))
  return s
}

const RANGES = [7, 14, 30, 100]
const METRICS = {
  mot: { rgb: '16, 120, 60', solid: '#16803c', label: 'mot' },
  conc: { rgb: '217, 92, 8', solid: '#d95c08', label: 'conc' }
} as const
type Metric = keyof typeof METRICS

const loaded = ref(false)
const error = ref('')
const msg = ref('')
const dbRef = ref<IDBDatabase | null>(null)
const scales = ref<Record<string, { mot: number; conc: number }>>({})
const range = ref(30)
const mode = ref<Metric>('mot')
const selectedDate = ref('')
const mot = ref(5)
const conc = ref(5)
const saving = ref(false)
const saveErr = ref('')
const chartWrap = ref<HTMLElement | null>(null)
const width = ref(0)
const hoverIdx = ref<number | null>(null)
let ro: ResizeObserver | null = null

function pad(n: number) { return String(n).padStart(2, '0') }
function fmt(d: Date) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }
function today() { const d = new Date(); return { str: fmt(d), date: d } }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

const rangeDates = computed<string[]>(() => {
  const end = today().date
  const start = addDays(end, -(range.value - 1))
  const out: string[] = []
  for (let i = 0; i < range.value; i++) out.push(fmt(addDays(start, i)))
  return out
})
const calendarCols = computed(() => {
  const end = today().date
  const first = addDays(end, -(range.value - 1))
  const monOff = (first.getDay() + 6) % 7
  const start = addDays(first, -monOff)
  const colCount = Math.ceil((range.value + monOff) / 7)
  const cols: { date: string; cell: Date }[][] = []
  for (let c = 0; c < colCount; c++) {
    const col: { date: string; cell: Date }[] = []
    for (let d = 0; d < 7; d++) { const cell = addDays(start, c * 7 + d); col.push({ date: fmt(cell), cell }) }
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
const cellStyle = (d: string) => {
  const s = scales.value[d]
  const v = s ? s[mode.value] : 0
  const rgb = METRICS[mode.value].rgb
  return { background: 'rgba(' + rgb + ',' + alphaFor(v) + ')' }
}

function setScore(k: number) {
  if (mode.value === 'mot') mot.value = k; else conc.value = k
}
async function ensureDb() {
  if (!dbRef.value) dbRef.value = await openDB()
  return dbRef.value
}
async function refresh() { const db = await ensureDb(); scales.value = await getDailyScales(db) }
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
  saveErr.value = ''
  try {
    const db = await ensureDb()
    const ev = await recordEvent(db, {
      type: 'daily_scale', unitId: null,
      payload: { date: selectedDate.value, mot: mot.value, conc: conc.value },
      source: 'manual'
    })
    // Single-writer path: the event we just committed is by definition the
    // latest for this date - upsert locally, do NOT re-read (re-read raced
    // with the write and occasionally reverted the UI).
    scales.value = { ...scales.value, [ev.payload.date]: { mot: mot.value, conc: conc.value } }
    console.info('[DailyScales] saved event ' + ev.id + ' for ' + ev.payload.date)
    msg.value = fmtT('ds.saved', { d: ev.payload.date, m: mot.value, c: conc.value })
  } catch (e) {
    saveErr.value = (e as Error).message || String(e)
    console.error('[DailyScales save]', e)
  }
  finally { saving.value = false }
}
// two-step in-page confirm (no native window.confirm)
const confirmClear = ref(false)
function onClearClick() {
  if (confirmClear.value) performClear()
  else { confirmClear.value = true; msg.value = '' }
}
const clearAsk = () => fmtT('ds.ask', { d: selectedDate.value })
function cancelClear() { confirmClear.value = false }
async function performClear() {
  if (saving.value) return
  saving.value = true
  saveErr.value = ''
  try {
    const db = await ensureDb()
    const n = await clearDailyScale(db, selectedDate.value)
    const next = { ...scales.value }
    delete next[selectedDate.value]
    scales.value = next
    msg.value = n ? fmtT('ds.cleared', { d: selectedDate.value, n }) : fmtT('ds.norecord', { d: selectedDate.value })
  } catch (e) {
    saveErr.value = (e as Error).message || String(e)
    console.error('[DailyScales clear]', e)
  }
  finally { saving.value = false; confirmClear.value = false }
}

// ---------- line chart (pixel width, no stretching) ----------
const PADL = 34, PADR = 16, PADT = 10, PADB = 22, H = 190
const chart = computed(() => {
  const W = Math.max(360, width.value || 640)
  const n = rangeDates.value.length
  const innerW = W - PADL - PADR
  const innerH = H - PADT - PADB
  const x = (i: number) => PADL + (n <= 1 ? 0 : (i / (n - 1)) * innerW)
  const y = (v: number) => PADT + innerH - (v / 10) * innerH
  const pts = (key: Metric) => rangeDates.value.map((ds, i) => {
    const v = scales.value[ds] ? scales.value[ds][key] : 0
    return { i, x: x(i), y: y(v), v, date: ds }
  })
  const path = (list: { x: number; y: number; v: number }[]) => {
    let d = '', cont = false
    for (const p of list) {
      if (p.v > 0) { d += (cont ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); cont = true }
      else cont = false
    }
    return d
  }
  const motPts = pts('mot'), concPts = pts('conc')
  const yticks = [0, 2, 4, 6, 8, 10]
  const avg = (key: Metric) => {
    const vs = rangeDates.value.map((d) => scales.value[d] ? scales.value[d][key] : 0).filter((v) => v > 0)
    return vs.length ? (vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1) : '—'
  }
  return { W, pathM: path(motPts), pathC: path(concPts), motPts, concPts, x, y, yticks, avgM: avg('mot'), avgC: avg('conc') }
})

function onMove(e: MouseEvent) {
  if (!chartWrap.value) return
  const rect = chartWrap.value.getBoundingClientRect()
  const rel = e.clientX - rect.left
  const n = rangeDates.value.length
  const innerW = chart.value.W - PADL - PADR
  const step = n <= 1 ? 0 : innerW / (n - 1)
  const idx = Math.round((rel - PADL) / step)
  hoverIdx.value = Math.max(0, Math.min(n - 1, idx))
}
const tip = computed(() => {
  if (hoverIdx.value == null) return null
  const d = rangeDates.value[hoverIdx.value]
  const s = scales.value[d]
  const X = chart.value.x(hoverIdx.value)
  return {
    left: Math.max(4, Math.min(chart.value.W - 170, X + 8)),
    date: d,
    mot: s ? s.mot : null,
    conc: s ? s.conc : null
  }
})

function measure() { if (chartWrap.value) width.value = chartWrap.value.clientWidth || 640 }
onMounted(async () => {
  window.addEventListener('resize', measure)
  try {
    await ensureDb(); await refresh()
  } catch (e) { error.value = 'no local storage: ' + (e as Error).message }
  pick(today().str)
  loaded.value = true
  await nextTick()
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure)
    if (chartWrap.value) ro.observe(chartWrap.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  ro?.disconnect()
})
</script>

<template>
  <div class="ds">
    <p v-if="error" class="ds-err">! {{ error }}</p>
    <p v-else-if="!loaded" class="ds-mut">{{ t('ds.reading') }}</p>
    <template v-else>
      <div class="ds-bar">
        <button v-for="r in RANGES" :key="r" class="ds-range" :class="{ on: r === range }" @click="range = r">{{ r }}{{ t('ds.days') }}</button>
        <span class="ds-stats">{{ t('ds.avg') }} mot {{ chart.avgM }} · conc {{ chart.avgC }}</span>
      </div>

      <!-- metric switch + calendar -->
      <div class="ds-switch">
        <button v-for="m in (['mot', 'conc'] as Metric[])" :key="m" class="ds-mode"
          :class="{ on: mode === m }" :style="mode === m ? { background: METRICS[m].solid, color: '#fff', borderColor: METRICS[m].solid } : {}"
          @click="mode = m">{{ m }}</button>
        <span class="ds-switch-note">{{ t('ds.calnote') }}</span>
      </div>
      <div class="ds-cal">
        <div v-for="(col, ci) in calendarCols" :key="ci" class="ds-col">
          <button v-for="c in col" :key="c.date" class="ds-cell" :class="{ today: c.date === selectedDate }"
            :disabled="c.date > today().str" :style="cellStyle(c.date)"
            :title="c.date + ' mot=' + (scales[c.date] ? scales[c.date].mot : '-') + ' conc=' + (scales[c.date] ? scales[c.date].conc : '-')"
            @click="pick(c.date)"></button>
        </div>
      </div>

      <!-- 10-square picker for the active metric on the selected date -->
      <div class="ds-sec">{{ selectedDate }} · {{ t('ds.fill') }} {{ mode }} (mot {{ mot }} / conc {{ conc }})</div>
      <div class="ds-picker">
        <button v-for="k in 10" :key="k" class="ds-box"
          :style="[{ borderColor: METRICS[mode].solid }, (mode === 'mot' ? mot : conc) >= k ? { background: METRICS[mode].solid, color: '#fff' } : {}]"
          @click="setScore(k)">{{ k }}</button>
        <template v-if="!confirmClear">
          <button class="ds-save" :disabled="saving" @click="save">{{ t('ds.save') }}</button>
          <button class="ds-clear" :disabled="saving" @click="onClearClick">{{ t('ds.clear') }}</button>
        </template>
        <template v-else>
          <span class="ds-clearask">{{ clearAsk() }}</span>
          <button class="ds-clear ds-clear-yes" :disabled="saving" @click="onClearClick">{{ t('ds.confirm') }}</button>
          <button class="ds-save" :disabled="saving" @click="cancelClear">{{ t('ds.cancel') }}</button>
        </template>
        <span class="ds-msg">{{ msg }}</span>
        <span v-if="saveErr" class="ds-err">! {{ saveErr }}</span>
      </div>

      <!-- line chart: hover to inspect, no date axis clutter -->
      <div class="ds-sec">{{ t('ds.trend') }}</div>
      <div ref="chartWrap" class="ds-chart" @mousemove="onMove" @mouseleave="hoverIdx = null">
        <svg :width="chart.W" :height="H" role="img" aria-label="mot/concentration trend">
          <g v-for="ty in chart.yticks" :key="ty">
            <line class="ds-grid" :x1="PADL" :x2="chart.W - PADR" :y1="chart.y(ty)" :y2="chart.y(ty)" />
            <text class="ds-tick" :x="PADL - 6" :y="chart.y(ty) + 3">{{ ty }}</text>
          </g>
          <line v-if="hoverIdx != null" class="ds-hline" :x1="chart.x(hoverIdx)" :x2="chart.x(hoverIdx)" :y1="PADT" :y2="H - PADB" />
          <path v-if="chart.pathM" class="ds-line-mot" :d="chart.pathM" />
          <path v-if="chart.pathC" class="ds-line-conc" :d="chart.pathC" />
          <template v-if="hoverIdx != null">
            <circle v-if="chart.motPts[hoverIdx] && chart.motPts[hoverIdx].v > 0" class="ds-dot-mot" :cx="chart.motPts[hoverIdx].x" :cy="chart.motPts[hoverIdx].y" r="3.2" />
            <circle v-if="chart.concPts[hoverIdx] && chart.concPts[hoverIdx].v > 0" class="ds-dot-conc" :cx="chart.concPts[hoverIdx].x" :cy="chart.concPts[hoverIdx].y" r="3.2" />
          </template>
        </svg>
        <div v-if="tip" class="ds-tip">
          <div class="ds-tip-date">{{ tip.date }}</div>
          <div><i class="ds-dot" style="background:#16803c"></i>mot: {{ tip.mot ?? '—' }}</div>
          <div><i class="ds-dot" style="background:#d95c08"></i>conc: {{ tip.conc ?? '—' }}</div>
        </div>
      </div>
      <div class="ds-legend">
        <span class="ds-legend-item"><i class="ds-dot" style="background:#16803c"></i>mot</span>
        <span class="ds-legend-item"><i class="ds-dot" style="background:#d95c08"></i>conc</span>
        <span class="ds-note">{{ t('ds.legend') }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ds { font-size: 0.92rem; margin: 0.5rem 0 1.4rem; }
.ds-err { color: var(--err); }
.ds-mut { color: var(--muted); }
.ds-bar, .ds-switch, .ds-picker, .ds-form { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.ds-bar { margin: 0.4rem 0 0.8rem; }
.ds-range, .ds-mode {
  border: 1px solid var(--dimline); background: none; color: var(--muted);
  cursor: pointer; font: inherit; font-size: 0.84rem; padding: 0.1rem 0.7rem;
}
.ds-range.on { background: #000; color: #fff; border-color: #000; }
.ds-switch { margin-bottom: 0.5rem; }
.ds-switch-note { color: var(--muted); font-size: 0.8rem; }
.ds-stats { color: var(--muted); font-size: 0.82rem; margin-left: auto; }
.ds-sec { color: var(--muted); font-size: 0.84rem; margin: 1rem 0 0.45rem; }
.ds-cal { display: flex; gap: 3px; overflow-x: auto; padding-bottom: 0.3rem; }
.ds-col { display: flex; flex-direction: column; gap: 3px; }
.ds-cell {
  width: 15px; height: 15px; padding: 0; border: 1px solid var(--dimline);
  background: #fafafa; cursor: pointer;
}
.ds-cell:hover { border-color: #000; }
.ds-cell.today { outline: 1px solid #000; outline-offset: 1px; }
.ds-cell:disabled { opacity: 0.3; cursor: default; }
.ds-picker { margin: 0.15rem 0; }
.ds-box {
  width: 2rem; height: 2rem; border: 1px solid var(--dimline); background: none;
  cursor: pointer; font: inherit; font-size: 0.85rem; color: var(--muted);
}
.ds-save {
  margin-left: 0.7rem; border: 1px solid var(--dimline); background: none;
  color: #000; cursor: pointer; font: inherit; padding: 0.2rem 0.7rem;
}
.ds-save:hover:not(:disabled) { background: #000; color: #fff; }
.ds-clear {
  border: 1px solid var(--dimline); background: none; color: var(--err);
  cursor: pointer; font: inherit; padding: 0.2rem 0.7rem;
}
.ds-clear:hover:not(:disabled) { background: var(--err); color: #fff; border-color: var(--err); }
.ds-clear-yes { background: var(--err); color: #fff; border-color: var(--err); font-weight: 700; }
.ds-clearask { color: var(--err); font-size: 0.85rem; }
.ds-msg { color: var(--muted); font-size: 0.82rem; }
.ds-chart { position: relative; overflow-x: auto; border: 1px solid var(--dimline); background: #fff; }
.ds-chart svg { display: block; }
.ds-grid { stroke: var(--dimline); stroke-width: 0.6; }
.ds-hline { stroke: #000; stroke-width: 0.8; stroke-dasharray: 2 2; }
.ds-tick { fill: var(--muted); font-size: 9px; font-family: var(--mono); }
.ds-line-mot { fill: none; stroke: #16803c; stroke-width: 1.6; }
.ds-line-conc { fill: none; stroke: #d95c08; stroke-width: 1.6; }
.ds-dot-mot { fill: #16803c; stroke: #fff; stroke-width: 0.8; }
.ds-dot-conc { fill: #d95c08; stroke: #fff; stroke-width: 0.8; }
.ds-tip {
  position: absolute; top: 6px; pointer-events: none; z-index: 5;
  border: 1px solid var(--dimline); background: #fff; color: #000;
  padding: 0.3rem 0.5rem; font-size: 0.8rem; line-height: 1.5;
}
.ds-tip-date { color: var(--muted); }
.ds-legend { display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem; font-size: 0.84rem; flex-wrap: wrap; }
.ds-legend-item { display: inline-flex; align-items: center; gap: 0.35rem; }
.ds-dot { width: 0.7rem; height: 0.7rem; display: inline-block; }
.ds-note { color: var(--muted); font-size: 0.78rem; margin-left: auto; }
</style>
