# tracker —— 本地数据层 (N4)

零依赖 ES module, 语义权威见 [specs/data-model.md](../specs/data-model.md)。

## 文件
- `db.js` — IndexedDB 封装: 事件写入(实时落盘)、派生状态、导出/导入(幂等)、快照(环形保留 5)、清空/隐私擦除
- `demo.html` — 手动验证页 (需静态服务器打开, 见下)
- `test/node.test.mjs` — 自动化验证 (Node + fake-indexeddb), 覆盖 spec §5 复原标准

## 用法
```bash
npm run test:tracker   # 自动化验证: 9 项断言
npm run demo           # 启动演示页 (npx serve tracker, 端口 4173)
```

## 浏览器 API 一览
| 函数 | 作用 |
|---|---|
| `recordEvent(db, {type, unitId, payload})` | 追加事件并立即持久化 |
| `getState(db) / getUnitState(db, unitId)` | 派生状态 (由日志重算) |
| `exportData(db)` | 全量导出 (复原副本) |
| `importData(db, data)` | 幂等导入 (按 id 去重, schema 校验) |
| `takeSnapshot / listSnapshots / restoreSnapshot` | 本地快照 (最近 5 份) |
| `getDailyScales(db)` | 每日 mot/conc 量表 (date → {mot,conc}, 同日后者胜) |
| `clearDailyScale(db, date)` | 删除某日所有 daily_scale 事件 (清空该日) |
| `getStudySessions(db)` | 学习计时时段列表 (按开始时间排序) |
| `getStudySeconds(db) / sumStudyByDate(sessions)` | 每日学习秒数合计 (date → seconds) |
| `clearStudyDay(db, date)` | 删除某日所有 study_session 事件 |
| `clearEvents(db) / wipeDatabase()` | 清空事件(保快照) / 隐私擦除 |

> 站点 UI (N5) 将以本模块为数据底座; 当前 tracker 与 site 解耦, 互不依赖。
