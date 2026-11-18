import { Fragment, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { REPO } from '../site';
import * as en from '../skills';
import * as fr from '../skills.fr';
import * as ar from '../skills.ar';
import { useLang } from '../i18n';
import { Install, SectionHead, TocAside, TocInline, rich, useActiveSection, useScrollToHash, type TocItem } from '../components/Article';

type Skill = en.Skill;
const DATA = { en, fr, ar };

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function SkillEntry({ s, compact }: { s: Skill; compact: Intl.NumberFormat }) {
  const { t } = useTranslation();
  const onRegistry = s.url.startsWith('https://skills.sh/');
  const List = s.list?.ordered ? 'ol' : 'ul';
  return (
    <article className="post-skill" id={s.id} aria-labelledby={`${s.id}-t`}>
      <h3 id={`${s.id}-t`}>
        <a href={`#${s.id}`}>{s.name}</a>
      </h3>
      <p className="post-meta">
        <span>
          <Trans i18nKey="skills.by" values={{ author: s.author }} components={{ b: <strong /> }} />
        </span>
        <span>{s.installs === null ? t('skills.aSet') : t('skills.installs', { n: compact.format(s.installs) })}</span>
        {s.platforms && <span>{s.platforms}</span>}
        <span>
          <a href={s.url} target="_blank" rel="noreferrer">
            {onRegistry ? 'skills.sh' : 'GitHub'} <span aria-hidden>↗</span>
          </a>
        </span>
      </p>
      {s.lead.map((p) => (
        <p key={p}>{rich(p)}</p>
      ))}
      {s.list && (
        <>
          {s.list.title && <h4>{s.list.title}</h4>}
          <List>
            {s.list.items.map((item) => (
              <li key={item}>{rich(item)}</li>
            ))}
          </List>
        </>
      )}
      {s.after?.map((p) => (
        <p key={p}>{rich(p)}</p>
      ))}
      {s.when && (
        <p className="post-when">
          <strong>{t('skills.whenToUse')}</strong>
          {rich(s.when)}
        </p>
      )}
      <Install command={`npx skills add ${s.pkg}`} />
      {s.tip && (
        <aside className="post-tip">
          <strong>{t('skills.proTip')}</strong>
          <p>{rich(s.tip)}</p>
        </aside>
      )}
    </article>
  );
}

export default function SkillsPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const { INSTALLS_AS_OF, NEXTJS_NOTE, PIPELINE, SECTIONS, STACKS } = DATA[lang];
  const compact = useMemo(() => new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }), [lang]);

  const TOC: TocItem[] = useMemo(
    () => [
      { id: 'start', title: t('skills.toc.start') },
      ...SECTIONS.map((s) => ({ id: s.id, title: s.title })),
      { id: 'stacks', title: t('skills.toc.stacks') },
    ],
    [SECTIONS, t],
  );
  const active = useActiveSection(TOC);
  useScrollToHash();

  const gh = <a href={REPO.url} target="_blank" rel="noreferrer" />;

  return (
    <div className="post">
      <TocAside toc={TOC} active={active} />

      <main className="post-body">
        <header className="post-head">
          <h1>{t('skills.h1')}</h1>
          <p className="post-dek">{t('skills.dek')}</p>
          <p className="post-byline">{t('skills.byline', { date: INSTALLS_AS_OF })}</p>
          <TocInline toc={TOC} />
        </header>

        <section className="post-section" id="start" aria-labelledby="start-t">
          <SectionHead id="start" title={t('skills.toc.start')} />
          <p className="post-intro">{t('skills.startIntro')}</p>
          <h4>{t('skills.howToInstall')}</h4>
          <ol>
            <li>{t('skills.step1')}</li>
            <li>
              <Trans i18nKey="skills.step2" components={{ c: <code /> }} />
            </li>
            <li>{t('skills.step3')}</li>
          </ol>
          <h4>{t('skills.onlyThree')}</h4>
          <p>
            <Trans
              i18nKey="skills.onlyThreeText"
              components={{
                a1: <a href="#react-best-practices" />,
                a2: <a href="#frontend-design" />,
                a3: <a href="#web-design-guidelines" />,
              }}
            />
          </p>
          <aside className="post-tip">
            <strong>{t('skills.beforeInstall')}</strong>
            <p>{t('skills.beforeInstallText')}</p>
          </aside>
        </section>

        {SECTIONS.map((sec) => (
          <section className="post-section" id={sec.id} key={sec.id} aria-labelledby={`${sec.id}-t`}>
            <SectionHead id={sec.id} title={sec.title} />
            {sec.intro.map((p) => (
              <p className="post-intro" key={p}>
                {rich(p)}
              </p>
            ))}

            {sec.id === 'nextjs' && (
              <div className="post-notice">
                <h3>{NEXTJS_NOTE.title}</h3>
                {NEXTJS_NOTE.body.map((p) => (
                  <p key={p}>{rich(p)}</p>
                ))}
                <h4>{t('skills.nextCovers')}</h4>
                <ul>
                  {NEXTJS_NOTE.covers.map((c) => (
                    <li key={c}>{rich(c)}</li>
                  ))}
                </ul>
                {NEXTJS_NOTE.commands.map((c) => (
                  <Fragment key={c.cmd}>
                    <p className="install-label">{c.label}</p>
                    <Install command={c.cmd} />
                  </Fragment>
                ))}
              </div>
            )}

            {sec.skills.map((s) => (
              <SkillEntry key={s.id} s={s} compact={compact} />
            ))}

            {sec.id === 'design-to-code' && (
              <aside className="post-notice">
                <h3>{t('skills.pipelineTitle')}</h3>
                <p>{t('skills.pipelineLead')}</p>
                <ol className="pipeline">
                  {PIPELINE.map((step) => (
                    <li key={step.name}>
                      <strong>{step.id ? <a href={`#${step.id}`}>{step.name}</a> : step.name}</strong>
                      <span>{step.does}</span>
                    </li>
                  ))}
                </ol>
              </aside>
            )}
          </section>
        ))}

        <section className="post-section" id="stacks" aria-labelledby="stacks-t">
          <SectionHead id="stacks" title={t('skills.toc.stacks')} />
          <p className="post-intro">{t('skills.stacksIntro')}</p>
          {STACKS.map((stack) => (
            <div className="post-stack" key={stack.title}>
              <h3>{t('skills.stackFor', { title: lowerFirst(stack.title) })}</h3>
              <table className="post-table">
                <thead>
                  <tr>
                    <th scope="col">{t('skills.colSkill')}</th>
                    <th scope="col">{t('skills.colWhy')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stack.rows.map((r) => (
                    <tr key={r.name}>
                      <td>{r.id ? <a href={`#${r.id}`}>{r.name}</a> : r.name}</td>
                      <td>{r.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        <footer className="home-foot">
          <Trans i18nKey="skills.footer" values={{ date: INSTALLS_AS_OF }} components={{ gh }} />
        </footer>
      </main>
    </div>
  );
}
