import { Fragment } from 'react';
import { REPO } from '../site';
import { INSTALLS_AS_OF, NEXTJS_NOTE, PIPELINE, SECTIONS, STACKS, type Skill } from '../skills';
import { Install, SectionHead, TocAside, TocInline, rich, useActiveSection, useScrollToHash, type TocItem } from '../components/Article';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const TOC: TocItem[] = [
  { id: 'start', title: 'Start here' },
  ...SECTIONS.map((s) => ({ id: s.id, title: s.title })),
  { id: 'stacks', title: 'Recommended stacks' },
];

function SkillEntry({ s }: { s: Skill }) {
  const onRegistry = s.url.startsWith('https://skills.sh/');
  const List = s.list?.ordered ? 'ol' : 'ul';
  return (
    <article className="post-skill" id={s.id} aria-labelledby={`${s.id}-t`}>
      <h3 id={`${s.id}-t`}><a href={`#${s.id}`}>{s.name}</a></h3>
      <p className="post-meta">
        <span>by <strong>{s.author}</strong></span>
        <span>{s.installs === null ? 'A set of skills' : `${compact.format(s.installs)} installs`}</span>
        {s.platforms && <span>{s.platforms}</span>}
        <span>
          <a href={s.url} target="_blank" rel="noreferrer">{onRegistry ? 'skills.sh' : 'GitHub'} <span aria-hidden>↗</span></a>
        </span>
      </p>
      {s.lead.map((p) => <p key={p}>{rich(p)}</p>)}
      {s.list && (
        <>
          {s.list.title && <h4>{s.list.title}</h4>}
          <List>{s.list.items.map((item) => <li key={item}>{rich(item)}</li>)}</List>
        </>
      )}
      {s.after?.map((p) => <p key={p}>{rich(p)}</p>)}
      {s.when && (
        <p className="post-when"><strong>When to use it</strong>{rich(s.when)}</p>
      )}
      <Install command={`npx skills add ${s.pkg}`} />
      {s.tip && (
        <aside className="post-tip"><strong>Pro tip</strong><p>{rich(s.tip)}</p></aside>
      )}
    </article>
  );
}

export default function SkillsPage() {
  const active = useActiveSection(TOC);
  useScrollToHash();

  return (
    <div className="post">
      <TocAside toc={TOC} active={active} />

      <main className="post-body">
        <header className="post-head">
          <h1>The Claude skills every frontend developer should know</h1>
          <p className="post-dek">
            A skill is a package of instructions that teaches Claude Code, and other AI agents, how to do one kind of job
            well. This guide walks through the ones worth installing for frontend work: what each one does, when to use it,
            and how they fit together.
          </p>
          <p className="post-byline">Updated {INSTALLS_AS_OF}. Install counts from skills.sh.</p>
          <TocInline toc={TOC} />
        </header>

        <section className="post-section" id="start" aria-labelledby="start-t">
          <SectionHead toc={TOC} id="start" title="Start here" />
          <p className="post-intro">
            Once a skill is installed, Claude loads it on its own whenever a task fits. You do not call it by name; you just
            describe the work.
          </p>
          <h4>How to install a skill</h4>
          <ol>
            <li>Find a skill in this guide and copy its install command.</li>
            <li>Run it in your project folder. Add <code>-g</code> to install it for every project instead.</li>
            <li>Ask Claude for the task. The skill loads when it is relevant.</li>
          </ol>
          <h4>If you only install three</h4>
          <p>
            Make them <a href="#react-best-practices">react-best-practices</a>, <a href="#frontend-design">frontend-design</a>{' '}
            and <a href="#web-design-guidelines">web-design-guidelines</a>. Together they cover how your code is written, how
            your interface looks, and whether it holds up on every screen.
          </p>
          <aside className="post-tip">
            <strong>Before you install</strong>
            <p>
              A skill is a set of instructions your agent will follow. Read it on skills.sh or GitHub before you install it,
              the same way you would check an npm package.
            </p>
          </aside>
        </section>

        {SECTIONS.map((sec) => (
          <section className="post-section" id={sec.id} key={sec.id} aria-labelledby={`${sec.id}-t`}>
            <SectionHead toc={TOC} id={sec.id} title={sec.title} />
            {sec.intro.map((p) => <p className="post-intro" key={p}>{rich(p)}</p>)}

            {sec.id === 'nextjs' && (
              <div className="post-notice">
                <h3>{NEXTJS_NOTE.title}</h3>
                {NEXTJS_NOTE.body.map((p) => <p key={p}>{rich(p)}</p>)}
                <h4>What the built-in rules cover</h4>
                <ul>{NEXTJS_NOTE.covers.map((c) => <li key={c}>{rich(c)}</li>)}</ul>
                {NEXTJS_NOTE.commands.map((c) => (
                  <Fragment key={c.cmd}>
                    <p className="install-label">{c.label}</p>
                    <Install command={c.cmd} />
                  </Fragment>
                ))}
              </div>
            )}

            {sec.skills.map((s) => <SkillEntry key={s.id} s={s} />)}

            {sec.id === 'design-to-code' && (
              <aside className="post-notice">
                <h3>Pro tip: the ideal design-to-code workflow</h3>
                <p>Four tools, one pipeline:</p>
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
          <SectionHead toc={TOC} id="stacks" title="Recommended stacks" />
          <p className="post-intro">How the skills fit together for different kinds of project.</p>
          {STACKS.map((stack) => (
            <div className="post-stack" key={stack.title}>
              <h3>For {stack.title.charAt(0).toLowerCase() + stack.title.slice(1)}</h3>
              <table className="post-table">
                <thead>
                  <tr><th scope="col">Skill</th><th scope="col">Why</th></tr>
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
          Install counts are from the skills.sh registry, {INSTALLS_AS_OF}. Want a skill added to this guide?{' '}
          <a href={REPO.url} target="_blank" rel="noreferrer">Suggest it on GitHub</a>.
        </footer>
      </main>
    </div>
  );
}
