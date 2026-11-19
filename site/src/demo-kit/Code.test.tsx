import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Code } from './index';

describe('demo-kit Code highlighting', () => {
  it('highlights javascript code with hljs tokens', () => {
    const snippet = `useEffect(() => {\n  setInterval(async () => {\n    setBalance((await getBalance()).amount);\n  }, 1000);\n  // no cleanup\n}, []);`;
    const { container } = render(<Code>{snippet}</Code>);
    const code = container.querySelector('pre code');
    expect(code).toBeTruthy();
    expect(code?.querySelector('.hljs-keyword')).toBeTruthy();
    expect(code?.querySelector('.hljs-comment')).toBeTruthy();
    expect(code?.querySelector('.hljs-number')).toBeTruthy();
  });
});
