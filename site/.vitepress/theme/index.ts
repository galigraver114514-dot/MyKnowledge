// MyKnowledge 极简主题: 完全自绘 Layout, 不使用 VitePress 默认主题 chrome
import type { Theme } from 'vitepress'
import Layout from './Layout.vue'
import UnitTracker from './components/UnitTracker.vue'
import ProgressPanel from './components/ProgressPanel.vue'
import './styles.css'

export default {
  Layout,
  enhanceApp({ app }) {
    app.component('UnitTracker', UnitTracker)
    app.component('ProgressPanel', ProgressPanel)
  }
} satisfies Theme
