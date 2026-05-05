export default function ResultCard({ result }) {
  const { title, year, rating, voteCount, overview, poster, genre, sourceName, type, qualityScore } = result

  const scoreColor =
    qualityScore >= 70 ? 'score-high' :
    qualityScore >= 45 ? 'score-mid' :
    'score-low'

  const ratingLabel = rating >= 8 ? '佳作' : rating >= 6.5 ? '良好' : rating >= 5 ? '一般' : ''

  return (
    <article className="ms-card">
      <div className="ms-card-poster">
        {poster ? (
          <img src={poster} alt={title} loading="lazy" />
        ) : (
          <div className="ms-card-poster-placeholder">
            <span>{type === 'tv' ? '剧' : '影'}</span>
          </div>
        )}
        <div className={`ms-card-score ${scoreColor}`}>{qualityScore}</div>
      </div>

      <div className="ms-card-body">
        <div className="ms-card-header">
          <h3 className="ms-card-title">{title}</h3>
          <div className="ms-card-meta">
            {year && <span className="ms-tag">{year}</span>}
            {genre && <span className="ms-tag">{genre}</span>}
            <span className="ms-tag ms-tag-source">{sourceName}</span>
          </div>
        </div>

        {rating > 0 && (
          <div className="ms-card-rating">
            <span className="ms-stars" aria-hidden="true">
              {renderStars(rating)}
            </span>
            <span className="ms-rating-num">{rating.toFixed(1)}</span>
            {ratingLabel && <span className="ms-rating-label">{ratingLabel}</span>}
            {voteCount > 0 && (
              <span className="ms-vote-count">{formatVotes(voteCount)} 评</span>
            )}
          </div>
        )}

        {overview && (
          <p className="ms-card-overview">{overview}</p>
        )}
      </div>
    </article>
  )
}

function renderStars(rating) {
  const full = Math.floor(rating / 2)
  const half = (rating / 2) % 1 >= 0.4 ? 1 : 0
  const empty = 5 - full - half
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty)
}

function formatVotes(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}
