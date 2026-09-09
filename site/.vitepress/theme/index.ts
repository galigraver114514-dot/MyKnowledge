// MyKnowledge minimal theme: fully custom Layout, no VitePress default chrome.
import type { Theme } from 'vitepress'
import Layout from './Layout.vue'
import UnitTracker from './components/UnitTracker.vue'
import ProgressPanel from './components/ProgressPanel.vue'
import NodeView from './components/NodeView.vue'
import './styles.css'

export default {
  Layout,
  enhanceApp({ app }) {
    app.component('UnitTracker', UnitTracker)
    app.component('ProgressPanel', ProgressPanel)
    app.component('NodeView', NodeView)
  }
} satisfies Theme
