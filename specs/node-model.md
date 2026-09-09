# Node Model —— 节点/簇/次元 规范 (v0.1)

> 定位：在 Document API（内容→页面）之上增加一层**知识结构**视图，供"node 模式"使用；
> 不取代 intuitive 模式的内容组织。实现对应：`scripts/extract-nodes.mjs`、
> `site/.vitepress/theme/nodes.spec.json`（生成）、未来 `NodeView` 组件。

## 1. 核心概念

### 1.1 Node（节点）—— 知识的最小单元
- 例：一个单词（`get`）、一条定理（`勾股定理`）、一个事实。
- **语境差**：同一概念在不同上下文有细微差别。因此 node 的定义不是单一字符串，而是：

```
Node := { id, kind, name,
          definition: { base, deltas: [{ context, change }] },
          edges: [{ to, kind }],        // 与其他 node 的关系(可无向/有向)
          labels: { <dimension>: [tag...] } }
```

- **公平化 (fairness)**：node 之间等权。数据模型**没有权重字段**；出现频次、被引用数只作为"涌现统计"展示，不作为权重参与聚类/排序。

### 1.2 Cluster（节点簇）—— 抽象的产物，不是实体
- Cluster = 对已标注节点做聚合的**视图**。节点按某 dimension 的标签分组即得簇；标签是**分层**的，
  因此簇可含簇（word → part-of-speech → 词性大类 → 词汇）。
- 例（英语词汇）：`get/make/take` 在 **词性** 维度同属 `verb`；在 **主题** 维度分属不同主题簇；
  同簇不一定同"主题"——取决于当前激活的 dimension。
- 重要推论：**磁盘只存 node 与其 labels，不存簇定义**。簇随标注而涌现（emergence），换维度即时重画。

### 1.3 Dimension（次元）—— 抽象方式（不唯一）
- 同一批 node 可以有多种合法聚类（按词性 / 按主题 / 按首字母 / 按频段……），每种聚类方式 = 一个 dimension。
- Dimension 变化遵循三条约束（机器可查，违反即校验警告）：
  1. **局部化 (localization)**：对 labels 的任何修改一次只影响一个"局部邻域"（一个单元内的节点），
     禁止一次全局重标；修改以"版本"记录（可审计，天然平滑演进）。
  2. **递增 (gradual increase)**：沿生成序，已有 dimension 的父标签只允许"细化为子标签"，
     不允许粗暴替换；需要换一种全新聚类时，必须显式声明为**新 dimension**，而不是修改旧维度。
  3. **光滑边缘 (smooth edges)**：若两节点相邻（共享例句/共现边/同段落），却落在不同簇，
     则要求它们在下层某维度存在公共祖先簇；机检规则：
     `相邻 && 无公共上层簇 -> warn 候选桥节点`（报告让作者确认，不静默）。

## 2. 两种模式

| | intuitive 模式（现状） | node 模式（可选开启） |
|---|---|---|
| 视角 | 内容作者：课程 → 单元（线性树） | 学习者/检索：节点与簇 |
| 内容文件 | 不变 | 不变（node 是叠加层） |
| 何时用 | 默认 | 单元/课程显式开启后才显示第二视图 |
| 关键理念 | - | 局部化、涌现、公平化 |

开启方式（任一层级）：课程级 courses.config.json 开 `"nodeModeDefault": true`；
或页面 frontmatter `nodeMode: true`；node 模式入口只出现在被开启的单元。

## 3. 对外 API（Document API 的可选新增项）

在页面 frontmatter 追加可选字段（不写 = 完全自动）：

```yaml
---
id: e-vocab-001
nodeMode: true          # 可选：开启该单元的 node 视图
nodePrompt: <inline 或 .md 文件相对路径>   # 可选：node 化的一致性约束
nodeDims: ["词性", "主题"]                  # 可选：允许的维度白名单(顺序=切换顺序)
---
```

- **nodePrompt 语义**：node 化过程中的"一致性参考"——词义粒度、命名语言、术语表、禁忌（如"不要合并
  get/obtain"）等都写在这里。AI 与机械提取都必须尊重它。
- **未填 nodePrompt**：自动模式。优先级：确定性机械提取（表格/定义模式）→ 有结构可循则直接产出；
  无结构处调用 AI（内置默认提示模板），并在产物中标记每个 node 的 `origin: mechanical|ai-auto`。
- 想长期稳定、可复现：优先让内容"可被机械提取"（见 §5），AI 只做兜底与润色。

## 4. 数据与产物

- `site/.vitepress/theme/nodes.spec.json`：由 gen-catalog 生成，页面级 node 配置（mode/prompt/dims），
  供提取器与未来 NodeView 使用。
- `npm run nodes`：运行机械提取，dry 模式打印统计与样例；`--write` 写入 `site/.vitepress/theme/nodes.gen.json`：
  `{ schemaVersion:1, pages:[{ path, id, nodes:[{ id,name,kind,origin,labels }] }], stats }`
- node id 建议：`<unitId>.<slug>`（机械生成），或内容中用 `[[<id>]]` 显式引用（可建立跨页边，
  未来支撑非单向图）。

## 5. 机械提取规则（v0.1 确定性部分）

1. **表格单元**（如词汇表）：表头识别出"术语列"（`单词`/`term`/`词` 等）与"特征列"
   （词性/释义/主题/难度…）。每行 → 一个 node；特征列的值按维度名写入 `labels[维度]`
   （表头即维度名，这是最自然的"dimension 由数据涌现"）。同表内不重复。
2. **定义模式**：`**术语** —— 释义` / `**术语**：释义` → node(kind=definition)。
3. 其余内容：v0.1 不猜（避免噪声）；`origin: ai-auto` 才允许扩展。

## 6. AI 钩子契约（占位，v0.2 接执行器）

输入：单元正文 + 已机械提取的 nodes + nodePrompt（若有）+ dims 白名单。
输出（严格 JSON）：`{ nodes:[{name,kind,deltas?,labels}], issues:[...] }`。
执行器按 `origin` 合并机械/AI 结果：机械结果为主，AI 只补 `origin=ai-auto` 的项；
冲突时机械优先并列出 diff 报告（绝不静默覆盖）。

## 7. 本规范的"公平/涌现/局部"落在实现上的含义

- **涌现**：NodeView 不读取任何"簇表"，只读 nodes.labels + 当前 dimension → 现场聚合。
- **公平**：节点渲染无权重差异；排序只允许按 name/alpha 或激活维度的标签序。
- **局部 + 递增 + 光滑**：labels 写入工具一次只接受一个 `(unitPath, dimension, nodeIds)` 变更；
  校验器对 §1.3 的三条约束逐条检查，输出 warn/error 清单（`npm run check:docs` 可扩展到 include `--nodes`）。
