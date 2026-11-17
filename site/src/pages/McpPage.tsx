import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { REPO } from '../site';
import * as en from '../mcp';
import * as fr from '../mcp.fr';
import { useLang } from '../i18n';
import { Install, SectionHead, TocAside, TocInline, rich, useActiveSection, useScrollToHash, type TocItem } from '../components/Article';

type Priority = en.Priority;
type Server = en.Server;
const DATA = { en, fr };
const PRIORITIES: Priority[] = ['essential', 'recommended', 'optional', 'situational'];

function Badge({ p, children }: { p: Priority; children: string }) {
  return (
    <span className="prio" data-p={p}>
      {children}
    </span>
  );
}

function ServerEntry({ s }: { s: Server }) {
  const { t } = useTranslation();
  return (
    <article className="post-skill" id={s.id} aria-labelledby={`${s.id}-t`}>
      <h3 id={`${s.id}-t`}>
        <a href={`#${s.id}`}>{s.name}</a>
      </h3>
      <p className="post-meta">
        <span>
          <Badge p={s.priority}>{s.priorityLabel}</Badge>
        </span>
        <span>
          <Trans i18nKey="mcp.by" values={{ vendor: s.vendor }} components={{ b: <strong /> }} />
        </span>
        <span>{t(`mcp.kind.${s.kind}`)}</span>
        <span>
          <a href={s.link.url} target="_blank" rel="noreferrer">
            {s.link.label} <span aria-hidden>↗</span>
          </a>
        </span>
      </p>
      {s.lead.map((p) => (
        <p key={p}>{rich(p)}</p>
      ))}
      <h4>{t('mcp.helpsWith')}</h4>
      <ul>
        {s.uses.map((u) => (
          <li key={u}>{rich(u)}</li>
        ))}
      </ul>
      {s.install && <Install command={s.install} />}
      {s.setup && <p className="post-setup">{rich(s.setup)}</p>}
    </article>
  );
}

