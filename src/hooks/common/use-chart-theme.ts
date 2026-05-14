import { useEffect, useState } from 'react';

export interface ChartTheme {
  isDark: boolean;
  textColor: string;      // strong text (labels, tooltip title)
  subTextColor: string;   // axis tick labels
  gridLineColor: string;  // dashed/solid grid lines
  axisLineColor: string;  // axis itself
  tooltipBg: string;
  tooltipBorder: string;
}

const LIGHT: ChartTheme = {
  isDark: false,
  textColor: '#3f3f46',
  subTextColor: '#71717a',
  gridLineColor: '#e4e4e7',
  axisLineColor: '#d4d4d8',
  tooltipBg: 'rgba(255,255,255,0.97)',
  tooltipBorder: '#e4e4e7',
};

const DARK: ChartTheme = {
  isDark: true,
  textColor: '#f4f4f5',
  subTextColor: '#a1a1aa',
  gridLineColor: '#27272a',
  axisLineColor: '#3f3f46',
  tooltipBg: 'rgba(24,24,27,0.95)',
  tooltipBorder: '#3f3f46',
};

/**
 * Theme tokens for inline ReactECharts components. Watches the
 * `dark` class on <html> so charts repaint when the theme toggles.
 */
export function useChartTheme(): ChartTheme {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark ? DARK : LIGHT;
}
