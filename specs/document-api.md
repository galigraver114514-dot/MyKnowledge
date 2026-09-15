# Document API - mechanical document -> page conversion

> Goal: **the author only writes content, the system handles the format.**
> Related implementations: `scripts/gen-catalog.mjs` (generator),
> `site/.vitepress/theme/catalog.gen.ts` (artifact), `courses.config.json`
> (display names / order). Node-mode concepts live in `specs/node-model.md`.

## 1. Authoring contract (everything you need to do)

1. Put a Markdown file under `site/<course>/...`. A top-level directory = a
   course (one nav branch); nesting one more level = a subgroup; one .md file
   = one learning unit.
2. Write a `# Title` as the first line (or set `title` in frontmatter).
3. Write the body freely (checklists `- [ ]`, tables, quotes are all fine).

That is all. Everything below is derived/injected automatically:

| item | automatic handling |
|---|---|
| nav tree registration / order / folding | from folder structure + frontmatter `order` |
| unit id (tracking identity) | frontmatter `id` wins; otherwise derived from the relative path (§4) |
| completion widget | a `## Completion record` section + toggle component is auto-appended under trackable pages |
| page meta suffix (`m` key) | `created` from frontmatter, falling back to the git first-commit date; `lang` defaults to the config default; chars = rendered-content count |
| learning-map progress panel | same generated catalog as the tree - no manual registry |

## 2. Optional frontmatter (overrides; only advanced authors use it)

```yaml
---
id: stable-id            # write it to keep tracking history across renames (§4)
title: Title             # falls back to the first # H1
order: 1                 # ordering inside the group (number)
created: 2026-09-09      # falls back to the git first-commit date
lang: zh                 # falls back to courses.config defaultLang
type: page               # page = plain page (no tracking); default inferred from location
track: false             # explicitly disable tracking
draft: true              # don't generate / hide from the tree
navTitle: short          # only meaningful on index.md: overrides the tree label
tags: [a, b]             # reserved for future search
summary: one-liner       # reserved
nodeMode: true           # optional: enable the node-mode second view
nodePrompt: xxx.md       # optional: consistency prompt for node-ification (inline or relative .md)
nodeDims: ["pos", "topic"]  # optional: allowed dimensions (order = switch order)
title_en: Title          # optional: per-language unit titles (nav tree / breadcrumb /
title_zh: 标题            #   progress panel follow the active UI language)
title_ja: タイトル
x-*: anything            # extension namespace; core never reads it
---
```

## 2.1 Multilingual content in ONE file

Exactly one file per unit - no per-language copies. Wrap each language version in
a block; the theme shows only the block matching the active UI language
(`html[data-lang]`, default English):

```markdown
---
title: Basics (example unit)
title_en: Basics (example unit)
title_zh: 基础（示例单元）
title_ja: 基本（サンプルユニット）
id: ex-001
course: example
---

:::lang-en
# Basics (example unit)
English body...
:::

:::lang-zh
# 基础（示例单元）
中文正文...
:::

:::lang-ja
# 基本（サンプルユニット）
日本語の本文...
:::
```

- Block languages are free-form two-letter codes (`lang-en`, `lang-zh`, `lang-ja`);
  switching the UI language toggles visibility instantly, no rebuild.
- Put the per-language `# H1` **inside** each block so the heading switches too;
  `title_xx` frontmatter drives the tree/breadcrumb/panel titles.
- A block for a language that is not active is hidden (not removed), so the
  page still works with JS disabled (English is the default).

## 3. Display names & ordering (`courses.config.json`, only when adding/renaming branches)

```json
{
  "defaultLang": "zh",
  "courseIndexLabel": { "en": "Course", "zh": "赛道首页", "ja": "コース" },
  "labels": {
    "example": { "en": "Example", "zh": "示例", "ja": "サンプル" }
  },
  "dirOrder": { }
}
```

- `labels`: directory -> per-language display names (matched by full relative
  path or by the last segment).
- `dirOrder`: order of subgroups under a parent.
- Unlisted dirs default to their name; order falls back to natural sorting.

## 4. id stability (the one exception to the tracking red line)

- A hard-coded `id` wins (e.g. `ex-002`) -> renames/moves never lose history.
- Without one, the id is derived from the relative path
  (e.g. `example.unit-02-en`) -> **renaming the file creates
  a new id and loses old records**. Add an explicit `id` when long-term
  stability matters (duplicate ids are rejected by the generator).

## 5. Pipeline & commands

```
site/<course>/<slug>.md
   │  auto-run before npm run dev / build
   ▼
scripts/gen-catalog.mjs
   │  parse(frontmatter) -> validate(uniqueness/titles) -> normalize(defaults)
   │  -> derive(tree/registry/meta + node spec)
   ▼
site/.vitepress/theme/catalog.gen.ts   <- committed; do not hand-edit
   │  single source for: nav tree (SiteTree/nav.ts) · progress panel
   │  (ProgressPanel) · auto completion/node sections and meta fallback (Layout)
```

```bash
npm run gen          # regenerate the catalog + print the tree preview
npm run check:docs   # validate only (exit 1 on error): duplicate id/path, missing title
npm run dev|build    # runs gen first automatically
npm run nodes        # mechanical node extraction (see specs/node-model.md)
```

Validation failures fail loudly with a file list - no silent half-output.

## 6. Track/no-track decision rules

- Course (top-level dir) and subgroup `index.md` -> not trackable.
- `site/index.md` (home) -> not trackable.
- Other .md under a course dir -> trackable by default (opt out with
  `type: page` / `track: false`).
- Standalone root .md files (docs like this one) -> plain pages, not trackable.
