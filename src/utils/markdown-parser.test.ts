import { describe, it, expect } from 'vitest';
import {
  parseMarkdownToInlineFormat,
  expandInlineFormat,
  stripMarkdownFormatting,
  removeMarkdownFormat,
} from './markdown-parser';

describe('parseMarkdownToInlineFormat', () => {
  it('parses bold nested inside a color run', () => {
    const runs = parseMarkdownToInlineFormat(
      'empresa, {c:#3bc914}**não sendo permitida a saída**{/c}, salvo',
    );

    expect(runs.map((r) => r.content).join('')).toBe(
      'empresa, não sendo permitida a saída, salvo',
    );
    const colored = runs.find((r) => r.color)!;
    expect(colored.content).toBe('não sendo permitida a saída');
    expect(colored.color).toBe('#3bc914');
    expect(colored.bold).toBe(true);
  });

  it('collapses nested color runs to the innermost color', () => {
    const runs = parseMarkdownToInlineFormat(
      'máxima de {c:#3bc914}{c:#ef4444}{c:#3bc914}10 (dez) minutos,{/c}{/c}{/c} devendo',
    );

    expect(runs.map((r) => r.content).join('')).toBe('máxima de 10 (dez) minutos, devendo');
    const colored = runs.find((r) => r.color)!;
    expect(colored.content).toBe('10 (dez) minutos,');
    expect(colored.color).toBe('#3bc914');
  });

  it('keeps the outer color for text around an inner recolor', () => {
    const runs = parseMarkdownToInlineFormat('{c:#3bc914}a{c:#ef4444}b{/c}c{/c}');

    expect(runs.map((r) => r.content)).toEqual(['a', 'b', 'c']);
    expect(runs.map((r) => r.color)).toEqual(['#3bc914', '#ef4444', '#3bc914']);
  });

  it('parses color nested inside bold', () => {
    const runs = parseMarkdownToInlineFormat('**aviso {c:#ef4444}urgente{/c}**');

    expect(runs.every((r) => r.bold)).toBe(true);
    expect(runs.at(-1)!.color).toBe('#ef4444');
  });

  it('handles bold containing italic', () => {
    const runs = parseMarkdownToInlineFormat('**bold *and italic* text**');

    expect(runs.map((r) => r.content).join('')).toBe('bold and italic text');
    expect(runs.every((r) => r.bold)).toBe(true);
    expect(runs.filter((r) => r.italic).map((r) => r.content).join('')).toBe('and italic');
  });

  it('parses links, including inside a color run', () => {
    const runs = parseMarkdownToInlineFormat('veja {c:#3bc914}[o site](https://ankaa.com){/c}');

    const link = runs.find((r) => r.url)!;
    expect(link.content).toBe('o site');
    expect(link.url).toBe('https://ankaa.com');
    expect(link.color).toBe('#3bc914');
    expect(link.type).toBe('link');
  });

  it('drops unsafe link schemes but keeps the label', () => {
    const runs = parseMarkdownToInlineFormat('[clique](javascript:void)');

    expect(runs).toHaveLength(1);
    expect(runs[0].url).toBeUndefined();
    expect(runs[0].content).toBe('clique');
  });

  it('leaves unmatched or empty markers as literal text', () => {
    expect(parseMarkdownToInlineFormat('2 ** 3')).toEqual([{ type: 'text', content: '2 ** 3' }]);
    expect(parseMarkdownToInlineFormat('{c:#3bc914}{/c}')).toEqual([
      { type: 'text', content: '{c:#3bc914}{/c}' },
    ]);
    expect(parseMarkdownToInlineFormat('{c:#3bc914}sem fechar')).toEqual([
      { type: 'text', content: '{c:#3bc914}sem fechar' },
    ]);
    expect(parseMarkdownToInlineFormat('texto simples')).toEqual([
      { type: 'text', content: 'texto simples' },
    ]);
    expect(parseMarkdownToInlineFormat('')).toEqual([]);
  });

  it('keeps newlines inside a marked run', () => {
    const runs = parseMarkdownToInlineFormat('{c:#3bc914}linha 1\nlinha 2{/c}');

    expect(runs).toHaveLength(1);
    expect(runs[0].content).toBe('linha 1\nlinha 2');
  });
});

describe('expandInlineFormat', () => {
  it('parses markers inside a structured run and keeps its style', () => {
    const runs = expandInlineFormat({
      type: 'color',
      content: '**verde e negrito**',
      color: '#3bc914',
    });

    expect(runs).toHaveLength(1);
    expect(runs[0].content).toBe('verde e negrito');
    expect(runs[0].color).toBe('#3bc914');
    expect(runs[0].bold).toBe(true);
  });

  it('leaves a plain text run untouched', () => {
    expect(expandInlineFormat({ type: 'text', content: 'sem marcadores' })).toEqual([
      { type: 'text', content: 'sem marcadores' },
    ]);
  });
});

describe('stripMarkdownFormatting', () => {
  it('strips nested markers without leaving leftovers', () => {
    expect(
      stripMarkdownFormatting('{c:#3bc914}{c:#ef4444}**10 (dez) minutos**{/c}{/c} totais'),
    ).toBe('10 (dez) minutos totais');
  });

  it('strips links down to their label', () => {
    expect(stripMarkdownFormatting('veja [o site](https://ankaa.com)')).toBe('veja o site');
  });
});

describe('removeMarkdownFormat', () => {
  it('removes every color marker of a nested run', () => {
    expect(removeMarkdownFormat('{c:#3bc914}{c:#ef4444}x{/c}{/c}', 'color')).toBe('x');
  });

  it('removes bold across markers that contain other formatting', () => {
    expect(removeMarkdownFormat('**a *b* c**', 'bold')).toBe('a *b* c');
  });
});
