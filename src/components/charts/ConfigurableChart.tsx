/**
 * Configurable Chart
 *
 * Main chart component that renders any chart type based on configuration.
 * Handles data fetching, transformation, and rendering.
 */

import * as React from 'react';
import type { ChartConfiguration } from '@/lib/charts/chart-config';
import { ChartContainer } from './ChartContainer';
import { ChartFilters } from './ChartFilters';
import { LineChart } from './LineChart';
import { BarChart } from './BarChart';
import { PieChart } from './PieChart';
import { AreaChart } from './AreaChart';
import { HeatmapChart } from './HeatmapChart';
import { FunnelChart } from './FunnelChart';
import { ComboChart } from './ComboChart';
import axios from 'axios';
import html2canvas from 'html2canvas';

export interface ConfigurableChartProps {
  config: ChartConfiguration;
  data?: any[];
  className?: string;
  onDataFetch?: (data: any[]) => void;
}

export const ConfigurableChart: React.FC<ConfigurableChartProps> = ({
  config,
  data: externalData,
  className,
  onDataFetch,
}) => {
  const [data, setData] = React.useState<any[]>(externalData || []);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [showFilters, setShowFilters] = React.useState(false);
  const [activeFilters, setActiveFilters] = React.useState(config.filters || []);
  const chartRef = React.useRef<HTMLDivElement>(null);

  // Fetch data if using API data source
  const fetchData = React.useCallback(async () => {
    if (externalData) {
      setData(externalData);
      return;
    }

    if (config.dataSource.type !== 'api' || !config.dataSource.endpoint) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(config.dataSource.endpoint, {
        params: config.dataSource.params,
      });

      const fetchedData = Array.isArray(response.data) ? response.data : response.data.data || [];
      setData(fetchedData);
      onDataFetch?.(fetchedData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [config.dataSource, externalData, onDataFetch]);

  // Initial data fetch
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh if interval is set
  React.useEffect(() => {
    if (!config.refreshInterval) return;

    const interval = setInterval(fetchData, config.refreshInterval);
    return () => clearInterval(interval);
  }, [config.refreshInterval, fetchData]);

  // Update data when external data changes
  React.useEffect(() => {
    if (externalData) {
      setData(externalData);
    }
  }, [externalData]);

  // Apply filters to data
  const filteredData = React.useMemo(() => {
    if (!activeFilters || activeFilters.length === 0) {
      return data;
    }

    return data.filter((item) => {
      return activeFilters.every((filter) => {
        const value = item[filter.field];

        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'notEquals':
            return value !== filter.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'notContains':
            return !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'greaterThan':
            return Number(value) > Number(filter.value);
          case 'lessThan':
            return Number(value) < Number(filter.value);
          case 'between':
            return (
              Number(value) >= Number(filter.value[0]) &&
              Number(value) <= Number(filter.value[1])
            );
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value);
          case 'notIn':
            return Array.isArray(filter.value) && !filter.value.includes(value);
          default:
            return true;
        }
      });
    });
  }, [data, activeFilters]);

  // Export functions
  const handleExport = async (format: 'png' | 'svg' | 'pdf' | 'csv' | 'excel') => {
    if (format === 'csv' || format === 'excel') {
      exportData(format);
    } else {
      await exportImage(format);
    }
  };

  const exportData = (format: 'csv' | 'excel') => {
    if (!filteredData || filteredData.length === 0) return;

    if (format === 'csv') {
      const headers = Object.keys(filteredData[0]);
      const csvContent = [
        headers.join(','),
        ...filteredData.map((row) =>
          headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${config.export?.filename || config.id}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const exportImage = async (format: 'png' | 'svg' | 'pdf') => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      if (format === 'png') {
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = `${config.export?.filename || config.id}.png`;
        link.click();
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to export chart:', err);
      }
    }
  };

  // Render appropriate chart type
  const renderChart = () => {
    if (!filteredData || filteredData.length === 0) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-center max-w-md">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <p className="font-medium text-foreground">No data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                {config.empty?.message || 'There is no data to display for this chart'}
              </p>
            </div>
            {config.empty?.action && (
              <button
                onClick={config.empty.action.onClick}
                className="text-sm text-primary hover:underline"
              >
                {config.empty.action.label}
              </button>
            )}
          </div>
        </div>
      );
    }

    const chartProps = {
      config,
      data: filteredData,
    };

    switch (config.type) {
      case 'line':
        return <LineChart {...chartProps} />;
      case 'bar':
        return <BarChart {...chartProps} />;
      case 'pie':
        return <PieChart {...chartProps} />;
      case 'area':
        return <AreaChart {...chartProps} />;
      case 'heatmap':
        return <HeatmapChart {...chartProps} />;
      case 'funnel':
        return <FunnelChart {...chartProps} />;
      case 'combo':
        return <ComboChart {...chartProps} />;
      default:
        return (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Chart type "{config.type}" is not supported
            </p>
          </div>
        );
    }
  };

  return (
    <div className={className} ref={chartRef}>
      <ChartContainer
        config={config}
        loading={loading}
        error={error}
        onRefresh={fetchData}
        onExport={handleExport}
        onFilterToggle={() => setShowFilters(!showFilters)}
        showFilters={showFilters}
      >
        {showFilters && config.filters && config.filters.length > 0 && (
          <div className="mb-6">
            <ChartFilters
              filters={config.filters}
              activeFilters={activeFilters}
              onChange={setActiveFilters}
            />
          </div>
        )}

        <div className="w-full" style={{ height: config.height || 400 }}>
          {renderChart()}
        </div>
      </ChartContainer>
    </div>
  );
};

ConfigurableChart.displayName = 'ConfigurableChart';
