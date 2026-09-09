# Document API —— 文档→页面的机械转换规范

> 目标：**作者只关心内容，不关心格式**。系统负责路径、注册、追踪、元数据等一切"机器活"。
> 关联实现：`scripts/gen-catalog.mjs`（生成器）、`site/.vitepress/theme/catalog.gen.ts`（产物）、
> `courses.config.json`（显示名/顺序的少量配置）。

## 1. 作者契约（你需要做的全部）

1. **把 Markdown 文件放进 `site/<课程目录>/…`**。一级目录 = 课程（树的一个分支）；
   再套一层目录 = 子分组；一个 .md 文件 = 一个学习单元。
2. **第一行写一个 `# 标题`**（或不写，用 frontmatter `title` 覆盖，二选一即可）。
3. 正文照常写（`- [ ]` 自检、表格、引用都随意）。

仅此而已。以下是**你不需要碰**、系统自动推导/注入的内容：

| 项目 | 自动处理 |
|---|---|
| 树注册 / 顺序 / 折叠 | 由目录结构与 frontmatter `order` 推导 |
| 单元 id（追踪身份） | frontmatter `id` 优先，缺省由相对路径推导（见 §4） |
| 完成记录挂件 | track 类页面自动在底部插入 `## 完成记录` + 勾选组件 |
| 页面 meta 后缀（`m` 键） | `created` 取 frontmatter，缺省回退 git 首次提交日期；`lang` 缺省走配置默认；字数为渲染内容统计 |
| 学习地图进度面板 | 与树同源（生成目录），无需手抄 |

## 2. 可选 frontmatter（覆盖缺省，高级时才写）

```yaml
---
id: stable-id          # 想长期保留追踪历史才写(见 §4)
title: 标题            # 缺省取正文首个 # 标题
order: 1               # 组内排序(数字)
created: 2026-09-09    # 缺省取 git 首次提交日期
lang: zh               # 缺省取 courses.config defaultLang
type: page             # page=普通页(不追踪); 缺省按位置判定
track: false           # 显式关掉追踪
draft: true            # 暂不生成/不进树(保留开发中草稿)
navTitle: 短名          # 仅当该页是 index.md 时: 覆盖树里显示名
tags: [a, b]           # 预留检索用(未启用)
summary: 一句话简介     # 预留
nodeMode: true         # 可选: 开启本单元的 node 模式第二视图
nodePrompt: xxx.md     # 可选: node 化一致性提示(内联一行或相对 .md 文件)
nodeDims: ["词性", "主题"]  # 可选: 允许维度白名单(顺序=切换顺序)
x-*: anything          # 扩展命名空间, 系统永不读取
---

> node 模式相关概念(node/cluster/dimension/三原则/AI 钩子)见 `specs/node-model.md`。
```

## 3. 显示名与顺序配置（`courses.config.json`，只在新分支/想改名时动）

```json
{
  "defaultLang": "zh",
  "courseIndexLabel": "赛道首页",
  "labels": { "english": "英语", "math": "数学", "vocab-core": "词汇-核心" },
  "dirOrder": { "english": ["vocab-core", "grammar-basics"] }
}
```

- `labels`：目录名 → 树中显示名（可按全相对路径或末段匹配）；
- `dirOrder`：父目录下子分组的显示顺序；
- 其余目录缺省显示目录名，顺序按文件名/相对路径自然排序。

## 4. id 的稳定性（追踪红线的唯一例外）

- 写死的 `id` 优先（如 `e-vocab-001`）→ 文件改名/搬家都不丢历史；
- 没写则按相对路径推导（如 `english.vocab-core.unit-01-core-verbs`）→ **重命名会生成新 id、丢失旧记录**。
  需要长期稳定请补一个 `id`（生成器对重复 id 会报错拦截）。

## 5. 管线与命令

```
site/<课程>/<slug>.md
   │  npm run dev / build 前自动执行:
   ▼
scripts/gen-catalog.mjs
   │  parse(frontmatter) → validate(唯一性/标题) → normalize(缺省) → derive(树/注册/meta)
   ▼
site/.vitepress/theme/catalog.gen.ts   ← 已提交; 不要手改
   │  同源供: 左侧树(SiteTree/nav.ts) · 进度面板(ProgressPanel) · 自动完成记录与 meta 回退(Layout)
```

```bash
npm run gen          # 重新生成 catalog 并打印树预览
npm run check:docs   # 只校验(有错退出码 1): id 重复/路径重复/缺标题
npm run dev|build    # 已内置自动先 gen
```

校验失败 = 显式报错并列出文件，**不静默产出半成品**。

## 6. 判定规则（track 与否）

- 课程（一级目录）与子分组的 `index.md` → 非 track（不挂完成记录）；
- 首页 `site/index.md` → 非 track；
- 其余课程目录下的 .md → 默认 track（可 `type: page` 或 `track: false` 关掉）；
- 根目录下的独立 .md（如未来放说明页）→ 非 track 普通页。

## 7. 迁移说明（已内置完成）

现有 英语(5)/数学(2) 页面已迁移：删除手写 H1 约束不适用（继续用 # 标题）、
移除手工 `<UnitTracker>` 与 `## 完成记录`（改自动）、树/进度注册表改为生成；
已有 `id`（e-vocab-*/e-gram-*/m-*）全部保留 → 本地学习记录零丢失。
