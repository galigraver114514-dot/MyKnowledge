# 数据模型与追踪语义规范 v1 (N2)

> 状态: v1 (2026-09-09) · 对应框架 §2 的 O₀ 定稿 · 变更必须走版本迁移, 见 §6
> 关联: 框架文档 `Adaptive_Recursive_Problem-Solving_Framework_v2.md`, 数据层实现 `tracker/db.js`

## 1. 设计原则

1. **本地为真源 (local-first)**: 所有行为数据只存于本机浏览器 IndexedDB。GitHub Pages 无后端, 这既是约束也是隐私优势。
2. **事件日志为唯一事实, 派生状态可重算**: 只追加 (append-only) 不可变事件; 任何"当前进度"都由事件重算得到。删除/纠错 = 追加一条反向事件, 而非篡改历史 → 天然可追踪、可复原、可审计。
3. **导入可重入 (幂等)**: 同一份导出导入任意次, 结果不变 (按事件 id 去重) → 复原可反复演练。
4. **单用户假设**: 不处理多端并发; 多设备同步不在 v1 范围。
5. **写入即持久化**: 每次用户动作 = 一次 IndexedDB 事务提交, 提交即落盘 (满足"实时持久化")。

## 2. 单元 (Unit) 语义 —— 追踪的边界

- **一个学习单元 = 站内一个 Markdown 页面文件** (最小可追踪、可复原、可复习的粒度)。
- 每个单元页面 frontmatter 携带稳定标识:

```yaml
---
title: 单元标题
id: e-vocab-001        # 稳定 id: 与文件路径解耦, 重命名/移动文件不丢历史
course: vocab-core      # 所属赛道
order: 1               # 赛道内排序
created: 2026-09-09
---
```

- **路径可以变, id 不能变**。追踪 UI 只认 id。
- 赛道 (course) 是单元的上级分组; 一个赛道 = 一个侧栏分组 (如 vocab-core / grammar-basics)。

## 3. 事件 (Event) 语义

事件对象 (存储在 store `events`, keyPath `id`):

```ts
interface Event {
  id: string;            // crypto.randomUUID()
  ts: string;            // ISO 8601 UTC, 记录发起时刻 (事件创建时注入)
  seq?: number;          // 可选: 同 ts 冲突时的稳定次序 (v1 用 id 字符串兜底)
  type: EventType;
  unitId: string | null;
  payload: Record<string, unknown>;
  source: 'manual' | 'system' | 'import';
}
```

### 事件类型表 (v1)

| type | unitId | payload | 语义 | 可逆性 |
|---|---|---|---|---|
| `unit_open` | 必填 | `{ via: 'nav'|'link'|'other' }` | 用户打开单元页 (进入/阅读开始) | 无需撤销 |
| `unit_complete` | 必填 | `{ note?: string }` | 用户标记"本单元已完成" | 由 unit_uncomplete 撤销 |
| `unit_uncomplete` | 必填 | `{ note?: string }` | 撤销完成 (发现漏学/误标) | 由 unit_complete 重做 |
| `session_start` | null | `{ ua?: string }` | 站点会话开始 (粒度: 页面加载) | - |
| `note_add` *(预留)* | 可选 | `{ text }` | v1 不实现, 事件类型预留 | - |

> 预留扩展 (不破坏 v1): 复习计划 (spaced-repetition) 只需追加 `review_schedule` / `review_result` 等新 type;
> 事件 schema 增加字段视为 additive, 不变更 schemaVersion; 只有 store 结构或语义破坏性变化才 bump (§6)。

## 4. 派生状态 (Derived State) 规则

对 events 按 (ts, id) 升序归约, 每个 unit 得到:

```ts
interface UnitState {
  unitId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  firstOpenTs: string | null;      // 首次 unit_open
  lastTs: string | null;           // 最近事件
  openCount: number;               // unit_open 次数
  completedAt: string | null;      // 最近一次生效的 unit_complete
  reopenedAt: string | null;       // 最近一次 unit_uncomplete (撤销后记录)
}
```

归约规则 (顺序敏感, 对同一 unit):
- `unit_open`: openCount+1; 若无 firstOpenTs 则置为当前 ts; status 至少 in_progress; lastTs=ts。
- `unit_complete`: completedAt=ts; status='completed'; lastTs=ts。
- `unit_uncomplete`: completedAt=null; reopenedAt=ts; status = (openCount>0 ? 'in_progress' : 'not_started'); lastTs=ts。

> 结论性质: 对同一 events 列表, 归约结果是确定函数 → 状态永远可由日志重算; 任何"状态丢了"都能从事件日志重建。
> 归约时跨 unit 独立 (低耦合): 单 unit 出错只影响该 unit。

## 5. 快照 / 导出 / 导入 / 复原

### 导出 (export)
完整导出一个 JSON 文件: schemaVersion, appId, exportedAt, events 全量。这是**离线复原副本** (建议定期下载, 或交给自己信任的私有备份, 如加密盘/私有云)。

### 快照 (snapshot)
同一数据库内自动保留最近 N=5 份全量事件快照 (store `snapshots`, 环形淘汰)。用途: 浏览器内快速回滚 (误标、误删、实验性乱操作后一键恢复)。

### 导入 (import) —— 幂等
1. 校验 schemaVersion === 1 与结构; 不合法直接拒绝, 不写任何数据。
2. 按事件 id 去重: 已存在的跳过 (skipped), 缺失的写入 (imported)。
3. 重写派生缓存。返回 {imported, skipped}。

### 复原演练 (验证标准)
`清空 → 导入最近导出 → 状态与清空前逐字段一致` 且 `再次导入 → skipped=全部, 状态仍一致`。此标准同时验证: 复原能力 + 幂等性。(node 测试已覆盖, 见 tracker/test/node.test.mjs)

## 6. 版本与迁移

- store 结构变更 → 升级 IndexedDB version + onupgradeneeded 迁移 + schemaVersion++。
- 迁移必须: 旧数据可读 → 映射为新结构 → 校验。不允许"读不了就丢"。
- 本仓库内 `specs/data-model.md` 即权威; 实现与本文档不一致时以文档为准并开 issue 修实现。

## 7. 明确的非目标 (v1)

- 不收集: 键盘输入内容、鼠标轨迹、页面停留毫秒级计时等细粒度遥测。
- 无服务端、无云同步、无账号体系。多设备 = 手动导出/导入。
- 不做"学时统计/连续打卡"等激励系统 (留待数据积累后按真实需求再加)。
