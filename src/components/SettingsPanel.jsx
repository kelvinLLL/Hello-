const FONTS = [
  { key: 'serif',    name: 'Serif',     preview: 'Georgia' },
  { key: 'sans',     name: 'Sans-serif', preview: 'System UI' },
  { key: 'humanist', name: 'Humanist',  preview: 'Palatino' },
  { key: 'mono',     name: 'Mono',      preview: 'Fira Code' },
]

const THEMES = [
  { key: 'light', label: 'Light', icon: '☀️' },
  { key: 'dark',  label: 'Dark',  icon: '🌙' },
  { key: 'sepia', label: 'Sepia', icon: '📜' },
]

export default function SettingsPanel({ settings, onChange, onClose }) {
  const set = (key, val) => onChange({ ...settings, [key]: val })

  return (
    <>
      <div className="settings-overlay" onClick={onClose} />
      <div className="settings-panel" role="dialog" aria-label="Reading settings" aria-modal="true">
        <div className="settings-header">
          <h3>Reading Settings</h3>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div className="settings-body">
          {/* Theme */}
          <div className="settings-group">
            <div className="settings-label">Theme</div>
            <div className="theme-buttons">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  className={`theme-btn theme-btn-${t.key} ${settings.theme === t.key ? 'active' : ''}`}
                  onClick={() => set('theme', t.key)}
                  aria-pressed={settings.theme === t.key}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Family */}
          <div className="settings-group">
            <div className="settings-label">Font Family</div>
            <div className="font-options">
              {FONTS.map((f) => (
                <div
                  key={f.key}
                  className={`font-option ${settings.fontFamily === f.key ? 'active' : ''}`}
                  onClick={() => set('fontFamily', f.key)}
                  role="radio"
                  aria-checked={settings.fontFamily === f.key}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && set('fontFamily', f.key)}
                >
                  <span className="font-option-name">{f.name}</span>
                  <span
                    className="font-option-preview"
                    style={{ fontFamily: f.preview }}
                  >
                    Aa
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="settings-group">
            <div className="settings-label">Font Size</div>
            <div className="slider-control">
              <div className="slider-header">
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Text size</span>
                <span className="slider-value">{settings.fontSize}px</span>
              </div>
              <div className="slider-row">
                <button
                  className="slider-btn"
                  onClick={() => set('fontSize', Math.max(12, settings.fontSize - 1))}
                  aria-label="Decrease font size"
                  title="A-"
                >
                  A
                </button>
                <input
                  type="range"
                  min={12}
                  max={32}
                  value={settings.fontSize}
                  onChange={(e) => set('fontSize', Number(e.target.value))}
                  aria-label="Font size"
                />
                <button
                  className="slider-btn"
                  onClick={() => set('fontSize', Math.min(32, settings.fontSize + 1))}
                  aria-label="Increase font size"
                  title="A+"
                  style={{ fontSize: 16 }}
                >
                  A
                </button>
              </div>
            </div>
          </div>

          {/* Line Height */}
          <div className="settings-group">
            <div className="settings-label">Line Spacing</div>
            <div className="slider-control">
              <div className="slider-header">
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Space between lines</span>
                <span className="slider-value">{settings.lineHeight.toFixed(1)}×</span>
              </div>
              <div className="slider-row">
                <button
                  className="slider-btn"
                  onClick={() => set('lineHeight', Math.max(1.2, +(settings.lineHeight - 0.1).toFixed(1)))}
                  aria-label="Decrease line height"
                >
                  ≡
                </button>
                <input
                  type="range"
                  min={120}
                  max={260}
                  step={10}
                  value={Math.round(settings.lineHeight * 100)}
                  onChange={(e) => set('lineHeight', e.target.value / 100)}
                  aria-label="Line height"
                />
                <button
                  className="slider-btn"
                  onClick={() => set('lineHeight', Math.min(2.6, +(settings.lineHeight + 0.1).toFixed(1)))}
                  aria-label="Increase line height"
                >
                  ☰
                </button>
              </div>
            </div>
          </div>

          {/* Reading Width (EPUB only) */}
          <div className="settings-group">
            <div className="settings-label">Reading Width</div>
            <div className="slider-control">
              <div className="slider-header">
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Column width</span>
                <span className="slider-value">{settings.readingWidth}px</span>
              </div>
              <div className="slider-row">
                <button
                  className="slider-btn"
                  onClick={() => set('readingWidth', Math.max(320, settings.readingWidth - 20))}
                  aria-label="Narrower"
                >
                  ◂
                </button>
                <input
                  type="range"
                  min={320}
                  max={900}
                  step={20}
                  value={settings.readingWidth}
                  onChange={(e) => set('readingWidth', Number(e.target.value))}
                  aria-label="Reading width"
                />
                <button
                  className="slider-btn"
                  onClick={() => set('readingWidth', Math.min(900, settings.readingWidth + 20))}
                  aria-label="Wider"
                >
                  ▸
                </button>
              </div>
            </div>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="settings-group">
            <div className="settings-label">Keyboard Shortcuts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['← →', 'Previous / Next page'],
                ['T', 'Toggle contents'],
                ['B', 'Add bookmark'],
                ['S', 'Settings'],
                ['F', 'Fullscreen'],
                ['Ctrl+F', 'Search'],
                ['Esc', 'Back to library'],
              ].map(([key, desc]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <code style={{
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: 'var(--text)',
                    fontWeight: 600,
                  }}>{key}</code>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
