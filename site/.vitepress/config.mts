import { defineConfig } from 'vitepress'

// 部署路径基座: GitHub Pages 项目站点为 /<仓库名>/
// 自定义域名或用户站时:  BUILD_BASE=/ npm run build
const base = process.env.BUILD_BASE || '/MyKnowledge/'

// 极简配置: 自绘主题接管全部 UI, 此处只保留站点元信息与路径
export default defineConfig({
  lang: 'zh-CN',
  title: 'MyKnowledge',
  description: '私人学习网站 · 极简 · 行为数据本地持久化',
  base,
  cleanUrls: true
})
