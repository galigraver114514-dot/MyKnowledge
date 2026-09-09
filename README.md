# MyKnowledge · 私人学习网站

用 GitHub Pages 搭的私人英语学习站：内容静态公开、**行为数据只在本机浏览器实时落盘**（IndexedDB），
可追踪（事件日志 + 派生状态）、可复原（导出/导入/快照，幂等可演练）。系统设计按
[Adaptive Recursive Problem-Solving Framework](Adaptive_Recursive_Problem-Solving_Framework_v2.md) 执行（N1–N4 阶段完成）。

## 仓库结构
```
MyKnowledge/
├── site/                       # VitePress 站点 (学习内容, md 源)
│   ├── .vitepress/config.mts   # 站点配置 (导航/侧栏/base)
│   ├── index.md                # 学习地图
│   └── english/                # 英语赛道: 词汇核心 ×3 + 基础语法 ×2
├── specs/data-model.md         # 数据模型与追踪语义规范 v1 (权威)
├── tracker/                    # 本地数据层 (零依赖, 与站点解耦)
│   ├── db.js                   # IndexedDB 封装: 写入/状态/导出/导入/快照
│   ├── demo.html               # 手动验证页
│   └── test/node.test.mjs      # 自动化验证 (fake-indexeddb)
├── .github/workflows/pages.yml # Pages 部署
└── Adaptive_...Framework_v2.md # 本次设计所遵循的问题求解框架
```

## 快速开始
```bash
npm install          # 已含 vitepress + fake-indexeddb (devDeps)
npm run test:tracker # 1) 验证数据层: 复原标准 6 项断言
npm run dev          # 2) 本地预览站点 (http://localhost:5173)
npm run demo         # 3) 打开 tracker 演示页 (4173) → 手动录事件/导出/快照
```

## 数据架构 (一句话版)
```
页面动作 → recordEvent (append-only, 单事务提交即落盘)
        → 派生状态随时可从事件日志重算
        → 导出 JSON = 离线复原副本; 本地快照 ×5 = 浏览器内回滚; 导入幂等
```
语义细节(事件类型/归约规则/迁移策略): `specs/data-model.md`。

## 复原手册
| 场景 | 做法 |
|---|---|
| 误标完成 | 单元上再点一次"撤销" (unit_uncomplete) |
| 误操作一堆 | 从最近本地快照恢复 (demo/未来 UI) |
| 换机/换浏览器 | 旧机导出 JSON → 新机导入 (幂等, 可重复) |
| 灾难恢复 | 清空 → 导入最近导出 → 状态逐字段一致 (已由测试验证) |
| 隐私擦除 | 清除站点数据 / wipeDatabase() |

## 部署到 GitHub Pages
1. 推送 main 分支到 GitHub (仓库名建议 `MyKnowledge`)。
2. 仓库 Settings → Pages → Source 选 **GitHub Actions** (工作流已提供)。
3. 站点 URL: `https://<用户名>.github.io/MyKnowledge/` (base 已在 config 设为 `/MyKnowledge/`)。
4. 若用自定义域名/用户站: `BUILD_BASE=/ npm run build` 后改 `config.mts` 的 base 或部署为分支。

> 注意: 免费版 GitHub Pages 站点公开(即使仓库私有) —— 本方案已确认内容无敏感信息;
> 行为数据本就不上传, 私密性由"数据不出本机"保证。

## 路线图 (框架 N5/N6)
- **N5 追踪 UI**: 在 VitePress 页面内注入单元勾选/进度条/学习地图仪表盘 (以 tracker 为底座, 读 frontmatter id 与事件日志对账)
- **N6 复原演练上线**: 部署后做一次"浏览器清空→导入→校验"的公开可复现验收
- 扩展: 复习队列(spaced repetition) — 追加事件类型即可, 不破坏 schema v1
