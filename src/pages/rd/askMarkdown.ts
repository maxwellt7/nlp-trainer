export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string };

export type Block =
  | { type: 'p'; inlines: Inline[] }
  | { type: 'quote'; inlines: Inline[] }
  | { type: 'gap' };

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function parseInlines(text: string): Inline[] {
  const src = String(text || '');
  const out: Inline[] = [];
  INLINE_RE.lastIndex = 0;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(src))) {
    if (match.index > last) out.push({ type: 'text', value: src.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      out.push({ type: 'strong', value: token.slice(2, -2) });
    } else {
      out.push({ type: 'em', value: token.slice(1, -1) });
    }
    last = match.index + token.length;
  }
  if (last < src.length) out.push({ type: 'text', value: src.slice(last) });
  return out.length ? out : [{ type: 'text', value: src }];
}

export function parseAskMarkdown(text: string): Block[] {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let quoteLines: string[] = [];

  const flushQuote = () => {
    if (!quoteLines.length) return;
    blocks.push({ type: 'quote', inlines: parseInlines(quoteLines.join(' ').trim()) });
    quoteLines = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const quoted = line.match(/^>\s?(.*)$/);
    if (quoted) {
      quoteLines.push(quoted[1]);
      continue;
    }
    flushQuote();
    if (!line.trim()) {
      if (blocks.length && blocks[blocks.length - 1].type !== 'gap') blocks.push({ type: 'gap' });
      continue;
    }
    blocks.push({ type: 'p', inlines: parseInlines(line.trim()) });
  }
  flushQuote();
  return blocks;
}
