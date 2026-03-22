# 📚 Folio — Beautiful Ebook Reader

A stunning, feature-rich ebook reader that runs entirely in your browser. Upload PDF or EPUB files and enjoy a distraction-free reading experience. Deploy instantly on Vercel.

## ✨ Features

- **PDF & EPUB support** — Full rendering for both formats
- **Beautiful library** — Book cards with cover thumbnails, progress bars, drag & drop upload
- **3 Reading themes** — Light, Dark, and Sepia
- **Typography controls** — Font family, size, line spacing, reading width
- **Table of Contents** — Navigate chapters with a collapsible sidebar
- **Bookmarks** — Save and revisit reading positions
- **In-book search** — Find text across pages/chapters
- **Progress tracking** — Auto-saves your reading position
- **Keyboard shortcuts** — `←/→` navigate, `T` TOC, `S` settings, `B` bookmark, `F` fullscreen, `Ctrl+F` search
- **Touch support** — Swipe left/right to turn pages on mobile
- **Fully responsive** — Works beautifully on desktop, tablet, and mobile
- **Private by default** — All data stored locally in your browser (IndexedDB)

## 🚀 Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Fork this repo
2. Connect to Vercel
3. Deploy — zero configuration needed

## 🛠 Local Development

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## 📦 Build for Production

```bash
npm run build
```

Output is in the `dist/` directory.

## 🏗 Tech Stack

- **React 18** + **Vite** — Fast modern frontend
- **PDF.js** — Mozilla's PDF rendering engine
- **epub.js** — EPUB format parser and renderer
- **IndexedDB** — Browser-native storage for book files
- Pure CSS with CSS variables — No heavy UI framework needed

## 🗂 Project Structure

```
src/
├── views/
│   ├── Library.jsx      # Home page with book grid & upload
│   └── Reader.jsx       # Full reader with all controls
├── components/
│   ├── BookCard.jsx     # Library book card
│   ├── EpubViewer.jsx   # EPUB rendering (epub.js)
│   ├── PDFViewer.jsx    # PDF rendering (PDF.js)
│   ├── Toolbar.jsx      # Top reader toolbar
│   ├── TOCSidebar.jsx   # Table of contents panel
│   ├── SettingsPanel.jsx # Reading settings
│   └── SearchPanel.jsx  # In-book search
├── db.js                # IndexedDB + localStorage helpers
├── App.jsx              # Root component
└── index.css            # Design system (CSS variables, theming)
```
