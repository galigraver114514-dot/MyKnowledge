<script setup lang="ts">
// PageContent - localized scaffold pages (follows the UI language).
// Renders the static copy of the intro pages; content components stay below.
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { useT, courseLabelOf, zhCourseOf } from '../i18n'
import { NAV } from '../nav'

const props = defineProps<{ page: string }>()
const { t, lang } = useT()
const dir = computed(() => (props.page === 'english' || props.page === 'math' ? props.page : ''))
const landing = computed(() => (dir.value ? '/' + dir.value + '/' : ''))
interface UnitL { title: string; path: string }
interface GroupL { title: string; dir: string | null; units: UnitL[] }
const course = computed<{ units: UnitL[]; groups: GroupL[] }>(() => {
  const g = (NAV as { kind: string; dir?: string | null; children: unknown[] }[]).find((n) => n.kind === 'group' && n.dir === dir.value)
  const out: { units: UnitL[]; groups: GroupL[] } = { units: [], groups: [] }
  if (!g) return out
  for (const c of g.children as { kind: string; path?: string; title: string; dir?: string | null; children?: unknown[] }[]) {
    if (c.kind === 'page') { if (c.path !== landing.value) out.units.push({ title: c.title, path: c.path as string }) }
    else if (c.children) out.groups.push({ title: c.title, dir: c.dir ?? null, units: (c.children as { path?: string; title: string }[]).filter((u) => u.path).map((u) => ({ title: u.title, path: u.path as string })) })
  }
  return out
})
const glabel = (gg: GroupL) => (gg.dir ? courseLabelOf(gg.dir, lang.value) : gg.title)
</script>

<template>
  <div class="pc">
    <template v-if="page === 'home'">
      <h1>{{ t('status.home') }}</h1>
      <p>{{ t('home.intro') }}</p>
      <h2>{{ t('home.progress') }}</h2>
      <ProgressPanel />
      <h2>{{ t('home.flow') }}</h2>
      <ol>
        <li>{{ t('home.s1') }}</li>
        <li>{{ t('home.s2') }}</li>
        <li>{{ t('home.s3') }}</li>
        <li>{{ t('home.s4') }}</li>
      </ol>
      <p class="pc-note">> {{ t('home.gennote') }}</p>
      <h2>{{ t('home.restore') }}</h2>
      <ul>
        <li>{{ t('home.r1') }}</li>
        <li>{{ t('home.r2') }}</li>
        <li>{{ t('home.r3') }}</li>
      </ul>
    </template>

    <template v-else-if="page === 'graph'">
      <h1>{{ t('page.graph') }}</h1>
      <p>{{ t('graph.intro') }}</p>
      <GlobalNodeView />
    </template>

    <template v-else-if="page === 'track'">
      <h1>{{ t('page.track') }}</h1>
      <p>{{ t('track.intro') }}</p>
      <DailyScales />
    </template>

    <template v-else-if="page === 'english' || page === 'math'">
      <h1>{{ courseLabelOf(dir, lang.value) }}</h1>
      <p>{{ t('course.intro') }}</p>
      <div v-if="course.groups.length">
        <div v-for="grp in course.groups" :key="grp.title">
          <h2>{{ glabel(grp) }}</h2>
          <ul>
            <li v-for="u in grp.units" :key="u.path"><a :href="withBase(u.path)">{{ u.title }}</a></li>
          </ul>
        </div>
      </div>
      <div v-else-if="course.units.length">
        <ul>
          <li v-for="u in course.units" :key="u.path"><a :href="withBase(u.path)">{{ u.title }}</a></li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pc-note { color: var(--muted); font-size: 0.9rem; }
</style>
