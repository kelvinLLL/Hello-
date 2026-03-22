export default function Toolbar({
  title,
  onClose,
  onToggleToc,
  tocOpen,
  onToggleSettings,
  settingsOpen,
  onToggleSearch,
  searchOpen,
  onToggleFullscreen,
  isFullscreen,
  onAddBookmark,
  isBookmarked,
}) {
  return (
    <div className="reader-toolbar">
      {/* Back */}
      <button
        className="toolbar-btn"
        onClick={onClose}
        title="Back to Library (Esc)"
        aria-label="Back to library"
      >
        ←
      </button>

      <div className="toolbar-divider" />

      {/* TOC */}
      <button
        className={`toolbar-btn ${tocOpen ? 'active' : ''}`}
        onClick={onToggleToc}
        title="Table of Contents (T)"
        aria-label="Toggle table of contents"
        aria-pressed={tocOpen}
      >
        ☰
      </button>

      {/* Title */}
      <div className="toolbar-title" title={title}>{title}</div>

      {/* Search */}
      <button
        className={`toolbar-btn ${searchOpen ? 'active' : ''}`}
        onClick={onToggleSearch}
        title="Search (Ctrl+F)"
        aria-label="Search in book"
        aria-pressed={searchOpen}
      >
        🔍
      </button>

      {/* Bookmark current location */}
      <button
        className={`toolbar-btn ${isBookmarked ? 'active' : ''}`}
        onClick={onAddBookmark}
        title="Bookmark this page (B)"
        aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
      >
        {isBookmarked ? '🔖' : '📑'}
      </button>

      <div className="toolbar-divider" />

      {/* Settings */}
      <button
        className={`toolbar-btn ${settingsOpen ? 'active' : ''}`}
        onClick={onToggleSettings}
        title="Reading settings (S)"
        aria-label="Reading settings"
        aria-pressed={settingsOpen}
      >
        ⚙
      </button>

      {/* Fullscreen */}
      <button
        className={`toolbar-btn ${isFullscreen ? 'active' : ''}`}
        onClick={onToggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? '⊡' : '⛶'}
      </button>
    </div>
  )
}
