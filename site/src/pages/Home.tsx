import { Link } from 'react-router-dom';
import { CATEGORIES, LEVELS } from '../catalog';
import { ALL_META, META, questionId } from '../content';
import { useProgress } from '../progress';
import { REPO } from '../site';
import { CheckIcon } from '../components/Icons';

export function Home() {
  const { isDone, done } = useProgress();
  const total = ALL_META.length;
  const count = ALL_META.filter((q) => done.includes(questionId(q))).length;

  return (
    <main className="home">
      <div className="hero">
        <h1>Learn the bug before you learn the answer.</h1>
        <p>
          {total} interview questions, from junior to senior. Each one starts with a real problem running live in your
          browser. Break it, think about it, then reveal the fix.
        </p>
        <div className="hero-cta">
          <Link to={`/${LEVELS[0].id}`} className="btn btn-primary">Start with junior questions</Link>
          <a href="#map" className="btn btn-secondary">Explore the map</a>
        </div>
      </div>

      <div className="progress-line" id="map">
        <h2>The map</h2>
        <div className="progress-pill">
          <div className="progress-track" aria-hidden>
            <div style={{ transform: `scaleX(${count / total})` }} />
          </div>
          {count} / {total} understood
        </div>
      </div>

      <div className="map">
        <div className="map-head">
          <div />
          {LEVELS.map((l) => (
            <div key={l.id}>
              <Link to={`/${l.id}`} style={{ ['--c' as string]: `var(--${l.id})` }}>
                <strong>{l.label}</strong>
                <span>{META[l.id].length} questions. {l.blurb}</span>
              </Link>
            </div>
          ))}
        </div>
        {CATEGORIES.map((c) => (
          <div className="map-row" key={c.id}>
            <div className="map-cat">{c.label}</div>
            {LEVELS.map((l) => (
              <div className="map-cell" key={l.id} data-level={l.label} style={{ ['--c' as string]: `var(--${l.id})` }}>
                {META[l.id]
                  .filter((q) => q.category === c.id)
                  .map((q) => (
                    <Link
                      key={q.slug}
                      className="node"
                      to={`/${l.id}#${q.slug}`}
                      data-done={isDone(questionId(q)) || undefined}
                    >
                      {isDone(questionId(q)) && <CheckIcon size={13} label="understood" />}
                      {q.short}
                    </Link>
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="legend">
        <span><CheckIcon size={13} /> understood</span>
        <span>Progress is saved in this browser only.</span>
      </div>

      <footer className="home-foot">
        Found a mistake or want to add a question? The content is plain markdown —{' '}
        <a href={REPO.url} target="_blank" rel="noreferrer">contribute on GitHub</a>.
      </footer>
    </main>
  );
}
