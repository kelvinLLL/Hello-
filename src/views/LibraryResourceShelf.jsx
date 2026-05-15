import './LibraryResourceShelf.css'

function SourceLink({ source }) {
  const meta = [source.language, source.kind, source.isbn ? `ISBN ${source.isbn}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <a
      className="resource-source-link"
      href={source.url}
      target="_blank"
      rel="noreferrer"
    >
      <span className="resource-source-label">{source.label}</span>
      {meta ? <span className="resource-source-meta">{meta}</span> : null}
    </a>
  )
}

export default function LibraryResourceShelf({ resources = [] }) {
  if (!resources.length) return null

  return (
    <section className="resource-shelf" aria-labelledby="resource-shelf-title">
      <div className="resource-shelf-header">
        <div>
          <p className="resource-shelf-kicker">正版资源待导入</p>
          <h2 id="resource-shelf-title">Recently noted books</h2>
        </div>
        <p>
          These titles are tracked as legal source cards. Purchase or borrow a file, then upload the
          EPUB/PDF above to read it privately in Folio.
        </p>
      </div>

      <div className="resource-grid">
        {resources.map((resource) => (
          <article key={resource.id} className="resource-card">
            <div className="resource-card-topline">
              <span className="resource-status">{resource.status}</span>
              <span className="resource-language">{resource.languages?.join(' / ')}</span>
            </div>
            <div className="resource-title-block">
              <h3>{resource.title}</h3>
              {resource.originalTitle ? <p>{resource.originalTitle}</p> : null}
            </div>
            <p className="resource-author">{resource.author}</p>
            <p className="resource-note">{resource.note}</p>

            <div className="resource-source-list" aria-label={`${resource.title} source links`}>
              {resource.sources?.map((source) => (
                <SourceLink key={source.url} source={source} />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
