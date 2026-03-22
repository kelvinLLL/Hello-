import { useState, useRef, useEffect } from 'react'

export default function SearchPanel({ onSearch, onClose, onResult, results, currentResult, totalResults }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) onSearch(query.trim())
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter') {
      e.preventDefault()
      if (query.trim()) onSearch(query.trim())
    }
  }

  return (
    <div className="search-panel" role="search" aria-label="Search in book">
      <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: 8 }}>
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            placeholder="Search in book…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search query"
          />
        </div>
        {totalResults > 0 && (
          <div className="search-nav">
            <span className="search-count">{currentResult}/{totalResults}</span>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => onResult('prev')}
              title="Previous result"
              aria-label="Previous result"
            >
              ↑
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => onResult('next')}
              title="Next result"
              aria-label="Next result"
            >
              ↓
            </button>
          </div>
        )}
      </form>
      <button
        className="toolbar-btn"
        onClick={onClose}
        title="Close search"
        aria-label="Close search"
      >
        ✕
      </button>
    </div>
  )
}
