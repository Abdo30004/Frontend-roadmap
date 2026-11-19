import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Markdown from './Markdown';

describe('Markdown syntax highlighting', () => {
  it('highlights js code block', () => {
    const md = '```js\nconst x = 1;\n```';
    const { container } = render(<Markdown>{md}</Markdown>);
    const code = container.querySelector('pre code');
    expect(code).toBeTruthy();
    expect(code?.className).toContain('hljs');
    expect(code?.querySelector('.hljs-keyword')).toBeTruthy();
  });

  it('highlights jsx code block with tag, attr, and string', () => {
    const md = '```jsx\nconst App = () => <div className="card">Hello</div>;\n```';
    const { container } = render(<Markdown>{md}</Markdown>);
    const block = container.querySelector('.code-block');
    expect(block).toBeTruthy();
    expect(block?.getAttribute('data-lang')).toBe('jsx');
    expect(container.querySelector('.code-lang-badge')?.textContent).toBe('JSX');

    const code = container.querySelector('pre code');
    expect(code).toBeTruthy();
    expect(code?.className).toContain('hljs');
    expect(code?.querySelector('.hljs-keyword')).toBeTruthy();
    expect(code?.querySelector('.hljs-attr')).toBeTruthy();
    expect(code?.querySelector('.hljs-string')).toBeTruthy();
  });

  it('highlights ts and tsx code block', () => {
    const md = '```tsx\nexport const Btn: React.FC<Props> = ({ title }) => <button>{title}</button>;\n```';
    const { container } = render(<Markdown>{md}</Markdown>);
    expect(container.querySelector('.code-lang-badge')?.textContent).toBe('TSX');

    const code = container.querySelector('pre code');
    expect(code).toBeTruthy();
    expect(code?.className).toContain('hljs');
    expect(code?.querySelector('.hljs-keyword')).toBeTruthy();
    expect(code?.querySelector('.hljs-params')).toBeTruthy();
  });

  it('handles code block without language gracefully', () => {
    const md = '```\nplain text here\n```';
    const { container } = render(<Markdown>{md}</Markdown>);
    const code = container.querySelector('pre code');
    expect(code).toBeTruthy();
    expect(code?.textContent).toContain('plain text here');
  });

  it('handles inline code correctly', () => {
    const md = 'Here is `inline code` in text.';
    const { container } = render(<Markdown>{md}</Markdown>);
    const inlineCode = container.querySelector('p code');
    expect(inlineCode).toBeTruthy();
    expect(inlineCode?.textContent).toBe('inline code');
    expect(container.querySelector('pre')).toBeNull();
  });
});
