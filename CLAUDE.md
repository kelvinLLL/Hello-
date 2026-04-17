# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build locally
node --test        # run the test suite (Node built-in test runner, no extra deps)
```

To run a single test file:
```bash
node --test tests/mobileShell.test.mjs
```

## Architecture

**Folio** is a browser-only ebook reader (React 18 + Vite). All book data stays in the browser — there is no backend.

### View routing

Routing is manual state in `App.jsx`: a `view` string (`'library'` | `'reader'`) and a `currentBook` object. There is no React Router. The `shouldShowSiteChrome` helper in `mobileReaderShell.js` controls whether the outer site nav is shown (hidden when reading).

### Storage split

`src/db.js` owns two distinct stores:
- **IndexedDB** (`FolioReaderDB`) — stores raw book binary (`book_files` object store). Large blobs go here.
- **localStorage** — stores book metadata list (`folio_books`), per-book bookmarks (`folio_bm_<id>`), reader settings (`folio_settings`), and current theme (`folio_theme`). Kept in localStorage for synchronous access speed.

### Viewer imperative API

`Reader.jsx` controls both viewers via a `viewerRef`. Both `EpubViewer` and `PDFViewer` expose the same imperative interface via `useImperativeHandle`:
- `next()` / `prev()` — turn pages
- `goTo(href|cfi)` — navigate by EPUB CFI or href
- `goToPage(n)` — navigate PDF by page number
- `search(query)` — returns array of results (`{ cfi }` for EPUB, `{ page }` for PDF)

### Preset books

Books can be bundled with the app by placing files in `public/books/` and adding entries to `public/books/manifest.json`. Preset books have an `id` prefixed with `preset_` and a `url` field (populated at runtime from the manifest). Uploaded books have no `url` and are loaded from IndexedDB by `id`.

### Build chunking

`vite.config.js` splits `pdfjs-dist` and `epubjs` into separate manual chunks to avoid a bloated main bundle. `pdfjs-dist` is also excluded from Vite's dep optimization because it ships its own worker.

### Deployment

Configured for Vercel in `vercel.json` with an SPA catch-all rewrite. `VITE_BASE_PATH` env var controls the Vite `base` option for subdirectory deployments.

### CSS theming

`src/index.css` defines the full design system using CSS custom properties. Themes (`light`, `dark`, `sepia`) are applied by setting `data-theme` on `<html>`. The `.site-shell.reader-active .site-chrome` rule hides the outer site chrome while reading — this is tested in `tests/mobileShell.test.mjs`.
