/**
 * Heatmap Chart Component
 *
 * Renders heatmap charts using ECharts for correlation and density visualization.
 */

import * as React from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { ChartConfiguration } from '@/lib/charts/chart-config';
import { PivotTransformer } from '@/lib/charts/transformers';

export interface HeatmapChartProps {
  config: ChartConfiguration;
  data: any[];
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({ config, data }) => {
  const option = React.useMemo((): EChartsOption => {
    // Extract keys for heatmap
    const xKey = config.xAxis?.dataKey || 'x';
    const yKey = config.yAxis?.dataKey || 'y';
    const valueKey = config.series[0]?.dataKey || 'value';

    // Transform data to heatmap format
    const heatmapData = PivotTransformer.toHeatmap(data, {
      xKey,
      yKey,
      valueKey,
    });

    // Get unique x and y values
    const xValues = Array.from(new Set(heatmapData.map((d) => d.x))).sort();
    const yValues = Array.from(new Set(heatmapData.map((d) => d.y))).sort();

    // Convert to ECharts format [x, y, value]
    const seriesData = heatmapData.map((d) => {
      return [xValues.indexOf(d.x), yValues.indexOf(d.y), d.value];
    });

    // Find min and max values for color scale
    const values = heatmapData.map((d) => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    const theme = config.style?.theme || 'auto';
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const xValue = xValues[params.value[0]];
          const yValue = yValues[params.value[1]];
          const value = params.value[2];
          return `${yValue}<br/>${xValue}: <strong>${value}</strong>`;
        },
      },
      grid: {
        left: config.style?.grid?.left || '10%',
        right: config.style?.grid?.right || '10%',
        top: config.style?.grid?.top || '10%',
        bottom: config.style?.grid?.bottom || '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xValues,
        name: config.xAxis?.label,
        nameLocation: 'middle',
        nameGap: 30,
        splitArea: {
          show: true,
        },
        axisLabel: {
          color: isDark ? '#94a3b8' : '#64748b',
          rotate: 45,
        },
      },
      yAxis: {
        type: 'category',
        data: yValues,
        name: config.yAxis?.label,
        nameLocation: 'middle',
        nameGap: 50,
        splitArea: {
          show: true,
        },
        axisLabel: {
          color: isDark ? '#94a3b8' : '#64748b',
        },
      },
      visualMap: {
        min: minValue,
        max: maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: config.style?.colors || ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'],
        },
        textStyle: {
          color: isDark ? '#e2e8f0' : '#1e293b',
        },
      },
      series: [
        {
          name: config.series[0]?.name || 'Heatmap',
          type: 'heatmap',
          data: seriesData,
          label: {
            show: config.series[0]?.label?.show || false,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
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

HeatmapChart.displayName = 'HeatmapChart';
