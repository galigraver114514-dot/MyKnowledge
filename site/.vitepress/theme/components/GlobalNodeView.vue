<script setup lang="ts">
// GlobalNodeView - whole-graph view across units/chapters (specs/node-model.md).
// Joins all node-mode pages: the same concept (same normalized name) appearing
// in several units becomes ONE node with per-unit occurrences; clusters are
// aggregated at runtime over the active dimension, spanning chapters.
import { ref, computed } from 'vue'
import { withBase } from 'vitepress'
import raw from '../nodes.gen.json'
import { PAGE_META } from '../nav'
import { useT } from '../i18n'
const { t } = useT()

interface NodeT {
  id: string; name: string; kind: string; origin: string
  definition: string | null
  labels: Record<string, string[]>
}
interface PageT { path: string; id: string | null; dims: string[] | null; nodes: NodeT[] }
interface UnitOcc { path: string; title: string; definition: string | null }

const data = raw as { pages: PageT[] }

const unitTitle = (p: string) => (PAGE_META[p]?.title) || p.split('/').pop() || p

// merge same-name nodes across pages into one graph node (occurrences preserved)
const merged = computed(() => {
  const map = new Map<string, {
    name: string; kind: string; occ: UnitOcc[]; dims: Record<string, string[]>
  }>()
  for (const page of data.pages) {
    for (const n of page.nodes || []) {
      const key = n.name.trim().toLowerCase()
      if (!map.has(key)) map.set(key, { name: n.name, kind: n.kind, occ: [], dims: {} })
      const m = map.get(key)!
      if (!m.occ.some((o) => o.path === page.path)) {
        m.occ.push({ path: page.path, title: unitTitle(page.path), definition: n.definition })
      }
      for (const [d, tags] of Object.entries(n.labels || {})) {
        if (!m.dims[d]) m.dims[d] = []
        for (const t of tags) if (!m.dims[d].includes(t)) m.dims[d].push(t)
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
})

const unitCount = computed(() => data.pages.filter((p) => (p.nodes || []).length > 0).length)

const dims = computed(() => {
  const have: string[] = []
  for (const page of data.pages) for (const d of page.dims || []) if (!have.includes(d)) have.push(d)
  for (const m of merged.value) for (const d of Object.keys(m.dims)) if (!have.includes(d)) have.push(d)
  return have
})

const active = ref<string | null>(null)
if (!active.value) active.value = dims.value[0] || null

const clusters = computed(() => {
  const dim = active.value
  const map = new Map<string, typeof merged.value>()
  for (const m of merged.value) {
    const tags = dim ? (m.dims[dim] || []) : []
    const key = tags[0] || '(未标注)'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh'))
})
const nodeTotal = computed(() => merged.value.length)
const HUES = [205, 25, 150, 285, 340, 45, 190, 265, 15, 130]
const hueOf = (i: number) => HUES[i % HUES.length]
const clusterStyle = (i: number) => ({ '--nv-h': hueOf(i) + '' } as Record<string, string>)
</script>

<template>
  <div class="gv">
    <p v-if="!merged.length" class="gv-empty">
      no node data yet — enable nodeMode on units (and prefer structured content) first.
    </p>
    <template v-else>
      <div class="gv-head">
        <span class="gv-title">{{ t('gv.graph') }}</span>
        <button v-for="d in dims" :key="d" class="gv-dim" :class="{ on: d === active }" @click="active = d">{{ d }}</button>
        <span class="gv-count">{{ nodeTotal }} {{ t('gv.concepts') }} · {{ unitCount }} {{ t('gv.units') }} · {{ clusters.length }} {{ t('gv.clusters') }} [{{ active || '—' }}]</span>
      </div>
      <div class="gv-grid">
        <div v-for="(c, i) in clusters" :key="c[0]" class="gv-cluster" :style="clusterStyle(i)">
          <div class="gv-cluster-name">{{ c[0] }} <span class="gv-n">{{ c[1].length }}</span></div>
          <div class="gv-tokens">
            <a
              v-for="m in c[1]" :key="m.name" class="gv-token" :style="clusterStyle(i)"
              :href="withBase(m.occ[0].path)"
              :title="'[' + m.occ.map((o) => o.title).join(', ') + '] ' + m.occ.map((o) => o.definition || '').join(' / ')"
            >{{ m.name }}<span v-if="m.occ.length > 1" class="gv-x">{{ m.occ.length }}</span></a>
          </div>
        </div>
      </div>
      <p class="gv-hint">{{ t('gv.hint') }}</p>
    </template>
  </div>
</template>

<style scoped>
.gv { margin: 0.7rem 0 1.2rem; }
.gv-head { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.7rem; }
.gv-title { font-weight: 700; }
.gv-dim {
  border: 1px solid var(--dimline); background: none; color: var(--muted);
  cursor: pointer; font: inherit; font-size: 0.85rem; padding: 0.05rem 0.55rem;
}
.gv-dim:hover { color: #000; border-color: #000; }
.gv-dim.on { background: #000; color: #fff; border-color: #000; }
.gv-count { color: var(--muted); font-size: 0.8rem; }
.gv-grid { display: flex; flex-direction: column; gap: 0.5rem; }
.gv-cluster {
  border: 1px solid hsl(var(--nv-h) 60% 60%);
  border-left-width: 4px; padding: 0.35rem 0.6rem 0.45rem;
}
.gv-cluster-name { font-size: 0.82rem; font-weight: 700; color: hsl(var(--nv-h) 60% 38%); margin-bottom: 0.3rem; }
.gv-n { color: var(--muted); font-weight: 400; }
.gv-tokens { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.gv-token {
  font-size: 0.88rem; padding: 0.05rem 0.5rem; text-decoration: none;
  color: #000; border: 1px solid hsl(var(--nv-h) 60% 70%);
  background: hsl(var(--nv-h) 85% 96%); position: relative;
}
.gv-token:hover { border-color: #000; text-decoration: none; }
.gv-x {
  margin-left: 0.35rem; font-size: 0.68rem; color: var(--muted);
  border: 1px solid var(--dimline); border-radius: 2px; padding: 0 0.2rem;
}
.gv-hint, .gv-empty { color: var(--muted); font-size: 0.8rem; }
</style>
