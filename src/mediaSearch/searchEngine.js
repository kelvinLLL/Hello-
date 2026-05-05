import sourcesConfig from './sources.json'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Dot-notation field access: "rating.average" → obj.rating?.average
function getField(obj, path) {
  if (!path) return undefined
  return path.split('.').reduce((cur, key) => cur?.[key], obj)
}

// Normalize genre values: string | string[] | [{name}][] → "A / B"
function normalizeGenre(raw) {
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) {
    return raw.map(g => (typeof g === 'string' ? g : g?.name ?? '')).filter(Boolean).join(' / ')
  }
  return ''
}

// ── Quality Score (0–100) ─────────────────────────────────────────────────────
function computeQualityScore({ rating, ratingMax, voteCount, year, popularity }) {
  let score = 0

  if (rating && ratingMax) score += (rating / ratingMax) * 40

  if (voteCount > 0) {
    score += Math.min(Math.log10(Math.max(voteCount, 1)) / Math.log10(1_000_000), 1) * 30
  }

  if (year) {
    const age = new Date().getFullYear() - parseInt(year, 10)
    if (!isNaN(age)) {
      if (age <= 1) score += 15
      else if (age <= 3) score += 11
      else if (age <= 7) score += 7
      else if (age <= 15) score += 3
    }
  }

  if (popularity > 0) {
    score += Math.min(Math.log10(Math.max(popularity, 1)) / Math.log10(1_000_000), 1) * 15
  }

  return Math.round(Math.min(score, 100))
}

// ── Key storage ───────────────────────────────────────────────────────────────
function getStoredKeys() {
  try { return JSON.parse(localStorage.getItem('media_search_keys') || '{}') }
  catch { return {} }
}

export function saveApiKey(keyName, value) {
  const keys = getStoredKeys()
  keys[keyName] = value.trim()
  localStorage.setItem('media_search_keys', JSON.stringify(keys))
}

export function loadApiKeys() { return getStoredKeys() }

// ── URL builder ───────────────────────────────────────────────────────────────
function buildUrl(source, query) {
  const keys = getStoredKeys()
  return source.url
    .replace('{query}', encodeURIComponent(query))
    .replace('{key}', keys[source.keyName] || '')
}

// ── Result normalizer ─────────────────────────────────────────────────────────
function normalizeResult(raw, source) {
  const { parse, id: sourceId, name: sourceName, type } = source
  const f = parse.fields

  const rawYear = getField(raw, f.year) || ''
  const year = rawYear ? rawYear.toString().slice(0, 4) : ''

  const rawRating = getField(raw, f.rating)
  const ratingMax = f.ratingMax || 10
  const rating = rawRating != null ? Math.round((rawRating / ratingMax) * 100) / 10 : 0

  const voteCount = getField(raw, f.voteCount) || 0
  const popularity = getField(raw, f.popularity) || 0

  let poster = ''
  if (f.posterBase && getField(raw, f.poster)) {
    poster = f.posterBase + getField(raw, f.poster)
  } else if (getField(raw, f.poster)) {
    poster = getField(raw, f.poster).toString().replace('100x100bb', '300x300bb')
  }

  // Strip HTML tags (TVmaze summaries contain <p> tags)
  const rawOverview = getField(raw, f.overview) || ''
  const overview = rawOverview.replace(/<[^>]*>/g, '').trim()

  const result = {
    id: `${sourceId}_${getField(raw, f.id)}`,
    title: getField(raw, f.title) || '',
    year,
    rating,
    voteCount,
    popularity,
    overview,
    poster,
    genre: normalizeGenre(getField(raw, f.genre)),
    sourceId,
    sourceName,
    type,
  }

  result.qualityScore = computeQualityScore(result)
  return result
}

// ── Per-source fetcher ────────────────────────────────────────────────────────
async function fetchFromSource(source, query) {
  if (!source.enabled) return []
  if (source.requiresKey && !getStoredKeys()[source.keyName]) return []

  const url = buildUrl(source, query)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []

    const data = await res.json()
    let list = source.parse.resultsPath ? data[source.parse.resultsPath] : data
    if (!Array.isArray(list)) return []

    // TVmaze wraps each result: [{ score, show: {...} }] → unwrap "show"
    if (source.parse.resultUnwrap) {
      list = list.map(item => item[source.parse.resultUnwrap]).filter(Boolean)
    }

    return list
      .filter(r => getField(r, source.parse.fields.title))
      .map(r => normalizeResult(r, source))
  } catch {
    return []
  }
}

// ── Deduplication ─────────────────────────────────────────────────────────────
function deduplicateResults(results) {
  const seen = new Map()
  for (const r of results) {
    const key = `${r.title.toLowerCase().trim()}|${r.year}`
    const existing = seen.get(key)
    if (!existing || existing.qualityScore < r.qualityScore) seen.set(key, r)
  }
  return Array.from(seen.values())
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function searchMedia(query, typeFilter = 'all') {
  if (!query.trim()) return []

  const sources = sourcesConfig.sources.filter(s =>
    typeFilter === 'all' || s.type === typeFilter
  )

  const batches = await Promise.all(sources.map(s => fetchFromSource(s, query)))
  const deduped = deduplicateResults(batches.flat())
  return deduped.filter(r => r.title).sort((a, b) => b.qualityScore - a.qualityScore)
}

export function getSourceStatus() {
  const keys = getStoredKeys()
  return sourcesConfig.sources.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type,
    active: !s.requiresKey || !!keys[s.keyName],
    requiresKey: s.requiresKey,
    keyName: s.keyName,
  }))
}
