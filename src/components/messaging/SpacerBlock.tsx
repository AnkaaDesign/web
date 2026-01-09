interface SpacerBlockProps {
  height?: 'sm' | 'md' | 'lg' | 'xl';
  id?: string;
}

export function SpacerBlock({ height = 'md', id }: SpacerBlockProps) {
  const heights = {
    sm: 'h-4',  // 1rem / 16px
    md: 'h-8',  // 2rem / 32px
    lg: 'h-12', // 3rem / 48px
    xl: 'h-16', // 4rem / 64px
  };

  return <div id={id} className={heights[height]} aria-hidden="true" />;
}
