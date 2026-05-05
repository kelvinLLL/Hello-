/**
 * createProxy — 中国平台 API 代理通用框架
 *
 * 每个平台适配器只需实现三个函数：
 *   bootstrap(req)          → session   获取匿名身份（cookie/token）
 *   search(query, session)  → raw[]     执行搜索，返回原始数据
 *   normalize(raw)          → Result    原始数据 → 统一格式
 *
 * 调用 createHandler({ bootstrap, search, normalize }) 即可得到标准 Vercel handler。
 */

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── HTTP 工具 ──────────────────────────────────────────────────────────────────

export async function httpGet(url, { cookies = {}, headers = {}, timeout = 8000 } = {}) {
  const cookieStr = Object.entries(cookies)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')

  return fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      'Accept': 'application/json, text/html, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      ...(cookieStr ? { 'Cookie': cookieStr } : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(timeout),
  })
}

// 从 Set-Cookie 响应头提取 key=value 键值对
export function extractSetCookies(res) {
  const raw = res.headers.get('set-cookie') || ''
  const cookies = {}
  // Set-Cookie 每个指令逗号分隔，但值里可能有逗号，取第一个分号前的部分
  raw.split(/,(?=[^ ])/).forEach(part => {
    const [pair] = part.trim().split(';')
    const eqIdx = pair.indexOf('=')
    if (eqIdx > 0) {
      const k = pair.slice(0, eqIdx).trim()
      const v = pair.slice(eqIdx + 1).trim()
      if (k && v) cookies[k] = v
    }
  })
  return cookies
}

// ── 统一结果格式 ────────────────────────────────────────────────────────────────
//
// 所有平台适配器的 normalize() 必须返回此结构。
// 缺失字段用空字符串/0，不要用 null/undefined。
//
// {
//   id:       string   平台内唯一 ID
//   title:    string   标题
//   year:     string   上映年份（4位字符串）
//   rating:   number   评分，统一到 0–10 范围
//   overview: string   简介
//   poster:   string   封面图 URL
//   genre:    string   类型标签，逗号或斜线分隔
//   source:   string   平台标识（bilibili / douban / weibo …）
//   url:      string   原始页面链接
// }

// ── 框架工厂 ───────────────────────────────────────────────────────────────────

/**
 * @param {{ bootstrap, search, normalize }} config
 * @returns Vercel Handler function
 */
export function createHandler({ bootstrap, search, normalize }) {
  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600')

    const { q } = req.query
    if (!q?.trim()) {
      return res.status(400).json({ ok: false, error: 'missing q', results: [] })
    }

    try {
      const session = await bootstrap(req)
      const raw = await search(q.trim(), session)
      const results = raw.map(normalize).filter(r => r?.title)
      return res.status(200).json({ ok: true, results, count: results.length })
    } catch (e) {
      console.error(`[proxy error]`, e.message)
      return res.status(500).json({ ok: false, error: e.message, results: [] })
    }
  }
}
