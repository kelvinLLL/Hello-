import sourcesConfig from './sources.json'

// ── Quality Score (0–100) ─────────────────────────────────────────────────────
// Mirrors how Maigret scores and ranks account confidence:
// rating weight + vote-count weight (log scale) + recency + popularity
function computeQualityScore({ rating, ratingMax, voteCount, year, popularity }) {
  let score = 0

  // Rating component: 0–40 pts
  if (rating && ratingMax) {
    score += (rating / ratingMax) * 40
  }

  // Vote-count component: 0–30 pts (log scale, so 10 votes ≠ 10x of 1 vote)
  if (voteCount && voteCount > 0) {
    const logVotes = Math.log10(Math.max(voteCount, 1))
    score += Math.min(logVotes / Math.log10(1_000_000), 1) * 30
  }

  // Recency component: 0–15 pts
  if (year) {
    const age = new Date().getFullYear() - parseInt(year, 10)
    if (!isNaN(age)) {
      if (age <= 1) score += 15
      else if (age <= 3) score += 11
      else if (age <= 7) score += 7
      else if (age <= 15) score += 3
    }
  }

  // Popularity component: 0–15 pts (TMDB only)
  if (popularity && popularity > 0) {
    score += Math.min(Math.log10(Math.max(popularity, 1)) / Math.log10(1000), 1) * 15
  }

  return Math.round(Math.min(score, 100))
}

// ── Key storage (localStorage) ────────────────────────────────────────────────
function getStoredKeys() {
  try {
    return JSON.parse(localStorage.getItem('media_search_keys') || '{}')
  } catch {
    return {}
  }
}

export function saveApiKey(keyName, value) {
  const keys = getStoredKeys()
  keys[keyName] = value.trim()
  localStorage.setItem('media_search_keys', JSON.stringify(keys))
}

export function loadApiKeys() {
  return getStoredKeys()
}

// ── URL builder ───────────────────────────────────────────────────────────────
function buildUrl(source, query) {
  const keys = getStoredKeys()
  return source.url
    .replace('{query}', encodeURIComponent(query))
    .replace('{key}', keys[source.keyName] || '')
}

// ── Result normalizer ─────────────────────────────────────────────────────────
// Like Sherlock's per-site response parser: maps raw API fields → unified shape
function normalizeResult(raw, { parse, id: sourceId, name: sourceName, type }) {
  const f = parse.fields
  const rawYear = raw[f.year] || ''
  const year = rawYear ? rawYear.toString().slice(0, 4) : ''

  const rawRating = raw[f.rating]
  const ratingMax = f.ratingMax || 10
  // Normalize everything to a 0–10 scale
  const rating = rawRating != null ? (rawRating / ratingMax) * 10 : 0

  const voteCount = raw[f.voteCount] || 0
  const popularity = f.popularity ? (raw[f.popularity] || 0) : 0

  let poster = ''
  if (f.posterBase && raw[f.poster]) {
    poster = f.posterBase + raw[f.poster]
  } else if (raw[f.poster]) {
    // iTunes returns 100px artwork; upscale to 300px
    poster = raw[f.poster].replace('100x100bb', '300x300bb')
  }

  const result = {
    id: `${sourceId}_${raw[f.id]}`,
    title: raw[f.title] || '',
    year,
    rating: Math.round(rating * 10) / 10,
    voteCount,
    popularity,
    overview: raw[f.overview] || '',
    poster,
    genre: f.genre ? (raw[f.genre] || '') : '',
    sourceId,
    sourceName,
    type,
  }

  result.qualityScore = computeQualityScore(result)
  return result
}

// ── Per-source fetcher ────────────────────────────────────────────────────────
// Sherlock equivalent: one HTTP probe per site, independent of others
async function fetchFromSource(source, query) {
  if (!source.enabled) return []

  const keys = getStoredKeys()
  if (source.requiresKey && !keys[source.keyName]) return []

  const url = buildUrl(source, query)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []

    const data = await res.json()
    const rawList = source.parse.resultsPath ? data[source.parse.resultsPath] : data

    if (!Array.isArray(rawList)) return []

    return rawList
      .filter(r => r[source.parse.fields.title])
      .map(r => normalizeResult(r, source))
  } catch {
    return []
  }
}

// ── Deduplication ─────────────────────────────────────────────────────────────
// Maigret-style: keep the richer record when the same title+year appears
// from multiple sources
function deduplicateResults(results) {
  const seen = new Map()
  for (const r of results) {
    const key = `${r.title.toLowerCase().trim()}|${r.year}`
    const existing = seen.get(key)
    if (!existing || existing.qualityScore < r.qualityScore) {
      seen.set(key, r)
    }
  }
  return Array.from(seen.values())
}

// ── Public API ────────────────────────────────────────────────────────────────
// searchMedia: fires all enabled sources concurrently (Promise.all),
// then merges, deduplicates, and sorts by quality score.
export async function searchMedia(query, typeFilter = 'all') {
  if (!query.trim()) return []

  const sources = sourcesConfig.sources.filter(s =>
    typeFilter === 'all' || s.type === typeFilter
  )

  const batches = await Promise.all(sources.map(s => fetchFromSource(s, query)))
  const flat = batches.flat()
  const deduped = deduplicateResults(flat)

  return deduped
    .filter(r => r.title)
    .sort((a, b) => b.qualityScore - a.qualityScore)
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
