// VitePress 默认主题扩展: 全局注册 N5 追踪组件
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import UnitTracker from './components/UnitTracker.vue'
import ProgressPanel from './components/ProgressPanel.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('UnitTracker', UnitTracker)
    app.component('ProgressPanel', ProgressPanel)
  }
} satisfies Theme
