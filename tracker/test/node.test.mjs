// tracker/node.test.mjs - automated verification of the data layer (Node + fake-indexeddb)
// Acceptance standard (specs/data-model.md, zh): restore = clear -> import ->
// identical state; idempotency = importing again skips everything.
import 'fake-indexeddb/auto'
import assert from 'node:assert'
import { openDB, closeDB, recordEvent, getState, getUnitState, getDailyScales,
         getStudySessions, getStudySeconds, sumStudyByDate, clearStudyDay,
         exportData, importData, clearEvents, takeSnapshot, listSnapshots, restoreSnapshot } from '../db.js'

const db = await openDB()
const U1 = 'e-vocab-001', U2 = 'e-gram-001'
let pass = 0
const ok = (name) => { pass += 1; console.log('  PASS', name) }

console.log('T1 event writes persist immediately')
await recordEvent(db, { type: 'unit_open', unitId: U1 })
await recordEvent(db, { type: 'unit_complete', unitId: U1, payload: { note: 'first pass done' } })
await recordEvent(db, { type: 'unit_open', unitId: U2 })
let st1 = await getState(db)
assert.strictEqual(st1.get(U1).status, 'completed')
assert.strictEqual(st1.get(U2).status, 'in_progress')
assert.strictEqual(st1.get(U1).completedAt !== null, true)
ok('complete -> completed; open only -> in_progress')

console.log('T2 uncomplete is reversible')
await recordEvent(db, { type: 'unit_uncomplete', unitId: U1, payload: { note: 'missed a word' } })
let st2 = await getState(db)
assert.strictEqual(st2.get(U1).status, 'in_progress')
assert.strictEqual(st2.get(U1).completedAt, null)
assert.strictEqual(st2.get(U1).reopenedAt !== null, true)
ok('back to in_progress, completedAt cleared')

console.log('T3 export -> clear -> import restores identical state')
const before = await exportData(db)
await clearEvents(db)
assert.strictEqual((await getState(db)).size, 0)
const imp1 = await importData(db, before)
assert.strictEqual(imp1.imported, before.eventCount)
assert.strictEqual(imp1.skipped, 0)
const after = await exportData(db)
assert.strictEqual(after.eventCount, before.eventCount)
assert.deepStrictEqual(after.events.sort((a, b) => a.id.localeCompare(b.id)), before.events.sort((a, b) => a.id.localeCompare(b.id)))
ok('restored, event logs match fully')

console.log('T4 importing again is idempotent (all skipped, state unchanged)')
const imp2 = await importData(db, before)
assert.strictEqual(imp2.skipped, before.eventCount)
assert.strictEqual(imp2.imported, 0)
ok('re-import writes nothing')

console.log('T5 snapshot: take -> clear -> restore snapshot')
const s1 = await takeSnapshot(db)
await recordEvent(db, { type: 'unit_open', unitId: U2 }) // one more event after the snapshot
await clearEvents(db)   // snapshots must survive an accidental clear
let snaps = await listSnapshots(db)
assert.ok(snaps.length >= 1)
const r = await restoreSnapshot(db, s1)
assert.strictEqual(r.imported, before.eventCount)
const afterRestore = await getState(db)
assert.strictEqual(afterRestore.get(U1).status, 'in_progress') // U1 was in_progress at snapshot time (after T2)
ok('restored from snapshot after clear')

console.log('T6 invalid import is rejected without writing anything')
let rejected = false
try { await importData(db, { schemaVersion: 999, events: [] }) } catch { rejected = true }
assert.strictEqual(rejected, true)
ok('schemaVersion mismatch rejected')

console.log('T7 daily scales: per-date latest wins, dates keyed correctly')
await recordEvent(db, { type: 'daily_scale', unitId: null, payload: { date: '2026-09-09', mot: 3, conc: 4 } })
await recordEvent(db, { type: 'daily_scale', unitId: null, payload: { date: '2026-09-09', mot: 8, conc: 9 } })
await recordEvent(db, { type: 'daily_scale', unitId: null, payload: { date: '2026-09-10', mot: 5, conc: 6 } })
const scales = await getDailyScales(db)
assert.strictEqual(scales['2026-09-09'].mot, 8)      // same-day latest wins
assert.strictEqual(scales['2026-09-09'].conc, 9)
assert.strictEqual(scales['2026-09-10'].mot, 5)
assert.strictEqual(Object.keys(scales).length, 2)
ok('scales aggregated per date (latest wins)')

console.log('T8 clearDailyScale removes one date only')
import { clearDailyScale } from '../db.js'
const n9 = await clearDailyScale(db, '2026-09-10')
assert.strictEqual(n9, 1)
const afterClear = await getDailyScales(db)
assert.strictEqual(afterClear['2026-09-10'], undefined)
assert.strictEqual(afterClear['2026-09-09'].mot, 8)   // other date untouched
ok('cleared date gone, others kept')

console.log('T9 study sessions: recorded, summed per date, clearable')
await recordEvent(db, { type: 'study_session', unitId: null, payload: { date: '2026-09-09', startTs: '2026-09-09T01:00:00.000Z', endTs: '2026-09-09T01:10:00.000Z', seconds: 600 } })
await recordEvent(db, { type: 'study_session', unitId: null, payload: { date: '2026-09-09', startTs: '2026-09-09T02:00:00.000Z', endTs: '2026-09-09T02:05:00.000Z', seconds: 300 } })
await recordEvent(db, { type: 'study_session', unitId: null, payload: { date: '2026-09-10', startTs: '2026-09-10T03:00:00.000Z', endTs: '2026-09-10T03:20:00.000Z', seconds: 1200 } })
const sess = await getStudySessions(db)
assert.strictEqual(sess.length, 3)
assert.strictEqual(sess[0].startTs < sess[1].startTs, true)
const sums = await getStudySeconds(db)
assert.strictEqual(sums['2026-09-09'], 900)
assert.strictEqual(sums['2026-09-10'], 1200)
assert.strictEqual(sumStudyByDate(sess)['2026-09-09'], 900)
assert.strictEqual(await clearStudyDay(db, '2026-09-10'), 1)
assert.strictEqual((await getStudySeconds(db))['2026-09-10'], undefined)
ok('study sessions aggregated per date; one date cleared')

console.log('T10 same-millisecond writes: seq decides (not random id)')
const TS = '2026-09-11T00:00:00.000Z'
const a = await recordEvent(db, { type: 'daily_scale', unitId: null, ts: TS, payload: { date: '2026-09-11', mot: 1, conc: 1 } })
const b = await recordEvent(db, { type: 'daily_scale', unitId: null, ts: TS, payload: { date: '2026-09-11', mot: 9, conc: 9 } })
assert.strictEqual(a.ts, b.ts)
assert.strictEqual(b.seq > a.seq, true, 'seq must be monotonic')
const s11 = (await getDailyScales(db))['2026-09-11']
assert.strictEqual(s11.mot, 9)   // the later write wins, regardless of id ordering
assert.strictEqual(s11.conc, 9)
ok('same-ts events ordered by seq (deterministic latest-wins)')

closeDB(db)
console.log('\nALL PASS: ' + pass + ' checks -> data layer verified (spec restore standard met)')

