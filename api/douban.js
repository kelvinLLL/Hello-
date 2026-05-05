/**
 * 豆瓣适配器
 *
 * 匿名身份流程（bootstrap）：
 *   GET douban.com 首页 → 从 Set-Cookie 提取 bid（匿名会话标识）
 *   bid 是豆瓣唯一要求的 cookie，无需签名算法。
 *
 * 搜索策略（两路并行，取先成功的）：
 *   主路：旧版 v2 API（有评分）   api.douban.com/v2/movie/search
 *   备路：suggest 接口（无评分）  movie.douban.com/j/subject_suggest
 *
 * 注意：v2 API 使用社区流通的公开 apikey，仅用于个人学习场景。
 */

import { httpGet, extractSetCookies, createHandler } from './_lib/createProxy.js'

const DOUBAN_HEADERS = { 'Referer': 'https://movie.douban.com/' }

// 已失效的官方 key，但社区验证部分场景仍可用
const DOUBAN_APIKEY = '0df993c66c0c636e29ecbb5344252a4a'

async function bootstrap() {
  // 访问首页拿 bid（匿名 session cookie）
  const res = await httpGet('https://www.douban.com', { headers: DOUBAN_HEADERS })
  const cookies = extractSetCookies(res)
  return { bid: cookies.bid || '' }
}

async function search(keyword, { bid }) {
  const cookies = bid ? { bid } : {}

  // 两路并行：优先 v2 API（有评分），失败则用 suggest
  const [v2Result, suggestResult] = await Promise.allSettled([
    fetchV2(keyword, cookies),
    fetchSuggest(keyword, cookies),
  ])

  // v2 返回有效数据则使用，否则 fallback
  if (v2Result.status === 'fulfilled' && v2Result.value.length > 0) {
    return v2Result.value.map(item => ({ ...item, _source: 'v2' }))
  }
  if (suggestResult.status === 'fulfilled') {
    return suggestResult.value.map(item => ({ ...item, _source: 'suggest' }))
  }
  return []
}

async function fetchV2(keyword, cookies) {
  const url = `https://api.douban.com/v2/movie/search?q=${encodeURIComponent(keyword)}&count=10&apikey=${DOUBAN_APIKEY}`
  const res = await httpGet(url, { cookies, headers: DOUBAN_HEADERS })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data.subjects) ? data.subjects : []
}

async function fetchSuggest(keyword, cookies) {
  const url = `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(keyword)}`
  const res = await httpGet(url, { cookies, headers: DOUBAN_HEADERS })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

function normalize(item) {
  // v2 API 字段
  if (item._source === 'v2') {
    return {
      id:       String(item.id || ''),
      title:    item.title || item.original_title || '',
      year:     item.year || '',
      rating:   parseFloat(item.rating?.average) || 0,
      overview: item.summary || '',
      poster:   item.images?.medium || item.images?.small || '',
      genre:    (item.genres || []).join(' / '),
      source:   'douban',
      url:      item.alt || `https://movie.douban.com/subject/${item.id}`,
    }
  }

  // suggest API 字段
  return {
    id:       String(item.id || ''),
    title:    item.title || '',
    year:     item.year || '',
    rating:   0,
    overview: item.sub_title || '',
    poster:   item.img || '',
    genre:    item.type || '',
    source:   'douban',
    url:      item.url || `https://movie.douban.com/subject/${item.id}`,
  }
}

export default createHandler({ bootstrap, search, normalize })
