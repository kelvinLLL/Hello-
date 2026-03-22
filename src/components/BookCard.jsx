import { useState } from 'react'

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function BookCard({ book, gradient, onOpen, onDelete }) {
  const [imgError, setImgError] = useState(false)
  const [colors] = useState(gradient || ['#6366f1', '#8b5cf6'])

  const progressPct = Math.round((book.progress || 0) * 100)
  const isStarted = book.lastRead !== null

  return (
    <div
      className="book-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      aria-label={`Open ${book.title}`}
    >
      {/* Cover */}
      <div className="book-cover">
        {book.cover && !imgError ? (
          <img
            src={book.cover}
            alt={`Cover of ${book.title}`}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div
            className="book-cover-placeholder"
            style={{
              background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
            }}
          >
            <span>{book.format === 'pdf' ? '📄' : '📖'}</span>
            {book.title.slice(0, 30)}
          </div>
        )}

        {/* Format badge */}
        <span className={`book-format-badge format-${book.format}`}>
          {book.format.toUpperCase()}
        </span>

        {/* Hover overlay */}
        <div className="book-card-overlay">
          <div className="book-read-btn">
            {isStarted ? 'Continue Reading' : 'Start Reading'}
          </div>
        </div>
      </div>

      {/* Delete button */}
      <div className="book-card-actions">
        <button
          className="book-delete-btn"
          onClick={onDelete}
          title="Remove from library"
          aria-label={`Remove ${book.title}`}
        >
          ✕
        </button>
      </div>

      {/* Info */}
      <div className="book-info">
        <div className="book-title" title={book.title}>{book.title}</div>
        {book.author && <div className="book-author">{book.author}</div>}

        <div className="book-progress-bar">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="progress-text">
            {progressPct === 0 ? 'Not started' : progressPct === 100 ? 'Finished ✓' : `${progressPct}%`}
          </span>
        </div>
      </div>
    </div>
  )
}
