import { Link } from 'react-router-dom';
import { REPO } from '../site';
import {
  ADD_LATER, CORE, MCP_AS_OF, MCP_SECTIONS, ORDER, PLAYWRIGHT_VS_DEVTOOLS, SECURITY, WORKFLOW,
  serverById, type Priority, type Server,
} from '../mcp';
import { Install, SectionHead, TocAside, TocInline, rich, useActiveSection, useScrollToHash, type TocItem } from '../components/Article';

const TOC: TocItem[] = [
  { id: 'start', title: 'Start here' },
  ...MCP_SECTIONS.map((s) => ({ id: s.id, title: s.title })),
  { id: 'order', title: 'Installation order' },
  { id: 'workflow', title: 'An example workflow' },
  { id: 'security', title: 'Security and configuration' },
  { id: 'setup', title: 'Your setup' },
];

function Badge({ p, children }: { p: Priority; children: string }) {
  return <span className="prio" data-p={p}>{children}</span>;
}

const KIND_LABEL: Record<Server['kind'], string> = {
  Remote: 'Hosted server',
  Local: 'Runs on your machine',
  Docs: 'Documentation',
};

function ServerEntry({ s }: { s: Server }) {
  return (
    <article className="post-skill" id={s.id} aria-labelledby={`${s.id}-t`}>
      <h3 id={`${s.id}-t`}><a href={`#${s.id}`}>{s.name}</a></h3>
      <p className="post-meta">
        <span><Badge p={s.priority}>{s.priorityLabel}</Badge></span>
        <span>by <strong>{s.vendor}</strong></span>
        <span>{KIND_LABEL[s.kind]}</span>
        <span>
          <a href={s.link.url} target="_blank" rel="noreferrer">{s.link.label} <span aria-hidden>↗</span></a>
        </span>
      </p>
      {s.lead.map((p) => <p key={p}>{rich(p)}</p>)}
      <h4>What it helps with</h4>
      <ul>{s.uses.map((u) => <li key={u}>{rich(u)}</li>)}</ul>
      {s.install && <Install command={s.install} />}
      {s.setup && <p className="post-setup">{rich(s.setup)}</p>}
    </article>
  );
}

const ServerLink = ({ id }: { id: string }) => <a href={`#${id}`}>{serverById(id).name}</a>;