export default function McpPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const { ADD_LATER, CORE, MCP_AS_OF, MCP_SECTIONS, ORDER, PLAYWRIGHT_VS_DEVTOOLS, SECURITY, WORKFLOW, serverById } = DATA[lang];

  const TOC: TocItem[] = useMemo(
    () => [
      { id: 'start', title: t('mcp.toc.start') },
      ...MCP_SECTIONS.map((s) => ({ id: s.id, title: s.title })),
      { id: 'order', title: t('mcp.toc.order') },
      { id: 'workflow', title: t('mcp.toc.workflow') },
      { id: 'security', title: t('mcp.toc.security') },
      { id: 'setup', title: t('mcp.toc.setup') },
    ],
    [MCP_SECTIONS, t],
  );
  const active = useActiveSection(TOC);
  useScrollToHash();

  const ServerLink = ({ id }: { id: string }) => <a href={`#${id}`}>{serverById(id).name}</a>;
  const gh = <a href={REPO.url} target="_blank" rel="noreferrer" />;

  return (
    <div className="post">
      <TocAside toc={TOC} active={active} />

      <main className="post-body">
        <header className="post-head">
          <h1>{t('mcp.h1')}</h1>
          <p className="post-dek">{t('mcp.dek')}</p>
          <p className="post-byline">{t('mcp.byline', { date: MCP_AS_OF })}</p>
          <TocInline toc={TOC} />
        </header>

        <section className="post-section" id="start" aria-labelledby="start-t">
          <SectionHead id="start" title={t('mcp.toc.start')} />
          <p className="post-intro">
            <Trans i18nKey="mcp.startIntro" components={{ sk: <Link to="/skills" /> }} />
          </p>
          <h4>{t('mcp.howToAdd')}</h4>
          <ol>
            <li>{t('mcp.step1')}</li>
            <li>
              <Trans i18nKey="mcp.step2" components={{ c1: <code />, c2: <code /> }} />
            </li>
            <li>
              <Trans i18nKey="mcp.step3" components={{ c: <code /> }} />
            </li>
            <li>{t('mcp.step4')}</li>
          </ol>
          <h4>{t('mcp.badges')}</h4>
          <ul className="prio-legend">
            {PRIORITIES.map((p) => (
              <li key={p}>
                <Badge p={p}>{t(`mcp.badge.${p}.label`)}</Badge> {t(`mcp.badge.${p}.text`)}
              </li>
            ))}
          </ul>
          <aside className="post-tip">
            <strong>{t('mcp.startSmall')}</strong>
            <p>
              <Trans i18nKey="mcp.startSmallText" components={{ a: <a href="#setup" /> }} />
            </p>
          </aside>
        </section>

        {MCP_SECTIONS.map((sec) => (
          <section className="post-section" id={sec.id} key={sec.id} aria-labelledby={`${sec.id}-t`}>
            <SectionHead id={sec.id} title={sec.title} />
            {sec.intro.map((p) => (
              <p className="post-intro" key={p}>
                {rich(p)}
              </p>
            ))}
            {sec.servers.map((s) => (
              <ServerEntry key={s.id} s={s} />
            ))}

            {sec.id === 'browser' && (
              <aside className="post-notice">
                <h3>{t('mcp.compareTitle')}</h3>
                <p>{t('mcp.compareLead')}</p>
                <dl className="compare">
                  <div>
                    <dt>
                      <a href="#playwright">Playwright</a>
                    </dt>
                    <dd>{PLAYWRIGHT_VS_DEVTOOLS.playwright}</dd>
                  </div>
                  <div>
                    <dt>
                      <a href="#chrome-devtools">Chrome DevTools</a>
                    </dt>
                    <dd>{PLAYWRIGHT_VS_DEVTOOLS.devtools}</dd>
                  </div>
                </dl>
              </aside>
            )}
          </section>
        ))}

        <section className="post-section" id="order" aria-labelledby="order-t">
          <SectionHead id="order" title={t('mcp.toc.order')} />
          <p className="post-intro">{t('mcp.orderIntro')}</p>
          <div className="post-table-wrap">
            <table className="post-table order-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{t('mcp.colServer')}</th>
                  <th scope="col">{t('mcp.colPriority')}</th>
                  <th scope="col">{t('mcp.colPurpose')}</th>
                </tr>
              </thead>
              <tbody>
                {ORDER.map((row, i) => {
                  const s = serverById(row.id);
                  return (
                    <tr key={row.id}>
                      <td>{i + 1}</td>
                      <td>
                        <a href={`#${s.id}`}>{s.name}</a>
                      </td>
                      <td>
                        <Badge p={s.priority}>{row.priority ?? s.priorityLabel}</Badge>
                      </td>
                      <td>{row.purpose}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="post-section" id="workflow" aria-labelledby="workflow-t">
          <SectionHead id="workflow" title={t('mcp.toc.workflow')} />
          <p className="post-intro">{t('mcp.workflowIntro')}</p>
          <ol className="pipeline">
            {WORKFLOW.map((step) => (
              <li key={step.tool}>
                <strong>{step.id ? <a href={`#${step.id}`}>{step.tool}</a> : step.tool}</strong>
                <span>{step.does}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="post-section" id="security" aria-labelledby="security-t">
          <SectionHead id="security" title={t('mcp.toc.security')} />
          <p className="post-intro">{t('mcp.securityIntro')}</p>
          <ul className="checklist">
            {SECURITY.map((item) => (
              <li key={item}>{rich(item)}</li>
            ))}
          </ul>
        </section>

        <section className="post-section" id="setup" aria-labelledby="setup-t">
          <SectionHead id="setup" title={t('mcp.toc.setup')} />
          <p className="post-intro">{t('mcp.setupIntro')}</p>
          <div className="setup-cols">
            <div>
              <h3>{t('mcp.core')}</h3>
              <ul>
                {CORE.map((id) => (
                  <li key={id}>
                    <ServerLink id={id} />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>{t('mcp.addLater')}</h3>
              <ul>
                {ADD_LATER.map((a) => (
                  <li key={a.id}>
                    <ServerLink id={a.id} /> {a.when}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <aside className="post-notice">
            <h3>{t('mcp.finalTitle')}</h3>
            <p>{t('mcp.finalText')}</p>
          </aside>
        </section>

        <footer className="home-foot">
          <Trans i18nKey="mcp.footer" values={{ date: MCP_AS_OF }} components={{ gh }} />
        </footer>
      </main>
    </div>
  );
}
