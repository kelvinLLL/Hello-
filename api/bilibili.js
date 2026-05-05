/**
 * B站适配器
 *
 * 匿名身份流程（bootstrap）：
 *   1. GET finger/spi          → buvid3（设备指纹，无需任何凭证）
 *   2. GET /x/web-interface/nav → WBI 密钥（img_key + sub_key）
 *   3. 用固定索引表混淆密钥 → mixinKey
 *
 * 签名机制（WBI）：
 *   params 按 key 排序 → 拼接 mixinKey → MD5 → w_rid
 *   同时附加 wts（当前秒级时间戳）
 */

import { createHash } from 'crypto'
import { httpGet, createHandler } from './_lib/createProxy.js'

// B站官方逆向的混淆索引表（偶有更新，可从 bilibili-API-collect 同步）
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18,  2, 53,  8, 23, 32, 15, 50, 10, 31, 58,  3, 45, 35,
  27, 43,  5, 49, 33,  9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
]

function getMixinKey(imgKey, subKey) {
  return MIXIN_KEY_ENC_TAB.map(i => (imgKey + subKey)[i]).join('').slice(0, 32)
}

function wbiSign(params, mixinKey) {
  const wts = Math.floor(Date.now() / 1000)
  const qs = Object.entries({ ...params, wts })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v).replace(/[!'()*]/g, ''))}`)
    .join('&')
  const w_rid = createHash('md5').update(qs + mixinKey).digest('hex')
  return `${qs}&w_rid=${w_rid}`
}

const BILI_HEADERS = { 'Referer': 'https://www.bilibili.com' }

async function bootstrap() {
  const fpRes = await httpGet('https://api.bilibili.com/x/frontend/finger/spi', { headers: BILI_HEADERS })
  const { data: fp } = await fpRes.json()

  const navRes = await httpGet('https://api.bilibili.com/x/web-interface/nav', {
    cookies: { buvid3: fp.b_3 },
    headers: BILI_HEADERS,
  })
  const { data: nav } = await navRes.json()
  const imgKey = nav.wbi_img.img_url.split('/').pop().replace('.png', '')
  const subKey = nav.wbi_img.sub_url.split('/').pop().replace('.png', '')

  return { buvid3: fp.b_3, mixinKey: getMixinKey(imgKey, subKey) }
}

async function search(keyword, { buvid3, mixinKey }) {
  const [bangumi, ft] = await Promise.all([
    searchType('media_bangumi', keyword, buvid3, mixinKey),
    searchType('media_ft',      keyword, buvid3, mixinKey),
  ])
  return [...bangumi, ...ft]
}

async function searchType(type, keyword, buvid3, mixinKey) {
  const qs = wbiSign({ search_type: type, keyword }, mixinKey)
  const res = await httpGet(
    `https://api.bilibili.com/x/web-interface/wbi/search/type?${qs}`,
    { cookies: { buvid3 }, headers: BILI_HEADERS },
  )
  const json = await res.json()
  return json.code === 0 ? (json.data?.result ?? []) : []
}

function normalize(item) {
  return {
    id:       String(item.season_id || item.media_id || ''),
    title:    (item.title || '').replace(/<[^>]*>/g, ''),
    year:     item.pubtime ? new Date(item.pubtime * 1000).getFullYear().toString() : '',
    rating:   parseFloat(item.rating) || 0,
    overview: item.styles || '',
    poster:   item.cover || item.pic || '',
    genre:    item.styles || '',
    source:   'bilibili',
    url:      item.goto_url || `https://www.bilibili.com/bangumi/media/md${item.media_id}`,
  }
}

export default createHandler({ bootstrap, search, normalize })
