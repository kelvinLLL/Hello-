import { useState, useEffect, useRef, useCallback } from 'react'
import Toolbar from '../components/Toolbar.jsx'
import TOCSidebar from '../components/TOCSidebar.jsx'
import SettingsPanel from '../components/SettingsPanel.jsx'
import SearchPanel from '../components/SearchPanel.jsx'
import EpubViewer from '../components/EpubViewer.jsx'
import PDFViewer from '../components/PDFViewer.jsx'
import { getBookFile, getSettings, saveSettings, updateBookProgress, getBooks, saveBooks } from '../db.js'

export default function Reader({ book, onClose }) {
  const [fileData, setFileData] = useState(null)
  const [fileLoading, setFileLoading] = useState(true)
  const [fileError, setFileError] = useState(null)

  // UI state
  const [tocOpen, setTocOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [toast, setToast] = useState(null)

  // Book state
  const [toc, setToc] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [currentHref, setCurrentHref] = useState(null)
  const [progress, setProgress] = useState(book.progress || 0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  // Settings
  const [settings, setSettings] = useState(getSettings)

  // Search
  const [searchResults, setSearchResults] = useState([])
  const [searchIdx, setSearchIdx] = useState(0)

  const viewerRef = useRef(null)
  const toastTimerRef = useRef(null)

  // Load book file from IndexedDB
  useEffect(() => {
    setFileLoading(true)
    getBookFile(book.id)
      .then((data) => {
        if (!data) { setFileError('Book file not found.'); return }
        setFileData(data)
      })
      .catch(() => setFileError('Failed to load book file.'))
      .finally(() => setFileLoading(false))

    // Load bookmarks
    const saved = localStorage.getItem(`folio_bm_${book.id}`)
    if (saved) {
      try { setBookmarks(JSON.parse(saved)) } catch {}
    }
  }, [book.id])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    localStorage.setItem('folio_theme', settings.theme)
  }, [settings.theme])

  // Save settings on change
  useEffect(() => { saveSettings(settings) }, [settings])

  // Auto-save progress
  useEffect(() => {
    if (book.format === 'pdf' && totalPages > 0) {
      const p = currentPage / totalPages
      updateBookProgress(book.id, p, String(currentPage))
      setProgress(p)
    }
  }, [currentPage, totalPages, book.id, book.format])

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Don't intercept when typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          if (!e.ctrlKey && !e.metaKey) viewerRef.current?.next?.()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          if (!e.ctrlKey && !e.metaKey) viewerRef.current?.prev?.()
          break
        case 'Escape':
          if (settingsOpen) { setSettingsOpen(false); break }
          if (searchOpen) { setSearchOpen(false); break }
          if (tocOpen) { setTocOpen(false); break }
          onClose()
          break
        case 't':
        case 'T':
          setTocOpen((v) => !v)
          break
        case 's':
        case 'S':
          setSettingsOpen((v) => !v)
          break
        case 'b':
        case 'B':
          handleAddBookmark()
          break
        case 'f':
        case 'F':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setSearchOpen((v) => !v)
          } else {
            handleFullscreen()
          }
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [settingsOpen, searchOpen, tocOpen, bookmarks])

  // Touch swipe support
  useEffect(() => {
    let startX = 0
    const onTouchStart = (e) => { startX = e.touches[0].clientX }
    const onTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - startX
      if (Math.abs(dx) < 50) return
      if (dx < 0) viewerRef.current?.next?.()
      else viewerRef.current?.prev?.()
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const handleAddBookmark = () => {
    const loc = book.format === 'epub'
      ? (currentHref || 'start')
      : String(currentPage)

    const existing = bookmarks.findIndex((bm) => bm.loc === loc)
    let updated

    if (existing !== -1) {
      updated = bookmarks.filter((_, i) => i !== existing)
      showToast('Bookmark removed')
    } else {
      const label = book.format === 'pdf'
        ? `Page ${currentPage}`
        : toc.find((t) => t.href === currentHref)?.label || `Location`
      updated = [...bookmarks, { loc, label, page: currentPage }]
      showToast('Bookmark added')
    }

    setBookmarks(updated)
    localStorage.setItem(`folio_bm_${book.id}`, JSON.stringify(updated))
  }

  const isBookmarked = book.format === 'epub'
    ? bookmarks.some((bm) => bm.loc === currentHref)
    : bookmarks.some((bm) => bm.loc === String(currentPage))

  const handleTocClick = (href) => {
    viewerRef.current?.goTo?.(href)
    setCurrentHref(href)
  }

  const handleBookmarkClick = (bm) => {
    if (book.format === 'epub') {
      viewerRef.current?.goTo?.(bm.loc)
    } else {
      const page = parseInt(bm.loc)
      if (!isNaN(page)) viewerRef.current?.goToPage?.(page)
    }
  }

  const handleEpubLocation = ({ cfi, progress, chapter }) => {
    setCurrentHref(cfi)
    setProgress(progress)
    updateBookProgress(book.id, progress, cfi)
  }

  const handlePdfPageChange = (page, total) => {
    setCurrentPage(page)
    setTotalPages(total)
  }

  const handleSearch = async (query) => {
    const results = await viewerRef.current?.search?.(query)
    if (!results || results.length === 0) {
      showToast('No results found')
      return
    }
    setSearchResults(results)
    setSearchIdx(0)
    // Navigate to first result
    if (results[0]) {
      if (book.format === 'epub') viewerRef.current?.goTo?.(results[0].cfi)
      else viewerRef.current?.goToPage?.(results[0].page)
    }
  }

  const handleSearchNav = (dir) => {
    if (searchResults.length === 0) return
    const next = dir === 'next'
      ? (searchIdx + 1) % searchResults.length
      : (searchIdx - 1 + searchResults.length) % searchResults.length
    setSearchIdx(next)
    const r = searchResults[next]
    if (r) {
      if (book.format === 'epub') viewerRef.current?.goTo?.(r.cfi)
      else viewerRef.current?.goToPage?.(r.page)
    }
  }

  const progressPct = Math.round(progress * 100)

  return (
    <div className="reader">
      {/* Top Toolbar */}
      <Toolbar
        title={book.title}
        onClose={onClose}
        tocOpen={tocOpen}
        onToggleToc={() => setTocOpen((v) => !v)}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((v) => !v)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleFullscreen}
        onAddBookmark={handleAddBookmark}
        isBookmarked={isBookmarked}
      />

      {/* Body: sidebar + viewer */}
      <div className="reader-body">
        <TOCSidebar
          isOpen={tocOpen}
          onClose={() => setTocOpen(false)}
          toc={toc}
          bookmarks={bookmarks}
          currentHref={currentHref}
          onTocClick={handleTocClick}
          onBookmarkClick={handleBookmarkClick}
          onBookmarkDelete={(i) => {
            const updated = bookmarks.filter((_, idx) => idx !== i)
            setBookmarks(updated)
            localStorage.setItem(`folio_bm_${book.id}`, JSON.stringify(updated))
          }}
          format={book.format}
        />

        {/* Viewer area */}
        <div className="viewer-area">
          {/* Search bar */}
          {searchOpen && (
            <SearchPanel
              onSearch={handleSearch}
              onClose={() => { setSearchOpen(false); setSearchResults([]) }}
              onResult={handleSearchNav}
              results={searchResults}
              currentResult={searchResults.length > 0 ? searchIdx + 1 : 0}
              totalResults={searchResults.length}
            />
          )}

          {/* Loading state */}
          {fileLoading && (
            <div className="pdf-loading">
              <div className="spinner" />
              <p>Opening book…</p>
            </div>
          )}

          {/* Error state */}
          {fileError && (
            <div className="reader-error">
              <div className="reader-error-icon">⚠️</div>
              <h3>Could not open book</h3>
              <p>{fileError}</p>
            </div>
          )}

          {/* EPUB Viewer */}
          {!fileLoading && !fileError && fileData && book.format === 'epub' && (
            <div
              className="epub-viewer-wrap"
              style={{
                padding: '0',
                position: 'relative',
                flex: 1,
                overflow: 'hidden',
              }}
            >
              {/* Left/Right navigation arrows */}
              <button
                className="nav-arrow nav-arrow-prev"
                onClick={() => viewerRef.current?.prev?.()}
                aria-label="Previous page"
              >
                ‹
              </button>
              <button
                className="nav-arrow nav-arrow-next"
                onClick={() => viewerRef.current?.next?.()}
                aria-label="Next page"
              >
                ›
              </button>

              <EpubViewer
                ref={viewerRef}
                fileData={fileData}
                settings={settings}
                onTocLoad={setToc}
                onLocationChange={handleEpubLocation}
                savedLocation={book.location}
              />
            </div>
          )}

          {/* PDF Viewer */}
          {!fileLoading && !fileError && fileData && book.format === 'pdf' && (
            <PDFViewer
              ref={viewerRef}
              fileData={fileData}
              settings={settings}
              onPageChange={handlePdfPageChange}
              savedPage={book.location ? parseInt(book.location) : 1}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="reader-footer">
        {/* Navigation buttons */}
        <div className="footer-nav">
          <button
            className="footer-nav-btn"
            onClick={() => viewerRef.current?.prev?.()}
            title="Previous page (←)"
            aria-label="Previous page"
          >
            ‹
          </button>
          <button
            className="footer-nav-btn"
            onClick={() => viewerRef.current?.next?.()}
            title="Next page (→)"
            aria-label="Next page"
          >
            ›
          </button>
        </div>

        {/* Progress */}
        <div className="footer-progress">
          <div
            className="footer-progress-track"
            title={`${progressPct}% complete`}
            aria-label={`Reading progress: ${progressPct}%`}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="footer-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Location info */}
        <div className="footer-location">
          {book.format === 'pdf' && totalPages > 0
            ? `${currentPage} / ${totalPages}`
            : progressPct > 0
            ? `${progressPct}%`
            : ''}
        </div>

        {/* Bookmark button */}
        <button
          className={`footer-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
          onClick={handleAddBookmark}
          title={isBookmarked ? 'Remove bookmark (B)' : 'Add bookmark (B)'}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this location'}
        >
          {isBookmarked ? '🔖' : '📑'}
        </button>
      </div>

      {/* Settings Panel */}
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Toast */}
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  )
}
