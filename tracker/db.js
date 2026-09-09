// tracker/db.js —— MyKnowledge 本地数据层 (零依赖 ES module, 浏览器 IndexedDB)
// 语义权威: specs/data-model.md (v1)
// 原则: 事件日志为唯一事实; 派生状态可重算; 导入幂等; 写入即持久化。

export const DB_NAME = 'myknowledge'
export const SCHEMA_VERSION = 1        // 与 IndexedDB version 同步; 破坏性变更才 bump
export const SNAPSHOT_KEEP = 5         // 本地环形保留快照份数

// ---------- 底层 promise 封装 ----------
function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
function txP(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('tx aborted'))
  })
}

export function openDB(name = DB_NAME, version = SCHEMA_VERSION) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('events')) {
        const s = db.createObjectStore('events', { keyPath: 'id' })
        s.createIndex('ts', 'ts')
        s.createIndex('unitId', 'unitId')
        s.createIndex('type', 'type')
      }
      if (!db.objectStoreNames.contains('snapshots')) {
        const s = db.createObjectStore('snapshots', { keyPath: 'id' })
        s.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = () => {
      const db = req.result
      // 惰性初始化 meta
      const tx = db.transaction('meta', 'readwrite')
      tx.objectStore('meta').get('schema').onsuccess = (e) => {
        if (!e.target.result) {
          tx.objectStore('meta').put({ key: 'schema', version: SCHEMA_VERSION, appId: DB_NAME, createdAt: new Date().toISOString() })
        }
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
}

export function closeDB(db) { db.close() }

function storeAll(db, store, mode = 'readonly') { return db.transaction(store, mode).objectStore(store) }

export async function allOf(db, store) {
  return reqP(storeAll(db, store).getAll())
}

export async function put(db, store, value) {
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(value)
  await txP(tx)
  return value
}

export async function del(db, store, key) {
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).delete(key)
  await txP(tx)
}

export async function clearStore(db, store) {
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).clear()
  await txP(tx)
}

// ---------- 工具 ----------
export function newId() {
  return (globalThis.crypto?.randomUUID?.() ?? 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10))
}
export function nowIso() { return new Date().toISOString() }

// ---------- 事件写入 (实时持久化: 单事务提交即落盘) ----------
export async function recordEvent(db, { type, unitId = null, payload = {}, source = 'manual', id = newId(), ts = nowIso() }) {
  const ev = { id, ts, type, unitId, payload, source }
  await put(db, 'events', ev)
  return ev
}

// ---------- 派生状态 (纯函数, 与存储解耦以便测试) ----------
export function deriveState(events) {
  const map = new Map()
  const byUnit = {}
  for (const ev of [...events].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : 1))) {
    const u = ev.unitId
    if (!u) continue
    if (!byUnit[u]) {
      byUnit[u] = { unitId: u, status: 'not_started', firstOpenTs: null, lastTs: null, openCount: 0, completedAt: null, reopenedAt: null }
    }
    const st = byUnit[u]
    st.lastTs = ev.ts
    if (ev.type === 'unit_open') {
      st.openCount += 1
      if (!st.firstOpenTs) st.firstOpenTs = ev.ts
      if (st.status === 'not_started') st.status = 'in_progress'
    } else if (ev.type === 'unit_complete') {
      st.completedAt = ev.ts
      st.status = 'completed'
    } else if (ev.type === 'unit_uncomplete') {
      st.completedAt = null
      st.reopenedAt = ev.ts
      st.status = st.openCount > 0 ? 'in_progress' : 'not_started'
    }
  }
  for (const u of Object.keys(byUnit)) map.set(u, byUnit[u])
  return map
}

export async function getState(db) {
  const events = await allOf(db, 'events')
  return deriveState(events)
}
export async function getUnitState(db, unitId) {
  const st = await getState(db)
  return st.get(unitId) ?? { unitId, status: 'not_started', firstOpenTs: null, lastTs: null, openCount: 0, completedAt: null, reopenedAt: null }
}

// ---------- 导出 / 导入 (幂等) ----------
export async function exportData(db) {
  const events = await allOf(db, 'events')
  return {
    schemaVersion: SCHEMA_VERSION,
    appId: DB_NAME,
    exportedAt: nowIso(),
    eventCount: events.length,
    events
  }
}

export function validateExport(data) {
  if (!data || typeof data !== 'object') throw new TypeError('导入失败: 不是有效的数据对象')
  if (data.schemaVersion !== SCHEMA_VERSION) throw new TypeError('导入失败: schemaVersion 不匹配 (文件=' + data?.schemaVersion + ', 期望=' + SCHEMA_VERSION + ')')
  if (!Array.isArray(data.events)) throw new TypeError('导入失败: events 必须是数组')
  for (const ev of data.events) {
    if (!ev || typeof ev.id !== 'string' || typeof ev.type !== 'string') throw new TypeError('导入失败: 存在非法事件记录')
  }
  return true
}

export async function importData(db, data) {
  validateExport(data)
  const existing = await allOf(db, 'events')
  const have = new Set(existing.map((e) => e.id))
  let imported = 0, skipped = 0
  const tx = db.transaction('events', 'readwrite')
  const os = tx.objectStore('events')
  for (const ev of data.events) {
    if (have.has(ev.id)) { skipped += 1; continue }
    os.put(ev); imported += 1
  }
  await txP(tx)
  return { imported, skipped }
}

// ---------- 快照 (本地环形保留) ----------
export async function takeSnapshot(db) {
  const data = await exportData(db)
  const snap = { id: newId(), createdAt: nowIso(), count: data.eventCount, events: data.events }
  const tx = db.transaction('snapshots', 'readwrite')
  tx.objectStore('snapshots').put(snap)
  await txP(tx)
  // 环形淘汰: 保留最新 SNAPSHOT_KEEP 份
  const snaps = await allOf(db, 'snapshots')
  snaps.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const drop = snaps.slice(SNAPSHOT_KEEP)
  for (const d of drop) await del(db, 'snapshots', d.id)
  return snap.id
}

export async function listSnapshots(db) {
  const snaps = await allOf(db, 'snapshots')
  return snaps.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((s) => ({ id: s.id, createdAt: s.createdAt, count: s.count }))
}

export async function restoreSnapshot(db, snapId) {
  const snaps = await allOf(db, 'snapshots')
  const snap = snaps.find((s) => s.id === snapId)
  if (!snap) throw new Error('快照不存在: ' + snapId)
  return importData(db, { schemaVersion: SCHEMA_VERSION, appId: DB_NAME, exportedAt: snap.createdAt, eventCount: snap.count, events: snap.events })
}

// ---------- 清空事件 (复原演练用) ----------
// 语义: 只清事件日志, 保留快照 —— 快照必须能挺过误清空, 才能"一键恢复"。
export async function clearEvents(db) {
  await clearStore(db, 'events')
}

// ---------- 彻底清除 (隐私用途) ----------
// 连快照与 meta 一起删; 浏览器内等同"未使用过本工具"。复原性请依赖外部导出文件。
export function wipeDatabase(name = DB_NAME) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
