import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react'

const FONT_FAMILIES = {
  serif:      '"Georgia", "Times New Roman", serif',
  sans:       '"Inter", "Helvetica Neue", Arial, sans-serif',
  mono:       '"Fira Code", "Consolas", monospace',
  humanist:   '"Palatino Linotype", "Book Antiqua", Palatino, serif',
}

const THEME_STYLES = {
  light: { background: '#ffffff', color: '#1a1a2e', linkColor: '#6366f1' },
  dark:  { background: '#0f172a', color: '#e2e8f0', linkColor: '#818cf8' },
  sepia: { background: '#faf7f0', color: '#2c1810', linkColor: '#b45309' },
}

function buildEpubCss(settings) {
  const t = THEME_STYLES[settings.theme] || THEME_STYLES.light
  const ff = FONT_FAMILIES[settings.fontFamily] || FONT_FAMILIES.serif
  return `
    html, body {
      background: ${t.background} !important;
      color: ${t.color} !important;
      font-family: ${ff} !important;
      font-size: ${settings.fontSize}px !important;
      line-height: ${settings.lineHeight} !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    a { color: ${t.linkColor} !important; }
    img { max-width: 100% !important; height: auto !important; }
    p { margin-bottom: 1em !important; }
    h1,h2,h3,h4,h5,h6 { color: ${t.color} !important; line-height: 1.3 !important; }
  `
}

const EpubViewer = forwardRef(function EpubViewer(
  { fileData, settings, onTocLoad, onLocationChange, savedLocation },
  ref
) {
  const containerRef = useRef(null)
  const bookRef = useRef(null)
  const renditionRef = useRef(null)
  const [error, setError] = useState(null)

  // Expose navigation methods to parent
  useImperativeHandle(ref, () => ({
    next: () => renditionRef.current?.next(),
    prev: () => renditionRef.current?.prev(),
    goTo: (href) => renditionRef.current?.display(href),
    search: async (q) => {
      const book = bookRef.current
      if (!book || !q) return []
      const results = []
      await book.spine.each(async (item) => {
        try {
          const doc = await item.load(book.load.bind(book))
          const text = doc.documentElement?.textContent || ''
          const idx = text.toLowerCase().indexOf(q.toLowerCase())
          if (idx !== -1) {
            results.push({ cfi: item.cfi, excerpt: text.slice(Math.max(0, idx - 40), idx + 80) })
          }
          item.unload()
        } catch {}
      })
      return results
    },
  }))

  useEffect(() => {
    if (!fileData || !containerRef.current) return

    let book, rendition

    const init = async () => {
      try {
        const { default: ePub } = await import('epubjs')
        book = ePub(fileData.slice(0))
        bookRef.current = book

        rendition = book.renderTo(containerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
        })
        renditionRef.current = rendition

        // Apply styling
        rendition.themes.register('custom', { body: {} })
        rendition.themes.select('custom')
        rendition.themes.override('body', { 'background': THEME_STYLES[settings.theme]?.background || '#fff' })

        // Inject CSS via hooks
        rendition.hooks.content.register((contents) => {
          contents.addStylesheet && contents.addStylesheet(buildEpubCss(settings))
        })

        // Display at saved location or start
        await rendition.display(savedLocation || undefined)

        // Load TOC
        book.loaded.navigation.then((nav) => {
          const flatToc = flattenToc(nav.toc)
          onTocLoad && onTocLoad(flatToc)
        }).catch(() => {})

        // Track location changes
        rendition.on('locationChanged', (loc) => {
          if (!loc) return
          const progress = book.locations.percentageFromCfi(loc.start?.cfi || loc.start) || 0
          onLocationChange && onLocationChange({
            cfi: loc.start?.cfi || loc.start,
            progress,
            chapter: loc.start?.index,
          })
        })

        // Generate locations for progress
        book.ready.then(() => {
          book.locations.generate(1600)
        }).catch(() => {})

      } catch (err) {
        console.error('EPUB load error:', err)
        setError('Failed to load EPUB. The file may be corrupted.')
      }
    }

    init()

    return () => {
      try { book?.destroy() } catch {}
      bookRef.current = null
      renditionRef.current = null
    }
  }, [fileData])

  // Apply settings changes without re-mounting
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition) return

    try {
      const css = buildEpubCss(settings)
      // Re-register and re-inject
      rendition.views().forEach((view) => {
        try {
          const contents = view.contents
          if (contents) {
            // Find and remove old folio style, add new one
            const doc = contents.document
            if (doc) {
              let style = doc.getElementById('folio-style')
              if (!style) {
                style = doc.createElement('style')
                style.id = 'folio-style'
                doc.head?.appendChild(style)
              }
              style.textContent = css
            }
          }
        } catch {}
      })
    } catch {}
  }, [settings])

  if (error) {
    return (
      <div className="reader-error">
        <div className="reader-error-icon">⚠️</div>
        <h3>Could not load book</h3>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: THEME_STYLES[settings.theme]?.background || '#fff' }}
    />
  )
})

function flattenToc(toc, depth = 0) {
  return toc.flatMap((item) => [
    { label: item.label?.trim(), href: item.href, depth },
    ...flattenToc(item.subitems || [], depth + 1),
  ])
}

export default EpubViewer
