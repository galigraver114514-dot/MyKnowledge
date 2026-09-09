<script setup lang="ts">
// NodeView - node-mode second view (specs/node-model.md).
// Nodes come from nodes.gen.json (mechanical extractor; ai-auto later).
// Layout: clusters are aggregated AT RUNTIME from node labels for the active
// dimension (emergence - no stored cluster table). Equal-weight tokens.
import { ref, computed } from 'vue'
import raw from '../nodes.gen.json'
import { useT } from '../i18n'
const { t } = useT()
const UNLABELED = '(unlabeled)'

const props = defineProps<{ pagePath: string }>()

interface NodeT {
  id: string; name: string; kind: string; origin: string
  definition: string | null
  labels: Record<string, string[]>
}
interface PageT { path: string; id: string | null; dims: string[] | null; nodes: NodeT[] }

const data = raw as { pages: PageT[] }
const page = computed<PageT | null>(() => data.pages.find((p) => p.path === props.pagePath) || null)

const dims = computed<string[]>(() => {
  const wl = page.value?.dims || []
  const have = new Set<string>()
  for (const n of page.value?.nodes || []) for (const d of Object.keys(n.labels || {})) have.add(d)
  const extras = [...have].filter((d) => !wl.includes(d))
  return [...wl, ...extras]
})

const active = ref<string | null>(null)
if (!active.value) active.value = dims.value[0] || null

const clusters = computed(() => {
  const dim = active.value
  const map = new Map<string, NodeT[]>()
  for (const n of page.value?.nodes || []) {
    const tag = dim ? (n.labels?.[dim] || [])[0] : null
    const key = tag || UNLABELED
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(n)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh'))
})

const HUES = [205, 25, 150, 285, 340, 45, 190, 265, 15, 130]
const hueOf = (i: number) => HUES[i % HUES.length]
const clusterStyle = (i: number) => ({ '--nv-h': hueOf(i) + '' } as Record<string, string>)
const tokenStyle = (i: number) => ({ '--nv-h': hueOf(i) + '' } as Record<string, string>)
</script>

<template>
  <div class="nv">
    <template v-if="page && page.nodes.length">
      <div class="nv-head">
        <span class="nv-title">{{ t('nv.nodeview') }}</span>
        <button
          v-for="d in dims" :key="d" class="nv-dim"
          :class="{ on: d === active }" @click="active = d"
        >{{ d }}</button>
        <span class="nv-count">{{ page.nodes.length }} {{ t('nv.ncount') }} {{ clusters.length }} {{ t('nv.clusters') }} [{{ active || '—' }}]</span>
      </div>
      <div class="nv-grid">
        <div v-for="(c, i) in clusters" :key="c[0]" class="nv-cluster" :style="clusterStyle(i)">
          <div class="nv-cluster-name">{{ c[0] === UNLABELED ? t('nv.unlabeled') : c[0] }} <span class="nv-n">{{ c[1].length }}</span></div>
          <div class="nv-tokens">
            <span v-for="(n, j) in c[1]" :key="n.id" class="nv-token" :style="tokenStyle(i)"
              :title="(n.definition || '') + (n.origin ? '  [' + n.origin + ']' : '')">{{ n.name }}</span>
          </div>
        </div>
      </div>
    </template>
    <p v-else class="nv-empty">{{ t('nv.none') }}</p>
  </div>
</template>

<style scoped>
.nv { margin: 0.7rem 0 1.2rem; }
.nv-head { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
.nv-title { font-weight: 700; }
.nv-dim {
  border: 1px solid var(--dimline); background: none; color: var(--muted);
  cursor: pointer; font: inherit; font-size: 0.85rem; padding: 0.05rem 0.5rem;
}
.nv-dim:hover { color: #000; border-color: #000; }
.nv-dim.on { background: #000; color: #fff; border-color: #000; }
.nv-count { color: var(--muted); font-size: 0.8rem; }
.nv-grid { display: flex; flex-direction: column; gap: 0.5rem; }
.nv-cluster {
  border: 1px solid hsl(var(--nv-h) 65% 55%);
  border-left-width: 4px;
  padding: 0.35rem 0.6rem 0.45rem;
}
.nv-cluster-name { font-size: 0.82rem; font-weight: 700; color: hsl(var(--nv-h) 60% 38%); margin-bottom: 0.25rem; }
.nv-n { color: var(--muted); font-weight: 400; }
.nv-tokens { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.nv-token {
  font-size: 0.88rem; padding: 0.05rem 0.5rem; cursor: default;
  color: #000; border: 1px solid hsl(var(--nv-h) 60% 70%);
  background: hsl(var(--nv-h) 85% 96%);
}
.nv-token:hover { border-color: #000; }
.nv-empty { color: var(--muted); font-size: 0.85rem; }
</style>
