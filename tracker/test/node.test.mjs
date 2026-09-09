// tracker/node.test.mjs —— N4 数据层自动化验证 (Node + fake-indexeddb)
// 验证标准 (specs/data-model.md §5): 复原 = 清空→导入→状态一致; 幂等 = 再导入 skipped=全部
import 'fake-indexeddb/auto'
import assert from 'node:assert'
import { openDB, closeDB, recordEvent, getState, getUnitState,
         exportData, importData, clearEvents, takeSnapshot, listSnapshots, restoreSnapshot } from '../db.js'

const db = await openDB()
const U1 = 'e-vocab-001', U2 = 'e-gram-001'
let pass = 0
const ok = (name) => { pass += 1; console.log('  ✓', name) }

console.log('T1 事件写入与实时持久化')
await recordEvent(db, { type: 'unit_open', unitId: U1 })
await recordEvent(db, { type: 'unit_complete', unitId: U1, payload: { note: '第一遍完成' } })
await recordEvent(db, { type: 'unit_open', unitId: U2 })
let st1 = await getState(db)
assert.strictEqual(st1.get(U1).status, 'completed')
assert.strictEqual(st1.get(U2).status, 'in_progress')
assert.strictEqual(st1.get(U1).completedAt !== null, true)
ok('完成标记 → completed; 打开未完成 → in_progress')

console.log('T2 撤销 (unit_uncomplete) 可逆')
await recordEvent(db, { type: 'unit_uncomplete', unitId: U1, payload: { note: '漏学了 revise 词' } })
let st2 = await getState(db)
assert.strictEqual(st2.get(U1).status, 'in_progress')
assert.strictEqual(st2.get(U1).completedAt, null)
assert.strictEqual(st2.get(U1).reopenedAt !== null, true)
ok('撤销后回到 in_progress 且 completedAt 清空')

console.log('T3 导出 → 清空 → 导入 = 复原 (状态逐字段一致)')
const before = await exportData(db)
await clearEvents(db)
assert.strictEqual((await getState(db)).size, 0)
const imp1 = await importData(db, before)
assert.strictEqual(imp1.imported, before.eventCount)
assert.strictEqual(imp1.skipped, 0)
const after = await exportData(db)
assert.strictEqual(after.eventCount, before.eventCount)
assert.deepStrictEqual(after.events.sort((a, b) => a.id.localeCompare(b.id)), before.events.sort((a, b) => a.id.localeCompare(b.id)))
ok('复原一致, 事件全量匹配')

console.log('T4 再导入 = 幂等 (skipped=全部, 状态不变)')
const imp2 = await importData(db, before)
assert.strictEqual(imp2.skipped, before.eventCount)
assert.strictEqual(imp2.imported, 0)
ok('重复导入不重复写入')

console.log('T5 快照: 记录 → 清空 → 恢复快照')
const s1 = await takeSnapshot(db)
await recordEvent(db, { type: 'unit_open', unitId: U2 }) // 快照后再加一条
await clearEvents(db)   // 快照必须能挺过误清空
let snaps = await listSnapshots(db)
assert.ok(snaps.length >= 1)
const r = await restoreSnapshot(db, s1)
assert.strictEqual(r.imported, before.eventCount)
const afterRestore = await getState(db)
assert.strictEqual(afterRestore.get(U1).status, 'in_progress') // 快照时 U1 是 in_progress (被 T2 撤销)
ok('清空后从快照恢复成功')

console.log('T6 非法导入被拒绝 (不写任何数据)')
let rejected = false
try { await importData(db, { schemaVersion: 999, events: [] }) } catch { rejected = true }
assert.strictEqual(rejected, true)
ok('schemaVersion 不匹配被拒绝')

closeDB(db)
console.log('\nALL PASS: ' + pass + ' checks → tracker 数据层验证通过 (spec §5 复原标准达成)')
