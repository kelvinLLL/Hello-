import { useState, useEffect, useRef, useCallback } from 'react'
import { getBooks, saveBooks, saveBookFile, deleteBookFile } from '../db.js'
import BookCard from '../components/BookCard.jsx'

// Generate a gradient cover placeholder from book title
function titleToGradient(title = '') {
  const colors = [
    ['#6366f1', '#8b5cf6'], ['#3b82f6', '#6366f1'], ['#0ea5e9', '#3b82f6'],
    ['#10b981', '#0ea5e9'], ['#f59e0b', '#ef4444'], ['#ec4899', '#8b5cf6'],
    ['#14b8a6', '#6366f1'], ['#f97316', '#ec4899'], ['#84cc16', '#14b8a6'],
    ['#ef4444', '#f97316'],
  ]
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0
  return colors[Math.abs(hash) % colors.length]
}

// Extract EPUB metadata using epubjs
async function parseEpub(arrayBuffer) {
  const { default: ePub } = await import('epubjs')
  const book = ePub(arrayBuffer.slice(0))
  await book.ready
  const meta = await book.loaded.metadata
  let coverUrl = null
  try {
    const coverHref = await book.coverUrl()
    coverUrl = coverHref
  } catch {}
  book.destroy()
  return {
    title: meta.title || 'Untitled',
    author: meta.creator || 'Unknown Author',
    cover: coverUrl,
  }
}

// Render PDF first page as thumbnail
async function parsePdf(arrayBuffer) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url,
  ).href

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 0.5 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  const cover = canvas.toDataURL('image/jpeg', 0.7)
  pdf.destroy()
  return {
    title: 'PDF Document',
    author: '',
    cover,
    pages: pdf.numPages || 0,
  }
}

export default function Library({ onOpenBook }) {
  const [books, setBooks] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const fileInputRef = useRef(null)
  const toastTimerRef = useRef(null)

  useEffect(() => {
    const localBooks = getBooks()
    setBooks(localBooks)

    // Load preset books from public/books/manifest.json
    fetch('/books/manifest.json')
      .then(r => r.json())
      .then(manifest => {
        const localIds = new Set(localBooks.map(b => b.id))
        const presetBooks = manifest
          .filter(p => !localIds.has(p.id))
          .map(p => ({
            ...p,
            url: `/books/${encodeURIComponent(p.filename)}`,
            preset: true,
            progress: 0,
            location: null,
            lastRead: null,
            addedAt: 0,
            fileSize: 0,
            cover: null,
          }))
        if (presetBooks.length > 0) {
          setBooks(prev => {
            const ids = new Set(prev.map(b => b.id))
            return [...prev, ...presetBooks.filter(b => !ids.has(b.id))]
          })
        }
      })
      .catch(() => {}) // no manifest = no preset books
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  const processFile = async (file) => {
    const fmt = file.name.toLowerCase()
    if (!fmt.endsWith('.pdf') && !fmt.endsWith('.epub')) {
      showToast('Only PDF and EPUB files are supported')
      return
    }

    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const id = `book_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const format = fmt.endsWith('.pdf') ? 'pdf' : 'epub'

      let meta = { title: file.name.replace(/\.(pdf|epub)$/i, ''), author: 'Unknown Author', cover: null }

      try {
        if (format === 'epub') {
          meta = await parseEpub(buffer)
        } else {
          meta = await parsePdf(buffer)
        }
      } catch (err) {
        console.warn('Metadata extraction failed:', err)
      }

      await saveBookFile(id, buffer)

      const book = {
        id,
        title: meta.title || file.name,
        author: meta.author || '',
        cover: meta.cover || null,
        format,
        progress: 0,
        location: null,
        lastRead: null,
        addedAt: Date.now(),
        fileSize: file.size,
      }

      const updated = [book, ...getBooks()]
      saveBooks(updated)
      setBooks(updated)
      showToast(`Added "${book.title}"`)
    } catch (err) {
      console.error('Error adding book:', err)
      showToast('Failed to add book. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleFiles = (files) => {
    Array.from(files).forEach(processFile)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleFileInput = (e) => {
    handleFiles(e.target.files)
    e.target.value = ''
  }

  const deleteBook = async (e, bookId) => {
    e.stopPropagation()
    const book = books.find(b => b.id === bookId)
    if (!book || book.preset) return
    if (!confirm(`Remove "${book.title}" from your library?`)) return
    await deleteBookFile(bookId)
    const updated = books.filter(b => b.id !== bookId)
    saveBooks(updated)
    setBooks(updated)
    showToast('Book removed')
  }

  const sortedBooks = [...books].sort((a, b) => {
    if (a.lastRead && b.lastRead) return b.lastRead - a.lastRead
    if (a.lastRead) return -1
    if (b.lastRead) return 1
    return b.addedAt - a.addedAt
  })

  const recentBooks = sortedBooks.filter(b => b.lastRead)
  const allBooks = sortedBooks

  return (
    <div className="library">
      {/* Hero */}
      <div className="library-hero">
        <div className="library-hero-decoration" />
        <div className="library-hero-content">
          <div className="library-logo">
            <div className="library-logo-icon">📚</div>
            <span className="library-logo-text">Folio</span>
          </div>
          <h1>Your Reading Space</h1>
          <p>Upload PDF or EPUB books and enjoy a beautiful, distraction-free reading experience — right in your browser.</p>
        </div>
      </div>

      {/* Body */}
      <div className="library-body">
        {/* Drop Zone */}
        <div
          className={`dropzone ${dragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          aria-label="Upload PDF or EPUB file"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.epub"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          {loading ? (
            <>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <h3>Processing your book…</h3>
              <p>Extracting metadata and cover</p>
            </>
          ) : (
            <>
              <span className="dropzone-icon">📖</span>
              <h3>Drop your book here</h3>
              <p>Drag and drop a PDF or EPUB file, or click to browse</p>
              <button className="dropzone-btn" onClick={(e) => e.stopPropagation()}>
                <span>＋</span> Choose File
              </button>
              <div className="dropzone-formats">
                <span className="format-badge">PDF</span>
                <span className="format-badge">EPUB</span>
              </div>
            </>
          )}
        </div>

        {/* Recent books */}
        {recentBooks.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div className="library-section-header">
              <h2 className="library-section-title">Continue Reading</h2>
            </div>
            <div className="books-grid">
              {recentBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  gradient={titleToGradient(book.title)}
                  onOpen={() => onOpenBook(book)}
                  onDelete={(e) => deleteBook(e, book.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All books */}
        {allBooks.length > 0 ? (
          <div>
            <div className="library-section-header">
              <h2 className="library-section-title">
                {recentBooks.length > 0 ? 'All Books' : 'Your Books'}
              </h2>
              <span className="book-count">{allBooks.length} {allBooks.length === 1 ? 'book' : 'books'}</span>
            </div>
            <div className="books-grid">
              {allBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  gradient={titleToGradient(book.title)}
                  onOpen={() => onOpenBook(book)}
                  onDelete={(e) => deleteBook(e, book.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          !loading && (
            <div className="empty-state">
              <div className="empty-state-icon">📚</div>
              <h3>Your library is empty</h3>
              <p>Upload a PDF or EPUB file to get started.<br />Your books are stored privately in your browser.</p>
            </div>
          )
        )}
      </div>

      {/* Toast */}
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  )
}
