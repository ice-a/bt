// 中文（源文） → 英文 映射。
// 站点模板以中文书写，默认显示英文；切换到中文时回退到源文（即中文）。
// 键已做空格归一化（连续空白合并为单个空格），便于整句匹配。
export const zh2en: Record<string, string> = {
  // ===== 顶栏 / 布局 =====
  'BT 种子预览台': 'BT Torrent Preview',
  '搜索': 'Search',
  '任务': 'Tasks',
  '历史': 'History',
  '设置': 'Settings',
  'MONGO 未连接': 'MONGO disconnected',
  '磁力解析就绪': 'Magnet parsing ready',
  '磁力解析（缓存模式）': 'Magnet parsing (cache mode)',

  // ===== 浏览器端 P2P 进度文案 =====
  'P2P 活动中': 'P2P active',
  'P2P 空闲': 'P2P idle',
  '已连接': 'Connected',
  '个节点，正在获取元数据…': ' peers, fetching metadata…',
  '正在通过 WebRTC 寻找 P2P 节点…': 'Looking for P2P nodes via WebRTC…',
  '已拿到元数据，正在整理文件清单…': 'Metadata received, listing files…',
  '共': 'Total',
  '个节点': ' peers',
  '个文件': ' files',
  '下载中': 'Downloading',
  '正在连接 P2P 节点…': 'Connecting to P2P nodes…',
  '正在通过 WebRTC 从做种节点拉取图片…': 'Fetching image from seeders via WebRTC…',
  '完成': 'Done',
  '本地自托管 · 单进程 Nuxt 单体应用': 'Self-hosted · single-process Nuxt app',
  '只做解析与预览，直接获取磁力链': 'Parse and preview only, then grab the magnet link',

  // ===== 种子详情页 [infohash] =====
  '← 返回搜索': '← Back to search',
  '来自 MongoDB 缓存': 'From MongoDB cache',
  '来自链接参数': 'From link parameter',
  '拿不到这个种子的信息': "Can't fetch info for this torrent",
  '如果你是直接从外部链接进来的，请带上 magnet 参数，例如': 'If you came from an external link, include a magnet parameter, e.g.',
  '回到搜索页': 'Back to search',
  '加载中…': 'Loading…',

  // ===== 首页 index =====
  'SEARCH · PARSE · PREVIEW': 'SEARCH · PARSE · PREVIEW',
  '搜种子、解析文件清单、预览内容，并拿到磁力链': 'Search torrents, list files, preview contents, and grab the magnet link',
  '搜索走公开磁力源，预览只看文件清单和需要的分片（不下完整文件）。确认后直接复制磁力链，交给你的下载工具即可。': 'Search uses public magnet sources; preview only fetches the file list and needed chunks. Copy the magnet link and hand it to your own download tool.',
  '经代理访问': 'Via proxy',
  '直连访问': 'Direct connection',
  '请输入关键词': 'Please enter a keyword',
  '没有搜到结果': 'No results found',
  '可以换个关键词，或检查代理设置': 'Try another keyword or check proxy settings',
  '没有结果。换个关键词，或在「设置」里配置代理后再试。': 'No results. Try another keyword, or configure a proxy in Settings.',
  '上一页': 'Previous',
  '下一页': 'Next',
  '预览': 'Preview',
  '输入关键词开始搜索': 'Enter a keyword to search',
  '关键词搜索': 'Keyword search',
  '上传 .torrent': 'Upload .torrent',
  '磁力链': 'Magnet link',
  '把 .torrent 文件拖到这里，或点击选择': 'Drag a .torrent file here, or click to choose',
  '文件只在服务端解析出文件清单，不会上传到任何第三方': 'Files are parsed into a file list on the server only; nothing is uploaded to any third party',
  '解析中…': 'Resolving…',
  '磁力链需要联网从 DHT / tracker 拉取元数据，才能看到文件清单': 'A magnet link needs to fetch metadata from DHT / trackers to show the file list',
  '解析磁力链': 'Resolve magnet',
  '名称': 'Name',
  '来源': 'Source',
  '大小': 'Size',
  '文件': 'Files',
  '做种': 'Seeders',
  '下载': 'Leechers',
  '发布': 'Added',
  '操作': 'Actions',
  '搜索源': 'Search sources',

  // ===== 历史 history =====
  '搜索历史与种子库': 'Search history & torrent library',
  '每次搜索都会落到 MongoDB 的 searches 集合；搜到和解析过的种子按 infoHash 去重存在 torrents 集合。': "Every search is stored in MongoDB's searches collection; found and parsed torrents are deduplicated by infoHash in the torrents collection.",
  'MongoDB 未连接，历史记录不可用。启动本地 MongoDB 后刷新本页即可。': 'MongoDB not connected, history unavailable. Start local MongoDB and refresh this page.',
  '搜索总次数': 'Total searches',
  '库中种子数': 'Torrents in library',
  '高频关键词': 'Top keywords',
  '未连接': 'Disconnected',
  '正常': 'OK',
  '点击直接再搜一次': 'Click to search again',
  '刷新': 'Refresh',
  '刷新中…': 'Refreshing…',
  '清空': 'Clear all',
  '关键词': 'Keyword',
  '结果数': 'Results',
  '耗时': 'Time',
  '时间': 'Time',
  '删除': 'Delete',
  '还没有搜索记录': 'No search history yet',
  '加载中…': 'Loading…',
  '更新': 'Updated',
  '打开': 'Open',
  '库里还没有种子': 'No torrents in library yet',
  '已删除该条记录': 'Record deleted',
  '删除失败': 'Delete failed',
  '确定清空全部搜索历史？': 'Clear all search history?',
  '清空失败': 'Clear failed',

  // ===== 种子详情 TorrentDetail =====
  '未知来源': 'Unknown source',
  '磁力搜索': 'Magnet Search',
  '本地上传': 'Local upload',
  '数据库': 'Database',
  '文件清单已解析': 'File list resolved',
  '磁力链已复制到剪贴板': 'Magnet link copied to clipboard',
  '复制失败，请手动选中复制': 'Copy failed, please select and copy manually',
  '解析失败': 'Resolve failed',
  '总大小': 'Total size',
  '文件数': 'File count',
  '做种 / 下载': 'Seeders / Leechers',
  '发布时间': 'Published',
  '展开': 'Expand',
  '收起': 'Collapse',
  '备注': 'Comment',
  '复制磁力链': 'Copy magnet',
  '下载 .torrent': 'Download .torrent',
  '打开来源页面': 'Open source page',

  // ===== FileTable =====
  '正在通过 DHT / tracker 获取种子元数据，通常几秒到几十秒…': 'Fetching torrent metadata via DHT / tracker, usually takes seconds to tens of seconds…',
  '这个种子只有 infoHash，还没有文件清单。可以点击下面的按钮在线拉取元数据（需要本机能连上 DHT / tracker）。': 'This torrent only has an infoHash and no file list yet. Click the button below to fetch metadata online (requires the server to reach DHT / trackers).',
  '在线解析文件清单': 'Resolve file list online',
  'FILE LIST': 'FILE LIST',
  '过滤文件名…': 'Filter filenames…',
  '按大小': 'By size',
  '按名称': 'By name',
  '路径': 'Path',
  '占比': 'Ratio',
  '过大': 'Too large',
  '结果较多，表格只展示前 500 条，可用过滤框缩小范围': 'Too many results; table shows the first 500 rows. Use the filter to narrow down',

  // ===== ImagePreview =====
  'IMAGE': 'IMAGE',
  '关闭': 'Close',
  '正在从做种节点拉取这张图片，取决于对方的上传速度…': 'Fetching this image from seeding peers, depending on their upload speed…',
  '重试': 'Retry',
  '直接打开图片地址': 'Open image URL directly',
  '上一张': 'Previous',
  '下一张': 'Next',

  // ===== 设置 settings =====
  '搜索源设置': 'Search source settings',
  '所有配置写在 MongoDB 的 settings 集合里（没连库时回落到 .env）。本应用只做种子解析与预览，不负责实际下载。': "All config is stored in MongoDB's settings collection (falls back to .env when the DB is down). This app only parses and previews torrents; it does not handle actual downloads.",
  '保存中…': 'Saving…',
  '保存全部配置': 'Save all settings',
  '重新加载': 'Reload',
  'MongoDB 未连接，配置只能在本次运行内生效': 'MongoDB not connected; config only takes effect for this session',
  '启用的搜索源': 'Enabled search sources',
  'HTTP 代理（搜索源用）': 'HTTP proxy (for search sources)',
  '搜索超时（毫秒）': 'Search timeout (ms)',
  '元数据解析超时（毫秒）': 'Metadata parse timeout (ms)',
  '公开磁力站在部分网络环境下不可直连，配好代理后「保存」再回搜索页重试即可。': 'Public magnet sites may be unreachable on some networks. After setting a proxy, Save then retry from the search page.',
  'RUNTIME': 'RUNTIME',
  '已连接': 'Connected',
  '磁力解析': 'Magnet parsing',
  'webtorrent 可用，可通过 DHT/tracker 取文件清单': 'webtorrent available; can fetch file list via DHT/tracker',
  'webtorrent 不可用，但通过 torrent 缓存服务在线取清单（不走 DHT）': 'webtorrent unavailable, but online file list via torrent cache (no DHT)',

  // ===== 输入框占位符 =====
  '输入片名 / 剧名 / 关键词，回车搜索': 'Movie / show / keyword, press Enter to search',
  'http://127.0.0.1:7890 / 留空直连': 'http://127.0.0.1:7890 / blank for direct',

  // ===== 热词云 / 搜索页提示 =====
  '点击关键词直接搜索': 'Click a keyword to search',
  '已写入 MongoDB': 'Saved to MongoDB',
  'MongoDB 未连接，未记录': 'MongoDB not connected, not recorded',
  'MongoDB 未连接，搜索记录与种子缓存不会被保存（其余功能可用）。在 .env 配置正确的 MONGODB_URI 后刷新即可。': 'MongoDB not connected; search history and torrent cache will not be saved (other features still work). Set a valid MONGODB_URI in .env and refresh.',

  // ===== 访问密码门禁 =====
  '需要密码': 'Password required',
  '请输入访问密码以进入': 'Enter the access password to continue',
  '访问密码': 'Access password',
  '进入': 'Enter',
  '验证中': 'Verifying…',
  '密码错误': 'Wrong password',
  '验证失败': 'Verification failed',
  '请输入密码': 'Please enter the password',

  // ===== 锁定 / 退出 =====
  '退出': 'Logout',
  '退出登录': 'Log out',
  '尝试次数过多，账户已锁定': 'Too many failed attempts, account locked',
  '锁定剩余': 'Locked: '
}

export const en2zh: Record<string, string> = Object.fromEntries(
  Object.entries(zh2en).map(([zh, en]) => [en, zh])
)

/** 归一化：折叠所有连续空白为单个空格，并去掉首尾空白 */
export function normalizeWs(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}
