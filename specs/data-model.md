# Data Model & Tracking Semantics Specification v1

> Status: v1 (2026-09-09) · Authoritative for the data layer · Changes must go through version migration, see §6.
> Related: tracking implementation `tracker/db.js`; document pipeline `specs/document-api.md`.

## 1. Design principles

1. **Local-first**: all behavior data lives only in the local browser IndexedDB.
   GitHub Pages has no backend - this is both a constraint and a privacy win.
2. **Event log is the single source of truth; derived state is recomputable**:
   only append-only immutable events are stored; any "current progress" is
   recomputed from the log. Deleting/correcting = append an inverse event
   instead of rewriting history -> naturally trackable, restorable, auditable.
3. **Imports are idempotent**: importing the same export any number of times
   yields the same result (deduplicated by event id) -> restore drills can be
   repeated safely.
4. **Single-user assumption**: no multi-device concurrency; sync is out of scope.
5. **Write = persist**: every user action is one IndexedDB transaction commit,
   which is durable immediately (satisfies "real-time persistence").

## 2. Unit semantics - the tracking boundary

- **One learning unit = one Markdown page** in the site (the smallest
  trackable/restorable/reviewable granularity).
- Each unit page carries a stable identity in frontmatter:

```yaml
---
title: Unit title
id: e-vocab-001        # stable id: decoupled from the file path
course: vocab-core      # course this unit belongs to
order: 1               # ordering within the course
created: 2026-09-09
---
```

- **Paths may change, ids must not.** Tracking UIs only ever key on ids.
- A course is the parent group of units; one course = one nav branch
  (e.g. vocab-core / grammar-basics / math).

## 3. Event semantics

An event is stored in the `events` store (keyPath `id`):

```ts
interface Event {
  id: string;            // crypto.randomUUID()
  ts: string;            // ISO 8601 UTC, stamped when the event is created
  seq: number;           // monotonic counter, allocated atomically with the write;
                         // the total order is (ts, seq) - legacy events without
                         // seq fall back to id
  type: EventType;
  unitId: string | null;
  payload: Record<string, unknown>;
  source: 'manual' | 'system' | 'import';
}
```

### Event types (v1)

| type | unitId | payload | semantics | reversibility |
|---|---|---|---|---|
| `unit_open` | required | `{ via }` | user opened the unit page | no undo needed |
| `unit_complete` | required | `{ note? }` | user marked the unit complete | undone by unit_uncomplete |
| `unit_uncomplete` | required | `{ note? }` | undo completion | redone by unit_complete |
| `session_start` | null | `{ ua? }` | site session start (page load granularity) | - |
| `daily_scale` | null | `{ date: 'YYYY-MM-DD', mot: 1-10, conc: 1-10 }` | daily self-rating (motivation/concentration); re-saving the same date keeps the latest by (ts, id) | rewritten on re-save |
| `study_session` | null | `{ date: 'YYYY-MM-DD', startTs, endTs, seconds }` | one completed timing run from the study timer; `date` = local day of the start; daily totals = sum per date | per-date clear via clearStudyDay |
| `note_add` *(reserved)* | optional | `{ text }` | not implemented in v1 | - |

> Extensions (e.g. spaced repetition) only add new event types - additive, no
> schema bump. Changing store structure or semantics is breaking and bumps the
> schema version (§6).

## 4. Derived state rules

Reduce events ordered by (ts, id) per unit:

```ts
interface UnitState {
  unitId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  firstOpenTs: string | null;
  lastTs: string | null;
  openCount: number;
  completedAt: string | null;
  reopenedAt: string | null;
}
```

Reduction rules (order-sensitive, per unit):
- `unit_open`: openCount+1; firstOpenTs = first time; status >= in_progress; lastTs = ts.
- `unit_complete`: completedAt = ts; status = completed.
- `unit_uncomplete`: completedAt = null; reopenedAt = ts; status = openCount > 0 ? in_progress : not_started.

> Property: reduction is a deterministic function of the event list -> any state
> can always be rebuilt from the log. Units reduce independently (low coupling).

## 5. Snapshots / export / import / restore

- **Export**: full JSON dump (schemaVersion, appId, exportedAt, all events) - the
  offline restore copy (download periodically to your own trusted backup).
- **Snapshot**: in-database automatic ring of the last N=5 full event snapshots
  (store `snapshots`). Purpose: fast in-browser rollback after accidents.
- **Import (idempotent)**: 1) validate schemaVersion === 1 and structure
  (reject without writing anything otherwise); 2) dedupe by event id (existing
  skipped); 3) rebuild derived caches. Returns {imported, skipped}.
- **Restore drill (acceptance)**: clear -> import latest export -> per-field
  identical state; importing again -> everything skipped and state unchanged.
  (Covered by tracker/test/node.test.mjs.)

## 6. Versioning & migration

- Store structure change -> bump IndexedDB version + migrate in onupgradeneeded
  + schemaVersion++. Migration must read old data -> map to new shape ->
  validate. Never silently drop data.
- This file is authoritative; if implementation diverges, fix the implementation.

## 7. Explicit non-goals (v1)

- No collection of: typed input content, mouse trails, millisecond dwell timers.
- No server, no cloud sync, no accounts. Multi-device = manual export/import.
- No streak/gamification yet (wait for real usage data before adding).
