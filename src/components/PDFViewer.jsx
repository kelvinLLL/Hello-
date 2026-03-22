import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'

let pdfjsLib = null

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib
  const lib = await import('pdfjs-dist')
  lib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url,
  ).href
  pdfjsLib = lib
  return lib
}

const BG = {
  light: '#f1f5f9',
  dark:  '#0a0f1e',
  sepia: '#e8dfd0',
}

const PDFViewer = forwardRef(function PDFViewer(
  { fileData, settings, onPageChange, savedPage = 1 },
  ref
) {
  const [pdf, setPdf] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(savedPage || 1)
  const [scale, setScale] = useState(null) // null = auto-fit
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const canvasRefs = useRef({})
  const renderQueueRef = useRef(new Set())
  const observerRef = useRef(null)

  useImperativeHandle(ref, () => ({
    next: () => setCurrentPage((p) => Math.min(p + 1, numPages)),
    prev: () => setCurrentPage((p) => Math.max(p - 1, 1)),
    goToPage: (p) => setCurrentPage(Math.min(Math.max(1, p), numPages)),
    getNumPages: () => numPages,
    search: async (query) => {
      if (!pdf || !query) return []
      const results = []
      for (let i = 1; i <= Math.min(numPages, 100); i++) {
        try {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          const text = textContent.items.map((item) => item.str).join(' ')
          if (text.toLowerCase().includes(query.toLowerCase())) {
            results.push({ page: i, excerpt: text.slice(0, 100) })
          }
        } catch {}
      }
      return results
    },
  }))

  // Load PDF
  useEffect(() => {
    if (!fileData) return
    setLoading(true)
    setError(null)

    let cancelled = false

    getPdfjs().then(async (lib) => {
      try {
        const doc = await lib.getDocument({ data: fileData.slice(0) }).promise
        if (cancelled) { doc.destroy(); return }
        setPdf(doc)
        setNumPages(doc.numPages)
        setCurrentPage(savedPage || 1)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load PDF. The file may be corrupted.')
          setLoading(false)
        }
      }
    })

    return () => { cancelled = true }
  }, [fileData])

  // Compute auto scale to fit container width
  const computeScale = useCallback(async (page) => {
    if (!containerRef.current) return 1.5
    const containerW = containerRef.current.clientWidth - 40
    const viewport = page.getViewport({ scale: 1 })
    return Math.min(containerW / viewport.width, 2.5)
  }, [])

  // Render a single page to canvas
  const renderPage = useCallback(async (pageNum) => {
    if (!pdf || renderQueueRef.current.has(pageNum)) return
    renderQueueRef.current.add(pageNum)

    try {
      const page = await pdf.getPage(pageNum)
      const s = scale || await computeScale(page)
      const viewport = page.getViewport({ scale: s })

      const canvas = canvasRefs.current[pageNum]
      if (!canvas) { renderQueueRef.current.delete(pageNum); return }

      const ctx = canvas.getContext('2d')
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: ctx, viewport }).promise
    } catch (err) {
      console.warn(`Page ${pageNum} render error:`, err)
    } finally {
      renderQueueRef.current.delete(pageNum)
    }
  }, [pdf, scale, computeScale])

  // Render visible pages using Intersection Observer
  useEffect(() => {
    if (!pdf || numPages === 0) return

    observerRef.current?.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.dataset.page)
            renderPage(pageNum)
            // Track current page for progress
            setCurrentPage(pageNum)
            onPageChange && onPageChange(pageNum, numPages)
          }
        })
      },
      { root: containerRef.current, rootMargin: '200px', threshold: 0.1 }
    )

    // Observe all page sentinels
    containerRef.current?.querySelectorAll('[data-page]').forEach((el) => {
      observerRef.current.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [pdf, numPages, renderPage, onPageChange])

  // Scroll to page
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-page="${currentPage}"]`)
    if (el && !observerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [currentPage])

  if (error) {
    return (
      <div className="reader-error">
        <div className="reader-error-icon">⚠️</div>
        <h3>Could not load PDF</h3>
        <p>{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="pdf-loading">
        <div className="spinner" />
        <p>Loading PDF…</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="pdf-viewer"
      style={{ background: BG[settings.theme] || BG.light }}
    >
      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
        <div
          key={pageNum}
          className="pdf-page"
          data-page={pageNum}
          style={{ position: 'relative' }}
        >
          <canvas
            ref={(el) => { canvasRefs.current[pageNum] = el }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              right: 8,
              fontSize: 11,
              color: 'rgba(128,128,128,0.6)',
              fontFamily: 'sans-serif',
              pointerEvents: 'none',
            }}
          >
            {pageNum} / {numPages}
          </div>
        </div>
      ))}
    </div>
  )
})

export default PDFViewer
