import { useState } from 'react'

export default function TOCSidebar({
  isOpen,
  onClose,
  toc,
  bookmarks,
  currentHref,
  onTocClick,
  onBookmarkClick,
  onBookmarkDelete,
  format,
}) {
  const [tab, setTab] = useState('toc')

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`toc-sidebar ${isOpen ? 'open' : 'closed'}`} aria-label="Table of contents">
        <div className="sidebar-header">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${tab === 'toc' ? 'active' : ''}`}
              onClick={() => setTab('toc')}
            >
              Contents
            </button>
            <button
              className={`sidebar-tab ${tab === 'bookmarks' ? 'active' : ''}`}
              onClick={() => setTab('bookmarks')}
            >
              Bookmarks {bookmarks.length > 0 && `(${bookmarks.length})`}
            </button>
          </div>
          <button
            className="toolbar-btn"
            onClick={onClose}
            aria-label="Close sidebar"
            style={{ fontSize: 16 }}
          >
            ✕
          </button>
        </div>

        <div className="sidebar-content">
          {tab === 'toc' ? (
            toc.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                {format === 'pdf'
                  ? 'PDF outlines are not available.'
                  : 'No table of contents found.'}
              </div>
            ) : (
              toc.map((item, i) => (
                <div
                  key={i}
                  className={`toc-item ${item.href === currentHref ? 'active' : ''}`}
                  data-depth={item.depth}
                  onClick={() => {
                    onTocClick(item.href)
                    if (window.innerWidth <= 768) onClose()
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onTocClick(item.href)}
                >
                  <span className="toc-item-dot" />
                  <span>{item.label}</span>
                </div>
              ))
            )
          ) : (
            bookmarks.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                No bookmarks yet.<br />
                <span style={{ color: 'var(--text-2)' }}>Press 📑 or B to add one.</span>
              </div>
            ) : (
              bookmarks.map((bm, i) => (
                <div
                  key={i}
                  className="bookmark-item"
                  onClick={() => {
                    onBookmarkClick(bm)
                    if (window.innerWidth <= 768) onClose()
                  }}
                >
                  <span className="bookmark-icon">🔖</span>
                  <div className="bookmark-text">{bm.label || bm.excerpt || `Page ${bm.page}`}</div>
                  <button
                    className="bookmark-del"
                    onClick={(e) => { e.stopPropagation(); onBookmarkDelete(i) }}
                    title="Remove bookmark"
                    aria-label="Remove bookmark"
                  >
                    ✕
                  </button>
                </div>
              ))
            )
          )}
        </div>
      </aside>
    </>
  )
}
