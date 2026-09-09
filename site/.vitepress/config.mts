import { defineConfig } from 'vitepress'

// 部署路径基座: GitHub Pages 项目站点为 /<仓库名>/
// 自定义域名或用户站时:  BUILD_BASE=/ npm run build
const base = process.env.BUILD_BASE || '/MyKnowledge/'

export default defineConfig({
  lang: 'zh-CN',
  title: 'MyKnowledge',
  description: '私人学习网站 · 可追踪 · 可复原 · 行为数据本地持久化',
  base,
  cleanUrls: true,
  lastUpdated: true,
  markdown: { lineNumbers: false },
  themeConfig: {
    nav: [
      { text: '学习地图', link: '/' },
      { text: '英语', link: '/english/' }
    ],
    sidebar: {
      '/english/': [
        {
          text: '词汇 · 核心', collapsed: false,
          items: [
            { text: 'Unit 01 高频动词 12', link: '/english/vocab-core/unit-01-core-verbs' },
            { text: 'Unit 02 高频名词 12', link: '/english/vocab-core/unit-02-core-nouns' },
            { text: 'Unit 03 学习话题词', link: '/english/vocab-core/unit-03-study-words' }
          ]
        },
        {
          text: '基础语法', collapsed: false,
          items: [
            { text: 'Unit 01 时态总览', link: '/english/grammar-basics/unit-01-tenses' },
            { text: 'Unit 02 句子成分', link: '/english/grammar-basics/unit-02-sentence-parts' }
          ]
        },
        { text: '赛道首页', link: '/english/' }
      ]
    },
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一单元', next: '下一单元' },
    darkModeSwitchLabel: '外观',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部'
  }
})
