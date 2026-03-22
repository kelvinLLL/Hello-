// IndexedDB wrapper for storing book files
const DB_NAME = 'FolioReaderDB'
const DB_VERSION = 1
const STORE_FILES = 'book_files'
const STORE_META = 'book_meta'

let db = null

function openDB() {
  if (db) return Promise.resolve(db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const d = e.target.result
      if (!d.objectStoreNames.contains(STORE_FILES)) {
        d.createObjectStore(STORE_FILES, { keyPath: 'id' })
      }
      if (!d.objectStoreNames.contains(STORE_META)) {
        d.createObjectStore(STORE_META, { keyPath: 'id' })
      }
    }
    req.onsuccess = (e) => { db = e.target.result; resolve(db) }
    req.onerror = () => reject(req.error)
  })
}

export async function saveBookFile(id, data) {
  const d = await openDB()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_FILES, 'readwrite')
    tx.objectStore(STORE_FILES).put({ id, data })
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

export async function getBookFile(id) {
  const d = await openDB()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_FILES, 'readonly')
    const req = tx.objectStore(STORE_FILES).get(id)
    req.onsuccess = () => resolve(req.result?.data || null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteBookFile(id) {
  const d = await openDB()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_FILES, 'readwrite')
    tx.objectStore(STORE_FILES).delete(id)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

// Book metadata (small, kept in localStorage for speed)
const META_KEY = 'folio_books'

export function getBooks() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveBooks(books) {
  localStorage.setItem(META_KEY, JSON.stringify(books))
}

export function updateBookProgress(id, progress, location) {
  const books = getBooks()
  const idx = books.findIndex(b => b.id === id)
  if (idx !== -1) {
    books[idx].progress = progress
    books[idx].location = location
    books[idx].lastRead = Date.now()
    saveBooks(books)
  }
}

// Reader settings
const SETTINGS_KEY = 'folio_settings'

export function getSettings() {
  try {
    return {
      theme: 'light',
      fontSize: 18,
      fontFamily: 'serif',
      lineHeight: 1.8,
      readingWidth: 680,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
    }
  } catch {
    return { theme: 'light', fontSize: 18, fontFamily: 'serif', lineHeight: 1.8, readingWidth: 680 }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
