// Minimal UI i18n for static (chrome) text: en (default) / zh / ja.
// Learning content is NOT translated.
import { ref, computed } from 'vue'
import cfg from './courses.config.json'

export type Lang = 'en' | 'zh' | 'ja'
export const LANGS: Lang[] = ['en', 'zh', 'ja']
const KEY = 'mk.lang'

type Row = { en: string; zh: string; ja: string }
const D: Record<string, Row> = {
  // panel / chrome
  'panel.hide': { en: 'x', zh: 'x', ja: 'x' },
  'keys.hint': { en: 'j/k move  l open  h fold  m meta  Esc hide  ? help', zh: 'j/k 移动  l 打开  h 折叠  m 元信息  Esc 收起  ? 帮助', ja: 'j/k 移動  l 開く  h 折畳  m メタ  Esc 閉じる  ? ヘルプ' },
  'open.nav': { en: 'nav [t]', zh: '导航 [t]', ja: 'ナビ [t]' },
  'status.home': { en: 'Home', zh: '学习地图', ja: '学習マップ' },
  // help
  'help.title': { en: 'keys (vim-like)', zh: '按键（vim 风格）', ja: 'キー（vim風）' },
  'help.close': { en: 'press any key to close', zh: '按任意键关闭', ja: '任意のキーで閉じる' },
  'help.jk': { en: 'cursor down/up (tree)', zh: '光标下/上移（树内）', ja: 'カーソル下/上（ツリー内）' },
  'help.l': { en: 'expand group / open unit', zh: '展开组 / 打开单元', ja: 'グループ展開 / ユニットを開く' },
  'help.h': { en: 'fold group / jump to parent', zh: '折叠组 / 跳到父组', ja: 'グループ折畳 / 親へ移動' },
  'help.t': { en: 'toggle nav tree', zh: '开/关目录树', ja: 'ナビツリー切替' },
  'help.esc': { en: 'hide nav tree', zh: '收起目录树', ja: 'ナビを閉じる' },
  'help.scroll': { en: '(tree hidden) j/k: scroll content lines', zh: '(树隐藏) j/k：正文行滚动', ja: '(ツリー非表示) j/k: 本文スクロール' },
  'help.hist': { en: '(tree hidden) h/l: browser back/forward', zh: '(树隐藏) h/l：后退/前进', ja: '(ツリー非表示) h/l: 戻る/進む' },
  'help.help': { en: 'this help', zh: '本帮助', ja: 'このヘルプ' },
  'help.m': { en: 'toggle page suffix (created/chars/lang)', zh: '显示/隐藏页面后缀（创建/字数/语言）', ja: 'ページ末尾表示切替（作成/文字数/言語）' },
  'ui.lang': { en: 'EN', zh: '中文', ja: '日本語' },
  // auto sections & meta suffix
  'sec.done': { en: 'Completion record', zh: '完成记录', ja: '達成記録' },
  'sec.nodes': { en: 'Node view', zh: '节点视图', ja: 'ノード表示' },
  'meta.created': { en: 'created', zh: '创建', ja: '作成' },
  'meta.chars': { en: 'chars', zh: '字数', ja: '文字数' },
  'meta.lang': { en: 'lang', zh: '语言', ja: '言語' },
  // UnitTracker
  'tr.reading': { en: 'reading local state ...', zh: '读取本机状态 …', ja: 'ローカル状態を読込中 …' },
  'tr.not_started': { en: 'not started', zh: '未开始', ja: '未着手' },
  'tr.in_progress': { en: 'in progress', zh: '学习中', ja: '学習中' },
  'tr.completed': { en: 'completed', zh: '已完成', ja: '完了' },
  'tr.open': { en: 'open', zh: '打开', ja: '開いた' },
  'tr.completedAt': { en: 'completed', ja: '完了日', zh: '完成于' },
  'tr.local': { en: '(local)', zh: '（本机）', ja: '（ローカル）' },
  'tr.do': { en: '[ mark complete ]', zh: '[ 标记完成 ]', ja: '[ 完了にする ]' },
  'tr.undo': { en: '[ unmark complete ]', zh: '[ 撤销完成 ]', ja: '[ 完了を戻す ]' },
  'tr.storage': { en: 'indexdb / local', zh: '本机实时存储', ja: 'IndexedDB / ローカル' },
  // ProgressPanel
  'pp.reading': { en: 'reading local progress ...', zh: '读取本机进度 …', ja: 'ローカル進捗を読込中 …' },
  'pp.total': { en: 'TOTAL', zh: '总计', ja: '合計' },
  'pp.empty1': { en: 'no local records yet - open any unit page to start tracking,', zh: '暂无本地记录——打开任意单元页开始追踪，', ja: 'ローカル記録はまだありません。ユニットを開くと追跡開始、' },
  'pp.empty2': { en: 'or seed it via npm run demo (tracker demo page).', zh: '或先用 npm run demo（tracker 演示页）录入。', ja: 'または npm run demo（tracker デモ）で入力。' },
  // NodeView / GlobalNodeView
  'nv.nodeview': { en: 'node view', zh: 'node view', ja: 'ノード表示' },
  'nv.ncount': { en: 'nodes ·', zh: '节点 ·', ja: 'ノード ·' },
  'nv.clusters': { en: 'clusters', zh: '簇', ja: 'クラスタ' },
  'nv.unlabeled': { en: '(unlabeled)', zh: '（未标注）', ja: '（未ラベル）' },
  'nv.none': { en: 'no node data yet (no structured content - ai-auto pending)', zh: '暂无节点数据（无结构化内容——待 ai-auto）', ja: 'ノードデータなし（構造化コンテンツなし - ai-auto予定）' },
  'gv.graph': { en: 'global node graph', zh: '全局节点图', ja: '全体ノードグラフ' },
  'gv.concepts': { en: 'concepts', zh: '概念', ja: '概念' },
  'gv.units': { en: 'units', zh: '章节', ja: 'ユニット' },
  'gv.clusters': { en: 'clusters', zh: '簇', ja: 'クラスタ' },
  'gv.hint': { en: 'same concept in several units merges into one node (badge = chapters); click a node to jump to its unit. Switch dimension to re-cluster globally.', zh: '同一概念出现在多个章节会合并为一个节点（角标=章节数）；点击节点跳回单元页。切换维度即全局重聚。', ja: '複数ユニットの同一概念は1ノードに統合（バッジ=章数）。ノードをクリックでユニットへ。次元を切替えて全体を再クラスタ。' },
  // page scaffold titles (nav + breadcrumb)
  'page.graph': { en: 'Knowledge graph', zh: '学习图谱', ja: '学習グラフ' },
  'page.track': { en: 'Tracking calendar', zh: '追踪日历', ja: '記録カレンダー' },
  'page.idxEn': { en: 'English · course hub', zh: '英语赛道', ja: '英語コース' },
  'page.idxMath': { en: 'Math · course hub', zh: '数学赛道', ja: '数学コース' },
  // DailyScales
  'ds.reading': { en: 'reading local state ...', zh: '读取本机状态 …', ja: 'ローカル状態を読込中 …' },
  'ds.days': { en: 'd', zh: '天', ja: '日' },
  'ds.avg': { en: 'avg', zh: '均值', ja: '平均' },
  'ds.calnote': { en: 'calendar color = active metric · click a day to fill/edit', zh: '日历颜色 = 当前指标 · 点某天填写/修改', ja: 'カレンダー色 = 選択指標 · 日をクリックで入力/編集' },
  'ds.fill': { en: 'set', zh: '填写', ja: '入力' },
  'ds.trend': { en: 'trend (hover for date & values)', zh: '趋势（悬停查看日期与数值）', ja: '推移（ホバーで日付と値を表示）' },
  'ds.save': { en: '[ save ]', zh: '[ 保存 ]', ja: '[ 保存 ]' },
  'ds.clear': { en: '[ clear ]', zh: '[ 清空 ]', ja: '[ クリア ]' },
  'ds.confirm': { en: '[ confirm clear ]', zh: '[ 确认清空 ]', ja: '[ クリア確定 ]' },
  'ds.cancel': { en: '[ cancel ]', zh: '[ 取消 ]', ja: '[ 取消 ]' },
  'ds.ask': { en: 'clear {d} mot/conc ?', zh: '清空 {d} 的 mot/conc ？', ja: '{d} の mot/conc をクリア？' },
  'ds.saved': { en: 'saved {d}  mot={m} conc={c}', zh: '已保存 {d}  mot={m} conc={c}', ja: '保存済み {d}  mot={m} conc={c}' },
  'ds.cleared': { en: 'cleared {d} ({n})', zh: '已清空 {d}（{n}）', ja: 'クリア済み {d}（{n}）' },
  'ds.norecord': { en: 'no record for {d}', zh: '{d} 无记录', ja: '{d} に記録なし' },
  'ds.legend': { en: 'click square N = score N · save writes to the selected date', zh: '点第 N 格 = 得 N 分 · 保存写入所选日期', ja: 'N番目をクリックで N 点 · 保存は選択日へ書き込み' },
  // scaffold pages (static copy, follows UI language)
  'home.intro': { en: 'A private learning site: content is public on GitHub Pages, all behavior data stays in your local browser (IndexedDB, real-time). Trackable & restorable.', zh: '私人学习网站：内容公开于 GitHub Pages，行为数据只存本机浏览器（IndexedDB，实时落盘）。可追踪、可复原。', ja: '個人学習サイト：コンテンツはGitHub Pagesで公開、行動データはすべてローカルブラウザ（IndexedDB、リアルタイム）のみ。追跡・復元可能。' },
  'home.progress': { en: 'Local progress (live)', zh: '学习进度（本机实时）', ja: '進捗（ローカル）' },
  'home.flow': { en: 'How to use a unit', zh: '单元使用流程', ja: 'ユニットの使い方' },
  'home.s1': { en: 'open a unit page (auto-logs unit_open)', zh: '打开单元页面（自动记录 unit_open）', ja: 'ユニットページを開く（unit_open を自動記録）' },
  'home.s2': { en: 'study the content, finish the self-check at the bottom', zh: '学习内容，完成页底自检', ja: '内容を学習し、下部の自己チェックを完了' },
  'home.s3': { en: 'click "[ mark complete ]" under the content when done (can be undone)', zh: '学完点击内容下方的"[ 标记完成 ]"（可撤销）', ja: '完了したら「[ 完了にする ]」をクリック（戻す可）' },
  'home.s4': { en: 'export JSON occasionally as an offline restore copy; use snapshots/import to roll back', zh: '定期导出 JSON 作离线复原副本；误操作可用快照/导入回滚', ja: '復元用に JSON を定期的にエクスポート；誤操作はスナップショット/インポートで戻す' },
  'home.gennote': { en: 'Courses & units are generated from the folder structure - drop an .md file into a course dir and it appears automatically.', zh: '课程与单元由目录结构自动生成——在课程目录放入一个 md 文件即自动出现。', ja: 'コースとユニットはフォルダ構造から自動生成——コース配下に .md を置くだけで自動表示。' },
  'home.restore': { en: 'Restore in three sentences', zh: '复原手册（三句话）', ja: '復元・三行まとめ' },
  'home.r1': { en: 'daily: 5 local snapshots are auto-kept - restore from a snapshot after mistakes', zh: '日常：本地自动保留 5 份快照——误操作可从快照恢复', ja: '日常：スナップショット5件を自動保存——誤操作はそこから復元' },
  'home.r2': { en: 'new machine/browser: export on the old one -> import on the new one', zh: '换机/换浏览器：旧机导出 → 新机导入', ja: '別端末：旧端末でエクスポート → 新端末でインポート' },
  'home.r3': { en: 'disaster: clear -> import the latest export -> state matches exactly', zh: '灾难恢复：清空 → 导入最新导出 → 状态逐字段一致', ja: '復旧：クリア → 最新エクスポートをインポート → 状態が一致' },
  'graph.intro': { en: 'All node-mode units are joined into one graph: the same concept appearing in several chapters merges into a single node (badge = chapter count). Click a node to open its unit. Clusters are aggregated at runtime over the active dimension - switching dimensions re-clusters the whole graph.', zh: '所有启用 node 模式的单元联合成一张图：同一概念出现在多个章节会合并为同一节点（角标 = 章节数）；点击节点跳回单元页。簇按当前维度运行时跨章节聚合——切换维度即全局重聚。', ja: 'nodeモードの全ユニットを1つのグラフに統合：複数章に現れる同一概念は1ノードに統合（バッジ=章数）。ノードをクリックで該当ユニットへ。クラスタは選択中の次元で動的に集約——次元を切替えると全体が再クラスタ化。' },
  'track.intro': { en: 'Rate two things daily (1-10): mot (motivation, green) and conc (concentration, orange). Data stays in your browser (IndexedDB event log; re-saving a day keeps the latest). Cell color depth = score; the chart plots both lines; switch 7/14/30/100 days.', zh: '每天给两项打分（1–10）：mot（动力，绿）/ conc（专注，橙）。数据只存本机（IndexedDB 事件日志；同一天重复保存取最新）。格子颜色深浅 = 分值；折线图同轴两条线；可切 7/14/30/100 天。', ja: '毎日2項目を1–10で評価：mot（意欲、緑）/ conc（集中、橙）。データはローカルのみ（IndexedDB イベントログ、同日の再保存は最新優先）。セルの濃さ=値。折れ線は2本同時表示、7/14/30/100日で切替。' },
  'course.intro': { en: 'Course hub. Units under this branch:', zh: '赛道首页。本分支下的单元：', ja: 'コース一覧。このブランチのユニット：' },
  // study timer / clock dial
  'study.sec': { en: 'Study time · clock (day view)', zh: '学习计时 · 时钟（当日）', ja: '学習タイマー · 時計（当日）' },
  'study.start': { en: '[ start ]', zh: '[ 开始 ]', ja: '[ 開始 ]' },
  'study.stop': { en: '[ stop ]', zh: '[ 停止 ]', ja: '[ 停止 ]' },
  'study.session': { en: 'this session', zh: '本次', ja: '今回' },
  'study.today': { en: 'today total', zh: '今日合计', ja: '本日合計' },
  'study.sessions': { en: 'sessions', zh: '次数', ja: '回数' },
  'study.note': { en: 'blue = studied time on a 24h dial; the timer keeps running across reloads', zh: '蓝色 = 24 小时表盘上的已学习时段；计时跨刷新保持', ja: '青=24時間ダイヤル上の学習時間。リロードしても計測継続' }
}

