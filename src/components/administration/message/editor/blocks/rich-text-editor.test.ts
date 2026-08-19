import { describe, it, expect } from 'vitest';
import { domToMarkdown, markdownToHtml } from './rich-text-editor';
import { parseMarkdownToInlineFormat } from '@/utils/markdown-parser';

/**
 * The composer is a contentEditable: it renders stored markdown as HTML, and
 * serializes the edited DOM back to markdown on every keystroke. A marker the
 * HTML step cannot express leaks into the editor as literal text — and the next
 * keystroke bakes it into the stored content. These cover that round-trip.
 */
const roundTrip = (markdown: string): string => {
  const el = document.createElement('div');
  el.innerHTML = markdownToHtml(markdown);
  return domToMarkdown(el);
};

describe('markdownToHtml', () => {
  it('nests tags for a run that is both bold and colored', () => {
    expect(markdownToHtml('{c:#3bc914}**texto**{/c}')).toBe(
      '<b><span style="color:#3bc914">texto</span></b>',
    );
  });

  it('resolves nested color runs to the innermost color', () => {
    expect(markdownToHtml('{c:#3bc914}{c:#ef4444}x{/c}{/c}')).toBe(
      '<span style="color:#ef4444">x</span>',
    );
  });

  it('keeps consecutive runs of one style inside a single tag', () => {
    expect(markdownToHtml('**a {c:#ef4444}b{/c} c**')).toBe(
      '<b>a <span style="color:#ef4444">b</span> c</b>',
    );
  });

  it('never emits a marker as literal text', () => {
    const html = markdownToHtml('a {c:#3bc914}**b** c{/c} [d](https://ankaa.com) *e*');

    expect(html).not.toContain('{c:');
    expect(html).not.toContain('{/c}');
    expect(html).not.toContain('**');
  });

  it('escapes HTML in the source text', () => {
    expect(markdownToHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
  });

  it('drops unsafe link schemes', () => {
    expect(markdownToHtml('[clique](javascript:void)')).toBe('clique');
  });
});

describe('rich-text-editor round-trip', () => {
  // The shapes the composer itself produces must survive untouched.
  it.each([
    'texto simples',
    '**negrito**',
    '*itálico*',
    '__sublinhado__',
    '{c:#3bc914}verde{/c}',
    'a {c:#3bc914}b{/c} c',
    '**negrito com {c:#ef4444}vermelho{/c} dentro**',
    '[o site](https://ankaa.com)',
    '[a {c:#3bc914}b{/c}](https://ankaa.com)',
    'linha 1\nlinha 2',
  ])('is unchanged for %j', (markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  // Other orderings normalize to the canonical nesting. That rewrites the
  // stored text, so it must mean the same thing and must not drift further.
  it.each([
    ['{c:#3bc914}**verde e negrito**{/c}', '**{c:#3bc914}verde e negrito{/c}**'],
    [
      '{c:#3bc914}[o site](https://ankaa.com){/c}',
      '[{c:#3bc914}o site{/c}](https://ankaa.com)',
    ],
    // Content the old composer already stored: three stacked color tags.
    ['{c:#3bc914}{c:#ef4444}{c:#3bc914}10 minutos{/c}{/c}{/c}', '{c:#3bc914}10 minutos{/c}'],
  ])('normalizes %j to %j without changing its meaning', (input, expected) => {
    const once = roundTrip(input);
    expect(once).toBe(expected);
    expect(roundTrip(once)).toBe(once); // idempotent
    expect(parseMarkdownToInlineFormat(once)).toEqual(parseMarkdownToInlineFormat(input));
  });
});
