/**
 * 微博适配器
 *
 * 匿名身份流程（bootstrap）：
 *   微博有一套 "visitor session" 机制，允许未登录用户以游客身份访问：
 *   1. POST genvisitor  → 获得临时 tid（无需任何凭证）
 *   2. POST incarnate   → 用 tid 换取真正的 sub/subp cookie（游客 session）
 *
 *   拿到 sub/subp 后，后续请求等同于"未登录但有游客态"的浏览器请求。
 *
 * 签名机制：
 *   微博游客态无签名要求，仅需携带 cookie + 标准 Referer/UA 即可。
 *   （已登录的接口需要 st token，此处不涉及）
 */

import { httpGet, extractSetCookies, createHandler } from './_lib/createProxy.js'

const WEIBO_HEADERS = { 'Referer': 'https://weibo.com/' }

async function bootstrap() {
  // 第1步：生成 visitor tid
  const genRes = await httpGet(
    'https://passport.weibo.com/visitor/genvisitor',
    {
      headers: {
        ...WEIBO_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  )
  const genJson = await genRes.json()
  // 响应格式: { data: { tid, confidence, new_tid } }
  const tid = genJson?.data?.tid
  if (!tid) return {}  // 接口变更时优雅降级

  // 第2步：用 tid 换取游客 cookie（sub/subp）
  const incRes = await httpGet(
    `https://passport.weibo.com/visitor/visitor?a=incarnate&t=${tid}&w=2&c=095&gc=&cb=cross_domain&from=weibo&_rand=${Math.random()}`,
    { headers: WEIBO_HEADERS },
  )
  const cookies = extractSetCookies(incRes)
  return { sub: cookies.SUB || cookies.sub || '', subp: cookies.SUBP || cookies.subp || '' }
}

async function search(keyword, session) {
  const cookies = session.sub ? { SUB: session.sub, SUBP: session.subp } : {}

  // 移动端搜索 API，游客态可访问影视相关内容
  const url =
    `https://m.weibo.cn/api/container/getIndex` +
    `?containerid=${encodeURIComponent(`100103type=1&q=${keyword}`)}&page_type=searchall`

  const res = await httpGet(url, { cookies, headers: { 'Referer': 'https://m.weibo.cn/' } })
  if (!res.ok) return []

  const data = await res.json()

  // 返回结构: data.data.cards[].card_group[].mblog
  const cards = data?.data?.cards ?? []
  const posts = []
  for (const card of cards) {
    const group = card.card_group ?? []
    for (const item of group) {
      if (item.mblog) posts.push(item.mblog)
    }
    if (card.mblog) posts.push(card.mblog)
  }
  return posts.slice(0, 20)
}

function normalize(mblog) {
  // 微博帖子没有标准的"标题"，取 text 前60字作为摘要
  const rawText = (mblog.text || '').replace(/<[^>]*>/g, '').trim()
  const title = rawText.slice(0, 40) || mblog.id

  return {
    id:       String(mblog.id || mblog.mid || ''),
    title,
    year:     mblog.created_at ? mblog.created_at.slice(0, 4) : '',
    rating:   0,
    overview: rawText.slice(0, 200),
    poster:   mblog.thumbnail_pic || mblog.bmiddle_pic || '',
    genre:    '微博',
    source:   'weibo',
    url:      `https://weibo.com/${mblog.user?.id}/${mblog.bid}`,
  }
}

export default createHandler({ bootstrap, search, normalize })
