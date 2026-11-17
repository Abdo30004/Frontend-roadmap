import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseQuestion } from './parse';

const QUESTION = `# What is a closure?

**Level:** Junior
**Merged from (original phrasings):**
- What is a Closure? Explain with an example.
- What are closures in JavaScript?

## The concept (short answer)
A function plus the variables it was created with.

## Real-life example: the problem
The debounce does nothing.

## How to fix it
Move \`timerId\` to the outer function.

## How to say it in the interview
Start with lexical scope.
`;

describe('parseQuestion', () => {
  it('reads the title, the merged phrasings and the four sections', () => {
    const q = parseQuestion(QUESTION);
    expect(q.title).toBe('What is a closure?');
    expect(q.merged).toEqual(['What is a Closure? Explain with an example.', 'What are closures in JavaScript?']);
    expect(q.concept).toBe('A function plus the variables it was created with.');
    expect(q.problem).toBe('The debounce does nothing.');
    expect(q.fix).toBe('Move `timerId` to the outer function.');
    expect(q.interview).toBe('Start with lexical scope.');
  });

  it('handles Windows line endings', () => {
    const q = parseQuestion(QUESTION.replace(/\n/g, '\r\n'));
    expect(q.title).toBe('What is a closure?');
    expect(q.concept).toBe('A function plus the variables it was created with.');
    expect(q.merged).toHaveLength(2);
  });

  it('does not split on "## " lines inside a code block', () => {
    const md = [
      '# Writing docs',
      '## The concept (short answer)',
      'A README looks like this:',
      '```markdown',
      '## Install',
      'npm install',
      '```',
      'End of the concept.',
      '## How to fix it',
      'Fixed.',
    ].join('\n');
    const q = parseQuestion(md);
    expect(q.concept).toContain('## Install');
    expect(q.concept).toContain('End of the concept.');
    expect(q.fix).toBe('Fixed.');
  });

  it('leaves missing sections undefined and has no merged phrasings when the list is absent', () => {
    const q = parseQuestion('# Only a title\n\n## The concept (short answer)\nShort.');
    expect(q.merged).toEqual([]);
    expect(q.concept).toBe('Short.');
    expect(q.problem).toBeUndefined();
    expect(q.fix).toBeUndefined();
    expect(q.interview).toBeUndefined();
  });

  it('stops the merged list at the first line that is not a bullet', () => {
    const q = parseQuestion('# T\n**Merged from:**\n- one\n- two\nNot a bullet\n- three');
    expect(q.merged).toEqual(['one', 'two']);
  });

  it('returns an empty title when there is no "# " line', () => {
    expect(parseQuestion('no title here').title).toBe('');
  });
});

// Every real question file must parse into a title and four non-empty sections, in both languages.
describe('content files', () => {
  const content = join(__dirname, '..', '..', 'content');
  const files = ['junior', 'mid', 'senior', 'fr/junior', 'fr/mid', 'fr/senior'].flatMap((dir) =>
    readdirSync(join(content, dir))
      .filter((f) => f.endsWith('.md'))
      .map((f) => `${dir}/${f}`),
  );

  it('finds the question files', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(files)('%s parses completely', (file) => {
    const q = parseQuestion(readFileSync(join(content, file), 'utf8'));
    expect(q.title).not.toBe('');
    expect(q.concept?.length).toBeGreaterThan(0);
    expect(q.problem?.length).toBeGreaterThan(0);
    expect(q.fix?.length).toBeGreaterThan(0);
    expect(q.interview?.length).toBeGreaterThan(0);
  });
});
