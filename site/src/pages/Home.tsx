import { Link } from 'react-router-dom';
import { LEVELS } from '../catalog';
import { Trans, useTranslation } from 'react-i18next';
import { ALL_META, questionId } from '../content';
import { useProgress } from '../progress';
import { REPO } from '../site';
import { Roadmap } from '../components/Roadmap';

export function Home() {
  const { t } = useTranslation();
  const { done } = useProgress();
  const total = ALL_META.length;
  const count = ALL_META.filter((q) => done.includes(questionId(q))).length;

  return (
    <main className="home">
      <div className="hero">
        <h1>{t('home.title')}</h1>
        <p>{t('home.lead', { total })}</p>
        <div className="hero-cta">
          <Link to={`/${LEVELS[0].id}`} className="btn btn-primary">{t('home.start')}</Link>
          <a href="#map" className="btn btn-secondary">{t('home.explore')}</a>
        </div>
      </div>

      <div className="progress-line" id="map">
        <h2>{t('home.map')}</h2>
        <div className="progress-pill">
          <div className="progress-track" aria-hidden>
            <div style={{ transform: `scaleX(${count / total})` }} />
          </div>
          {t('common.progress', { count, total })}
        </div>
      </div>

      <Roadmap />

      <footer className="home-foot">
        <Trans i18nKey="home.footer" components={{ gh: <a href={REPO.url} target="_blank" rel="noreferrer" /> }} />
      </footer>
    </main>
  );
}
