import { useState, useCallback, useRef } from 'react'
import { searchMedia, saveApiKey, loadApiKeys, getSourceStatus } from './searchEngine.js'
import ResultCard from './ResultCard.jsx'

const TYPE_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'movie', label: '电影' },
  { value: 'tv', label: '剧集' },
]

export default function MediaSearch() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState(loadApiKeys().tmdb_api_key || '')
  const [keySaved, setKeySaved] = useState(false)
  const abortRef = useRef(null)

  const runSearch = useCallback(async (q, type) => {
    if (!q.trim()) return
    if (abortRef.current) abortRef.current()

    setLoading(true)
    setSearched(true)
    setResults([])

    let cancelled = false
    abortRef.current = () => { cancelled = true }

    const data = await searchMedia(q, type)
    if (!cancelled) {
      setResults(data)
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    runSearch(query, typeFilter)
  }

  const handleTypeChange = (type) => {
    setTypeFilter(type)
    if (searched) runSearch(query, type)
  }

  const handleSaveKey = () => {
    saveApiKey('tmdb_api_key', apiKeyInput)
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2000)
  }

  const sources = getSourceStatus()
  const activeCount = sources.filter(s => s.active).length

  return (
    <div className="ms-root">
      <div className="ms-header">
        <div className="ms-header-top">
          <div>
            <h1 className="ms-title">影视搜索</h1>
            <p className="ms-subtitle">
              并发检索多个数据源 · 综合质量评分
              <span className="ms-source-badge">{activeCount} 个数据源</span>
            </p>
          </div>
          <button
            className="ms-settings-btn"
            onClick={() => setShowSettings(s => !s)}
            aria-label="设置"
          >
            ⚙
          </button>
        </div>

        {showSettings && (
          <div className="ms-settings-panel">
            <h3 className="ms-settings-title">数据源配置</h3>
            <div className="ms-source-list">
              {sources.map(s => (
                <div key={s.id} className="ms-source-item">
                  <span className={`ms-source-dot ${s.active ? 'active' : 'inactive'}`} />
                  <span>{s.name}</span>
                  <span className="ms-source-status">{s.active ? '已启用' : '需要 API Key'}</span>
                </div>
              ))}
            </div>
            <div className="ms-key-row">
              <label className="ms-key-label">
                TMDB API Key
                <a
                  href="https://www.themoviedb.org/settings/api"
                  target="_blank"
                  rel="noreferrer"
                  className="ms-key-link"
                >免费获取 →</a>
              </label>
              <div className="ms-key-input-row">
                <input
                  type="password"
                  className="ms-key-input"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="粘贴你的 TMDB v3 API Key"
                />
                <button className="ms-key-save" onClick={handleSaveKey}>
                  {keySaved ? '✓ 已保存' : '保存'}
                </button>
              </div>
              <p className="ms-key-hint">Key 仅存储在本地 localStorage，不会上传。</p>
            </div>
          </div>
        )}

        <form className="ms-search-form" onSubmit={handleSubmit}>
          <div className="ms-search-bar">
            <input
              className="ms-search-input"
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索电影或电视剧…"
              autoFocus
            />
            <button className="ms-search-btn" type="submit" disabled={loading || !query.trim()}>
              {loading ? <span className="ms-spinner" /> : '搜索'}
            </button>
          </div>
          <div className="ms-filter-row">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                className={`ms-filter-chip ${typeFilter === f.value ? 'active' : ''}`}
                onClick={() => handleTypeChange(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </form>
      </div>

      <div className="ms-body">
        {loading && (
          <div className="ms-status">
            <span className="ms-spinner ms-spinner-lg" />
            <p>正在并发查询 {activeCount} 个数据源…</p>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="ms-status">
            <p className="ms-empty-icon">🎬</p>
            <p>未找到相关影视内容</p>
            {activeCount < 4 && (
              <p className="ms-hint">提示：配置 TMDB API Key 可获得更多结果</p>
            )}
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <p className="ms-result-count">共 {results.length} 条结果，按质量分排序</p>
            <div className="ms-grid">
              {results.map(r => <ResultCard key={r.id} result={r} />)}
            </div>
          </>
        )}

        {!searched && (
          <div className="ms-welcome">
            <div className="ms-welcome-inner">
              <p className="ms-welcome-icon">🎥</p>
              <h2>发现优质影视</h2>
              <p>同时搜索 iTunes、TMDB 等多个数据库<br />综合评分、评价数量、热度自动排序</p>
              <div className="ms-arch-note">
                <h3>架构说明 — 借鉴 Sherlock / Maigret 模式</h3>
                <ul>
                  <li><strong>sources.json</strong> — 数据源配置文件（类比 Sherlock 的 data.json）</li>
                  <li><strong>并发 Promise.all</strong> — 同时查询所有启用的数据源</li>
                  <li><strong>去重合并</strong> — 同名结果保留质量分最高的版本</li>
                  <li><strong>质量分</strong> — 评分 + 评价数 + 上映年份 + 热度综合计算</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
