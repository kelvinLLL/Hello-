import { useState, useEffect } from 'react'
import Library from './views/Library.jsx'
import Reader from './views/Reader.jsx'
import MediaSearch from './mediaSearch/MediaSearch.jsx'
import { shouldShowSiteChrome } from './mobileReaderShell.js'

export default function App() {
  const [view, setView] = useState('library')
  const [currentBook, setCurrentBook] = useState(null)

  // Apply saved theme on load
  useEffect(() => {
    const saved = localStorage.getItem('folio_theme') || 'light'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const openBook = (book) => {
    setCurrentBook(book)
    setView('reader')
    document.title = `${book.title} — Folio`
  }

  const closeBook = () => {
    setView('library')
    setCurrentBook(null)
    document.title = 'Folio — Beautiful Ebook Reader'
  }

  return (
    <div className={`site-shell ${view === 'reader' ? 'reader-active' : ''}`}>
      {shouldShowSiteChrome(view) && (
        <header className="site-chrome">
          <a className="site-chrome-brand" href="/">kelvin11888.blog</a>
          <nav className="site-chrome-nav">
            <a href="/book-reader/" aria-current="page">Book Reader</a>
            <a href="/daily-nuance/">Daily Nuance</a>
            <button
              className="site-chrome-nav-btn"
              onClick={() => setView(v => v === 'media' ? 'library' : 'media')}
              style={{ marginLeft: '8px', padding: '4px 12px', borderRadius: '6px', background: view === 'media' ? 'var(--accent)' : 'var(--bg-3)', color: view === 'media' ? '#fff' : 'var(--text)', fontSize: '14px' }}
            >
              🎬 影视
            </button>
          </nav>
        </header>
      )}
      <div className="site-shell-body">
        <div className="app">
          {view === 'library' && <Library onOpenBook={openBook} />}
          {view === 'reader' && <Reader book={currentBook} onClose={closeBook} />}
          {view === 'media' && <MediaSearch />}
        </div>
      </div>
    </div>
  )
}
