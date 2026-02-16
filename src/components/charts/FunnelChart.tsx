/**
 * Funnel Chart Component
 *
 * Renders funnel charts using ECharts for conversion and process visualization.
 */

import * as React from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { ChartConfiguration } from '@/lib/charts/chart-config';

export interface FunnelChartProps {
  config: ChartConfiguration;
  data: any[];
}

export const FunnelChart: React.FC<FunnelChartProps> = ({ config, data }) => {
  const option = React.useMemo((): EChartsOption => {
    const nameKey = config.xAxis?.dataKey || 'name';
    const valueKey = config.series[0]?.dataKey || 'value';

    // Transform data to funnel format
    const funnelData = data.map((item) => ({
      name: item[nameKey],
      value: Number(item[valueKey]) || 0,
    }));

    // Sort by value descending (typical funnel order)
    funnelData.sort((a, b) => b.value - a.value);

    const theme = config.style?.theme || 'auto';
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const colors = config.style?.colors || [
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#06b6d4',
    ];

    return {
      title: {
        show: false,
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const percentage = params.percent ? `${params.percent.toFixed(1)}%` : '';
          return `${params.name}<br/><strong>${params.value.toLocaleString()}</strong> ${percentage}`;
        },
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        textStyle: {
          color: isDark ? '#e2e8f0' : '#1e293b',
        },
      },
      legend: config.legend?.show !== false ? {
        orient: config.legend?.layout === 'vertical' ? 'vertical' : 'horizontal',
        left: config.legend?.align === 'start' ? 'left' : config.legend?.align === 'end' ? 'right' : 'center',
        top: config.legend?.position === 'top' ? '0%' : config.legend?.position === 'bottom' ? 'bottom' : 'middle',
        textStyle: {
          color: isDark ? '#e2e8f0' : '#1e293b',
        },
      } : undefined,
      series: [
        {
          name: config.series[0]?.name || 'Funnel',
          type: 'funnel',
          left: '10%',
          right: '10%',
          top: '15%',
          bottom: '15%',
          width: '80%',
          min: 0,
          max: 100,
          minSize: '0%',
          maxSize: '100%',
          sort: 'descending',
          gap: 2,
          label: {
            show: config.series[0]?.label?.show !== false,
            position: 'inside',
            formatter: '{b}: {c}',
            color: '#ffffff',
            fontSize: 14,
          },
          labelLine: {
            show: false,
          },
          itemStyle: {
            borderColor: isDark ? '#0f172a' : '#ffffff',
            borderWidth: 2,
          },
          emphasis: {
            label: {
              fontSize: 16,
              fontWeight: 'bold',
            },
          },
          data: funnelData.map((item, index) => ({
            ...item,
            itemStyle: {
              color: colors[index % colors.length],
            },
          })),
        },
      ],
    };
  }, [config, data]);

  return (
    <ReactECharts
      option={option}
      style={{ height: '100%', width: '100%' }}
      notMerge={true}
      lazyUpdate={true}
    />
  );
};

FunnelChart.displayName = 'FunnelChart';
