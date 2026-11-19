import { Children, isValidElement, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

const LANG_DISPLAY: Record<string, string> = {
  js: 'JS',
  javascript: 'JS',
  jsx: 'JSX',
  ts: 'TS',
  typescript: 'TS',
  tsx: 'TSX',
  html: 'HTML',
  css: 'CSS',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  json: 'JSON',
  jsonc: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  diff: 'Diff',
  markdown: 'MD',
  md: 'MD',
  nginx: 'Nginx',
};

function PreBlock({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
  let lang = '';
  Children.forEach(children, (child) => {
    if (isValidElement(child) && typeof child.props?.className === 'string') {
      const match = /language-([a-z0-9_-]+)/i.exec(child.props.className);
      if (match) lang = match[1].toLowerCase();
    }
  });

  const display = lang ? LANG_DISPLAY[lang] || lang.toUpperCase() : '';

  return (
    <div className="code-block" data-lang={lang || undefined}>
      {display && (
        <span className="code-lang-badge" aria-hidden="true">
          {display}
        </span>
      )}
      <pre {...props} tabIndex={0}>
        {children}
      </pre>
    </div>
  );
}

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [
            rehypeHighlight,
            {
              detect: false,
              aliases: {
                bash: ['gitignore', 'sh'],
                json: ['jsonc'],
              },
            },
          ],
        ]}
        components={{
          pre: PreBlock,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
