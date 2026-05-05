import { createHash } from 'crypto'

// WBI 签名所需的混淆索引表（B站官方逆向）
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
]

function getMixinKey(imgKey, subKey) {
  const raw = imgKey + subKey
  return MIXIN_KEY_ENC_TAB.map(i => raw[i]).join('').slice(0, 32)
}

function encodeWbi(params, mixinKey) {
  const wts = Math.floor(Date.now() / 1000)
  const sorted = Object.entries({ ...params, wts })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v).replace(/[!'()*]/g, ''))}`)
    .join('&')
  const w_rid = createHash('md5').update(sorted + mixinKey).digest('hex')
  return `${sorted}&w_rid=${w_rid}`
}

async function fetchWbiKeys(buvid3) {
  const res = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: {
      'Cookie': `buvid3=${buvid3}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com',
    },
  })
  const data = await res.json()
  const { img_url, sub_url } = data.data.wbi_img
  const imgKey = img_url.split('/').pop().replace('.png', '')
  const subKey = sub_url.split('/').pop().replace('.png', '')
  return { imgKey, subKey }
}

async function fetchBuvid3() {
  const res = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com',
    },
  })
  const data = await res.json()
  return data.data.b_3
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'missing q' })

  try {
    // 第1步：获取 buvid3
    const buvid3 = await fetchBuvid3()

    // 第2步：获取 WBI 密钥
    const { imgKey, subKey } = await fetchWbiKeys(buvid3)
    const mixinKey = getMixinKey(imgKey, subKey)

    // 第3步：构造签名参数，同时搜索番剧和影视
    const [bangumi, ft] = await Promise.all([
      searchBilibili('media_bangumi', q, mixinKey, buvid3),
      searchBilibili('media_ft', q, mixinKey, buvid3),
    ])

    res.json({ results: [...bangumi, ...ft] })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function searchBilibili(type, keyword, mixinKey, buvid3) {
  const query = encodeWbi({ search_type: type, keyword }, mixinKey)
  const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`

  const res = await fetch(url, {
    headers: {
      'Cookie': `buvid3=${buvid3}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com',
    },
  })
  const data = await res.json()
  if (data.code !== 0 || !data.data?.result) return []

  return data.data.result.map(item => ({
    season_id: item.season_id || item.media_id,
    title: item.title?.replace(/<[^>]*>/g, '') || '',
    year: item.pubtime ? new Date(item.pubtime * 1000).getFullYear().toString() : '',
    rating: parseFloat(item.rating) || 0,
    followers: item.all_net_followers || 0,
    styles: item.styles || item.media_type_name || '',
    cover: item.cover || item.pic || '',
    order: item.order || 0,
  }))
}
