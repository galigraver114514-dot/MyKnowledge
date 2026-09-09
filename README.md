# MyKnowledge

A personal learning site on GitHub Pages with a hardcore ASCII / terminal
aesthetic: static content is public, **all behavior data lives only in your local
browser** (IndexedDB, persisted in real time), trackable (event log + derived
state) and restorable (export / import / snapshots, idempotent).

Systematically designed with the framework in
[`Adaptive_Recursive_Problem-Solving_Framework_v2.md`](Adaptive_Recursive_Problem-Solving_Framework_v2.md).

## Live site

https://galigraver114514-dot.github.io/MyKnowledge/

## Repository layout

```
MyKnowledge/
├── site/                        # VitePress site (learning content, Markdown source)
│   ├── .vitepress/config.mts    # site meta / base path
│   ├── .vitepress/theme/        # fully custom minimal theme (Layout + ASCII tree)
│   ├── index.md                 # learning map (with local progress panel)
│   ├── english/                 # English course: vocab x3 + grammar x2 units
│   └── math/                    # Math course: 2 units (and growing)
├── scripts/gen-catalog.mjs      # doc->page pipeline: scans site/, emits catalog.gen.ts
├── specs/
│   ├── data-model.md            # data model & tracking semantics spec v1 (Chinese docs)
│   ├── document-api.md          # authoring contract: write content, system does the rest
│   └── node-model.md            # node/cluster/dimension model + node-mode API (v0.1)
├── tracker/                     # local data layer (zero dependency, decoupled from the site)
│   ├── db.js                    # IndexedDB wrapper: write / state / export / import / snapshot
│   ├── demo.html                # manual verification page (Chinese UI)
│   └── test/node.test.mjs       # automated verification (fake-indexeddb)
├── .github/workflows/pages.yml  # GitHub Pages deployment
└── Adaptive_...Framework_v2.md  # problem-solving framework this project follows
```

## Quick start

```bash
npm install          # devDeps: vitepress + fake-indexeddb
npm run test:tracker # 1) data layer verification (6 assertions, restore standard)
npm run dev          # 2) local site preview  (http://localhost:5173)
npm run demo         # 3) tracker demo page    (http://localhost:4173)
```

## UI & keys (ASCII terminal)

- White background, black monospace text; unified **blue** highlight for
  selection, links, code, the current page, progress markers and the tree
  cursor row.
- Left panel: pure-text collapsible tree (`|--` / ``-- ` / `|`), first visit
  expands fully; expand state persisted in localStorage; `>` cursor row has a
  blue background (white text), `*` marks the current page.
- Keys (vim-like; `?` for help):

| key | tree open | tree hidden |
|---|---|---|
| `j` / `k` | cursor down / up | scroll content line down / up |
| `h` | fold group / jump to parent | browser back |
| `l` / `Enter` | expand group / open unit | browser forward |
| `t` | hide | show |
| `Esc` | hide | - |
| `m` | toggle page suffix: created / chars / lang (works either way) | |

## Data architecture (one-liner)

```
page action -> recordEvent (append-only, single-tx commit = durable)
            -> derived state recomputed from the event log any time
            -> export JSON = offline restore copy; x5 local snapshots = in-browser rollback; import is idempotent
```

Semantics (event types, reduction rules, migration policy): `specs/data-model.md` (Chinese).

## Restore playbook

| scenario | how |
|---|---|
| accidental complete | toggle undo on the unit (unit_uncomplete) |
| messed up a bunch | restore nearest local snapshot |
| new machine / browser | export on old -> import on new (idempotent, repeatable) |
| disaster recovery | clear -> import latest export -> state identical (covered by tests) |
| privacy wipe | clear site data / wipeDatabase() |

## Deploying

1. Push `main` (repository name: `MyKnowledge`).
2. Repo Settings -> Pages -> Source: **GitHub Actions** (workflow provided).
3. URL: `https://<user>.github.io/MyKnowledge/` (base is set in config).
4. Custom domain / user site: `BUILD_BASE=/ npm run build` and adjust `base` / branch.

> Note: on the free plan GitHub Pages sites are public even from a private repo.
> Content here is confirmed non-sensitive; behavior data never leaves the browser.

## Roadmap

- **N6** post-deploy restore drill (browser clear -> import -> verify)
- Content: grow `english/` and `math/`, then add more courses - the tree,
  progress panel and page widgets are generated automatically from the
  Markdown files (`scripts/gen-catalog.mjs`, contract in `specs/document-api.md`)
- Node mode (opt-in second view): node/cluster/dimension model in
  `specs/node-model.md`; `npm run nodes` runs the mechanical extractor
  (tables/definitions)
  * per-unit NodeView on nodeMode pages (runtime cluster aggregation over the
    active dimension, multi-color)
  * /graph "学习图谱": whole-graph view joining all units (same-name concepts
    merged across chapters, click-through to unit pages, dimension switch)
  * remaining: AI hooks (origin=ai-auto), smooth-edge checker, graph edges
- Spaced repetition: add new event types later (backward compatible, schema v1)

## Conventions

- Commit messages are written in **English**; code comments in this repo are in English
  (long-form Chinese docs: `specs/data-model.md`, framework doc).
- Pushes to GitHub are **manual only** - changes are committed locally, you push when ready.
- README is kept up to date with the current state of the project.