const lang = ref<Lang>('en')
export function initLang() {
  try {
    const v = localStorage.getItem(KEY) as Lang | null
    if (v && LANGS.includes(v)) lang.value = v
  } catch { /* ignore */ }
}
export function setLang(l: Lang) { lang.value = l; try { localStorage.setItem(KEY, l) } catch { /* ignore */ } }
export function nextLang(): Lang {
  const i = LANGS.indexOf(lang.value)
  return LANGS[(i + 1) % LANGS.length]
}
export function useT() {
  return {
    lang: computed(() => lang.value),
    t: (k: string): string => {
      const row = D[k]
      if (!row) return k
      return row[lang.value] || row.en
    }
  }
}
// course display label by dir (from multilingual courses.config)
export function courseLabelOf(dir: string, l: Lang = lang.value): string {
  const labels = (cfg as { labels?: Record<string, Partial<Row>> }).labels || {}
  const last = dir.split('/').pop() || dir
  const e = labels[dir] ?? labels[last]
  if (e) return (e[l] as string) || e.en || dir
  return last
}
export function zhCourseOf(zh: string, l: Lang = lang.value): string {
  const labels = (cfg as { labels?: Record<string, Partial<Row>> }).labels || {}
  for (const dir of Object.keys(labels)) {
    if (labels[dir].zh === zh || labels[dir].en === zh) return courseLabelOf(dir, l)
  }
  return zh
}
export function langOf(): Lang { return lang.value }
export function LANG_CODE(): string { return lang.value.toUpperCase() }
