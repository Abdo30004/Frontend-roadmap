// Parser for the question markdown files in content/. Kept free of React so it is easy to test.

type Section = 'concept' | 'problem' | 'fix' | 'interview';

/**
 * Reads one question file: the "# " title, the "Merged from" phrasings and the four "## " sections.
 * Section headings are matched by their English start, also in French files.
 */
export function parseQuestion(md: string) {
  const text = md.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const title = (lines.find((l) => l.startsWith('# ')) ?? '').slice(2).trim();

  const merged: string[] = [];
  const mi = lines.findIndex((l) => l.startsWith('**Merged from'));
  if (mi >= 0) {
    for (let i = mi + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('- ')) merged.push(l.slice(2).trim());
      else if (l.trim() === '' && merged.length === 0) continue;
      else break;
    }
  }

  // Split on "## " headings, but never on a "## " line inside a ``` code block
  // (some answers show markdown documents as examples).
  const parts: string[] = [];
  let inFence = false;
  let current: string[] | null = null;
  for (const line of lines) {
    if (line.startsWith('```')) inFence = !inFence;
    if (!inFence && line.startsWith('## ')) {
      if (current) parts.push(current.join('\n'));
      current = [line.slice(3)];
    } else if (current) current.push(line);
  }
  if (current) parts.push(current.join('\n'));

  const sections: Partial<Record<Section, string>> = {};
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const heading = (nl < 0 ? part : part.slice(0, nl)).toLowerCase();
    const body = nl < 0 ? '' : part.slice(nl + 1).trim();
    if (heading.startsWith('the concept')) sections.concept = body;
    else if (heading.startsWith('real-life')) sections.problem = body;
    else if (heading.startsWith('how to fix')) sections.fix = body;
    else if (heading.startsWith('how to say')) sections.interview = body;
  }
  return { title, merged, ...sections };
}