export default function McpPage() {
  const active = useActiveSection(TOC);
  useScrollToHash();

  return (
    <div className="post">
      <TocAside toc={TOC} active={active} />

      <main className="post-body">
        <header className="post-head">
          <h1>The MCP toolkit for frontend developers</h1>
          <p className="post-dek">
            MCP servers connect Claude to the tools you already use: your designs, your docs, a real browser, your repository
            and your deployments. This guide covers the ones worth adding for React, Next.js and TypeScript work, what each
            one is for, and how to set them up safely.
          </p>
          <p className="post-byline">Updated {MCP_AS_OF}</p>
          <TocInline toc={TOC} />
        </header>

        <section className="post-section" id="start" aria-labelledby="start-t">
          <SectionHead toc={TOC} id="start" title="Start here" />
          <p className="post-intro">
            A <Link to="/skills">skill</Link> teaches Claude how to do a job. An MCP server gives it access to something it
            can’t otherwise reach: a Figma file, a browser tab, your GitHub issues. Together they cover a frontend workflow
            from design to production.
          </p>
          <h4>How to add a server</h4>
          <ol>
            <li>Copy the server’s command from this guide and run it in your terminal, inside your project folder.</li>
            <li>
              Add <code>--scope user</code> after <code>claude mcp add</code> to make it available in every project instead
              of just this one.
            </li>
            <li>
              Open Claude Code and run <code>/mcp</code>. It lists your servers and lets you sign in to the ones that need an
              account.
            </li>
            <li>Ask for the task. Claude uses the server’s tools when they are relevant.</li>
          </ol>
          <h4>How to read the badges</h4>
          <ul className="prio-legend">
            <li><Badge p="essential">Essential</Badge> Worth adding on day one.</li>
            <li><Badge p="recommended">Recommended</Badge> Useful on most real projects.</li>
            <li><Badge p="optional">Optional</Badge> Helps most when you work in a team.</li>
            <li><Badge p="situational">If you use it</Badge> Only if your project runs on that service.</li>
          </ul>
          <aside className="post-tip">
            <strong>Start small</strong>
            <p>
              Don’t install every server you read about. Begin with the <a href="#setup">core toolkit</a> and add the others
              when a task you repeat would actually need them.
            </p>
          </aside>
        </section>

        {MCP_SECTIONS.map((sec) => (
          <section className="post-section" id={sec.id} key={sec.id} aria-labelledby={`${sec.id}-t`}>
            <SectionHead toc={TOC} id={sec.id} title={sec.title} />
            {sec.intro.map((p) => <p className="post-intro" key={p}>{rich(p)}</p>)}
            {sec.servers.map((s) => <ServerEntry key={s.id} s={s} />)}

            {sec.id === 'browser' && (
              <aside className="post-notice">
                <h3>Playwright or Chrome DevTools?</h3>
                <p>They overlap less than it seems, and most people end up using both.</p>
                <dl className="compare">
                  <div>
                    <dt><a href="#playwright">Playwright</a></dt>
                    <dd>{PLAYWRIGHT_VS_DEVTOOLS.playwright}</dd>
                  </div>
                  <div>
                    <dt><a href="#chrome-devtools">Chrome DevTools</a></dt>
                    <dd>{PLAYWRIGHT_VS_DEVTOOLS.devtools}</dd>
                  </div>
                </dl>
              </aside>
            )}
          </section>
        ))}

        <section className="post-section" id="order" aria-labelledby="order-t">
          <SectionHead toc={TOC} id="order" title="Installation order" />
          <p className="post-intro">Start with a small set and add tools when a real workflow needs them.</p>
          <div className="post-table-wrap">
            <table className="post-table order-table">
              <thead>
                <tr><th scope="col">#</th><th scope="col">Server</th><th scope="col">Priority</th><th scope="col">Main purpose</th></tr>
              </thead>
              <tbody>
                {ORDER.map((row, i) => {
                  const s = serverById(row.id);
                  return (
                    <tr key={row.id}>
                      <td>{i + 1}</td>
                      <td><a href={`#${s.id}`}>{s.name}</a></td>
                      <td><Badge p={s.priority}>{row.priority ?? s.priorityLabel}</Badge></td>
                      <td>{row.purpose}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="post-section" id="workflow" aria-labelledby="workflow-t">
          <SectionHead toc={TOC} id="workflow" title="An example workflow" />
          <p className="post-intro">Say you are building a new Next.js landing page. Here is where each server comes in.</p>
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
          <SectionHead toc={TOC} id="security" title="Security and configuration" />
          <p className="post-intro">
            Every server you connect can read from, and sometimes write to, a real account. Treat adding one like giving a new
            teammate access.
          </p>
          <ul className="checklist">
            {SECURITY.map((item) => <li key={item}>{rich(item)}</li>)}
          </ul>
        </section>

        <section className="post-section" id="setup" aria-labelledby="setup-t">
          <SectionHead toc={TOC} id="setup" title="Your setup" />
          <p className="post-intro">For a frontend developer working mainly with React, Next.js, TypeScript, React Native and Expo.</p>
          <div className="setup-cols">
            <div>
              <h3>Core toolkit</h3>
              <ul>{CORE.map((id) => <li key={id}><ServerLink id={id} /></li>)}</ul>
            </div>
            <div>
              <h3>Add based on your projects</h3>
              <ul>{ADD_LATER.map((a) => <li key={a.id}><ServerLink id={a.id} /> {a.when}</li>)}</ul>
            </div>
          </div>
          <aside className="post-notice">
            <h3>The final recommendation</h3>
            <p>
              Do not install every MCP server available. Start with the core toolkit, understand what each one can access,
              and add specialized tools only when they solve a problem you keep running into.
            </p>
          </aside>
        </section>

        <footer className="home-foot">
          Commands checked against each vendor’s documentation, {MCP_AS_OF}. Know a server that belongs here?{' '}
          <a href={REPO.url} target="_blank" rel="noreferrer">Suggest it on GitHub</a>.
        </footer>
      </main>
    </div>
  );
}
