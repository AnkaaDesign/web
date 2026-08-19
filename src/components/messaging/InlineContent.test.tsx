import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { InlineContent } from './InlineContent';

afterEach(cleanup);

const html = (ui: React.ReactElement) => render(ui).container.innerHTML;

describe('InlineContent', () => {
  it('renders a bold run inside a colored one without leaking markers', () => {
    const out = html(
      <InlineContent content={[{ type: 'text', content: '{c:#3bc914}**texto**{/c}' }]} />,
    );

    expect(out).toContain('color: rgb(59, 201, 20)');
    expect(out).toContain('<strong');
    expect(out).not.toContain('**');
    expect(out).not.toContain('{c:');
  });

  it('does not let the bold class override the run color', () => {
    const out = html(
      <InlineContent content={[{ type: 'text', content: '{c:#3bc914}**texto**{/c}' }]} />,
    );

    // `text-foreground` on <strong> would repaint the text and cancel the color.
    expect(out).not.toContain('text-foreground');
  });

  it('resolves nested color runs to the innermost color', () => {
    const out = html(
      <InlineContent
        content={[{ type: 'text', content: '{c:#3bc914}{c:#ef4444}x{/c}{/c}' }]}
      />,
    );

    expect(out).toContain('color: rgb(239, 68, 68)');
    expect(out).not.toContain('{/c}');
  });

  it('expands markers stored inside a typed run', () => {
    const out = html(
      <InlineContent
        content={[{ type: 'color', content: '**negrito**', color: '#3bc914' }]}
      />,
    );

    expect(out).toContain('<strong');
    expect(out).toContain('color: rgb(59, 201, 20)');
    expect(out).not.toContain('**');
  });

  it('renders a safe link', () => {
    html(<InlineContent content={[{ type: 'text', content: '[o site](https://ankaa.com)' }]} />);

    expect(screen.getByRole('link')).toHaveProperty('href', 'https://ankaa.com/');
  });

  it('drops an unsafe href stored in structured content', () => {
    const out = html(
      // eslint-disable-next-line no-script-url
      <InlineContent content={[{ type: 'link', content: 'clique', url: 'javascript:alert(1)' }]} />,
    );

    expect(out).not.toContain('javascript:');
    expect(out).toContain('clique');
  });

  it('accepts a raw markdown string as content', () => {
    const out = html(<InlineContent content={'{c:#ef4444}alerta{/c}'} />);

    expect(out).toContain('color: rgb(239, 68, 68)');
    expect(out).toContain('alerta');
  });

  it('renders newlines as line breaks', () => {
    expect(html(<InlineContent content={[{ type: 'text', content: 'a\nb' }]} />)).toContain('<br>');
  });
});
