// tracker/db.js - MyKnowledge local data layer (zero-dependency ES module, browser IndexedDB)
// Semantic authority: specs/data-model.md (v1, Chinese docs)
// Principles: event log is the single source of truth; derived state is
// recomputable; imports are idempotent; writes persist immediately.

export const DB_NAME = 'myknowledge'
export const SCHEMA_VERSION = 1        // keep in sync with the IndexedDB version; bump only on breaking changes
export const SNAPSHOT_KEEP = 5         // number of snapshots kept locally (ring buffer)

// ---------- low-level promise wrappers ----------
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
      // lazily initialise meta
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

// ---------- helpers ----------
export function newId() {
  return (globalThis.crypto?.randomUUID?.() ?? 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10))
}
export function nowIso() { return new Date().toISOString() }

// ---------- event write (real-time persistence: a single tx commit = durable) ----------
export async function recordEvent(db, { type, unitId = null, payload = {}, source = 'manual', id = newId(), ts = nowIso() }) {
  const ev = { id, ts, type, unitId, payload, source }
  await put(db, 'events', ev)
  return ev
}

// ---------- derived state (pure function, decoupled from storage for testing) ----------
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

// ---------- daily scales (motivation / concentration 1-10) ----------
// One 'daily_scale' event per save, keyed by payload.date (local YYYY-MM-DD).
// Same-day saves are last-write-wins by (ts, id).
export async function getDailyScales(db) {
  const evs = await allOf(db, 'events')
  const out = {}
  for (const ev of evs) {
    if (ev.type !== 'daily_scale' || !ev.payload || typeof ev.payload.date !== 'string') continue
    const cur = out[ev.payload.date]
    const newer = !cur || ev.ts > cur.ts || (ev.ts === cur.ts && ev.id > cur.id)
    if (newer) out[ev.payload.date] = { mot: Number(ev.payload.mot) || 0, conc: Number(ev.payload.conc) || 0 }
  }
  return out // { 'YYYY-MM-DD': { mot, conc } }
}

// ---------- export / import (idempotent) ----------
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
  if (!data || typeof data !== 'object') throw new TypeError('import failed: not a valid data object')
  if (data.schemaVersion !== SCHEMA_VERSION) throw new TypeError('import failed: schemaVersion mismatch (file=' + data?.schemaVersion + ', expected=' + SCHEMA_VERSION + ')')
  if (!Array.isArray(data.events)) throw new TypeError('import failed: events must be an array')
  for (const ev of data.events) {
    if (!ev || typeof ev.id !== 'string' || typeof ev.type !== 'string') throw new TypeError('import failed: contains an invalid event record')
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

// ---------- snapshots (local ring buffer) ----------
export async function takeSnapshot(db) {
  const data = await exportData(db)
  const snap = { id: newId(), createdAt: nowIso(), count: data.eventCount, events: data.events }
  const tx = db.transaction('snapshots', 'readwrite')
  tx.objectStore('snapshots').put(snap)
  await txP(tx)
  // ring eviction: keep the newest SNAPSHOT_KEEP snapshots
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
  if (!snap) throw new Error('snapshot not found: ' + snapId)
  return importData(db, { schemaVersion: SCHEMA_VERSION, appId: DB_NAME, exportedAt: snap.createdAt, eventCount: snap.count, events: snap.events })
}

// ---------- clear events (restore drill / reset) ----------
// Semantics: only the event log is cleared, snapshots are kept - a snapshot
// must survive an accidental clear so it can be restored "with one key".
export async function clearEvents(db) {
  await clearStore(db, 'events')
}

// ---------- full wipe (privacy) ----------
// Removes snapshots and meta too; inside the browser this equals "never used".
// For restorability rely on external export files instead.
export function wipeDatabase(name = DB_NAME) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
