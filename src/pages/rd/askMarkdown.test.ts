import { describe, it, expect } from 'vitest';
import { parseAskMarkdown, parseInlines } from './askMarkdown';

describe('parseInlines', () => {
  it('marks **bold** and *italic* without leaving the markers', () => {
    expect(parseInlines("**That's the whole game.** Stay.")).toEqual([
      { type: 'strong', value: "That's the whole game." },
      { type: 'text', value: ' Stay.' },
    ]);
    expect(parseInlines('Tell little Max: *"You\'re scared."*')).toEqual([
      { type: 'text', value: 'Tell little Max: ' },
      { type: 'em', value: '"You\'re scared."' },
    ]);
  });

  it('returns a single text node when there is no markup', () => {
    expect(parseInlines('Find the fear.')).toEqual([{ type: 'text', value: 'Find the fear.' }]);
  });
});

describe('parseAskMarkdown', () => {
  it('renders the Ask screenshot sample as paragraph + blockquote + italic + bold', () => {
    const src = [
      'Not "how do I fix this with Alexa" — because as David told Max:',
      '> *"You won\'t be able to stop yourself [from over-functioning] if you don\'t go in and actually settle that nervous system down."*',
      'Find the fear. Name it. Tell little Max: *"You\'re scared. I\'ve got this."*',
      "**That's the whole game.** Everything else flows naturally.",
    ].join('\n');

    const blocks = parseAskMarkdown(src);
    expect(blocks[0]).toEqual({
      type: 'p',
      inlines: [{ type: 'text', value: 'Not "how do I fix this with Alexa" — because as David told Max:' }],
    });
    expect(blocks[1].type).toBe('quote');
    if (blocks[1].type === 'quote') {
      expect(blocks[1].inlines).toEqual([
        { type: 'em', value: '"You won\'t be able to stop yourself [from over-functioning] if you don\'t go in and actually settle that nervous system down."' },
      ]);
    }
    expect(blocks[3].type).toBe('p');
    if (blocks[3].type === 'p') {
      expect(blocks[3].inlines[0]).toEqual({ type: 'strong', value: "That's the whole game." });
    }
  });

  it('merges consecutive quote lines and skips trailing empty gaps', () => {
    const blocks = parseAskMarkdown('> one\n> two\n\nnext');
    expect(blocks.map((b) => b.type)).toEqual(['quote', 'gap', 'p']);
    if (blocks[0].type === 'quote') {
      expect(blocks[0].inlines).toEqual([{ type: 'text', value: 'one two' }]);
    }
  });
});
