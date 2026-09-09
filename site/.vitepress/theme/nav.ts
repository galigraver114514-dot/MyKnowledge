// Site-wide navigation tree (manually maintained for now; can be generated later).
export interface NavPage { kind: 'page'; title: string; path: string }
export interface NavGroup { kind: 'group'; key: string; title: string; children: NavNode[] }
export type NavNode = NavPage | NavGroup

export const NAV: NavNode[] = [
  { kind: 'page', title: '学习地图', path: '/' },
  {
    kind: 'group', key: 'en', title: '英语', children: [
      { kind: 'page', title: '赛道首页', path: '/english/' },
      {
        kind: 'group', key: 'en-vocab', title: '词汇-核心', children: [
          { kind: 'page', title: 'Unit 01 高频动词 12', path: '/english/vocab-core/unit-01-core-verbs' },
          { kind: 'page', title: 'Unit 02 高频名词 12', path: '/english/vocab-core/unit-02-core-nouns' },
          { kind: 'page', title: 'Unit 03 学习话题词', path: '/english/vocab-core/unit-03-study-words' }
        ]
      },
      {
        kind: 'group', key: 'en-gram', title: '基础语法', children: [
          { kind: 'page', title: 'Unit 01 时态总览', path: '/english/grammar-basics/unit-01-tenses' },
          { kind: 'page', title: 'Unit 02 句子成分', path: '/english/grammar-basics/unit-02-sentence-parts' }
        ]
      }
    ]
  }
]

export const MK_TREE_EXPANDED_KEY = 'mk.tree.expanded'
