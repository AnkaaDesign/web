/**
 * Chart Container
 *
 * Wrapper component for all charts providing consistent layout,
 * title, description, filters, and export functionality.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconDownload, IconRefresh, IconFilter, IconMaximize } from '@tabler/icons-react';
import { ChartConfiguration } from '@/lib/charts/chart-config';

export interface ChartContainerProps {
  config: ChartConfiguration;
  loading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  onExport?: (format: 'png' | 'svg' | 'pdf' | 'csv' | 'excel') => void;
  onFilterToggle?: () => void;
  onFullscreen?: () => void;
  showFilters?: boolean;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  config,
  loading = false,
  error = null,
  onRefresh,
  onExport,
  onFilterToggle,
  onFullscreen,
  showFilters = false,
  children,
  className,
  actions,
}) => {
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);

  const handleExport = (format: 'png' | 'svg' | 'pdf' | 'csv' | 'excel') => {
    onExport?.(format);
    setExportMenuOpen(false);
  };

  return (
    <Card className={cn('relative', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle>{config.title}</CardTitle>
            {config.description && (
              <CardDescription className="mt-2">{config.description}</CardDescription>
            )}
          </div>

          <div className="flex items-center gap-2 ml-4">
            {actions}

            {config.filters && config.filters.length > 0 && onFilterToggle && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onFilterToggle}
                className={cn(showFilters && 'bg-muted')}
                title="Toggle filters"
              >
                <IconFilter className="h-4 w-4" />
              </Button>
            )}

            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={loading}
                title="Refresh data"
              >
                <IconRefresh className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            )}

            {config.export?.enabled && onExport && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                  title="Export chart"
                >
                  <IconDownload className="h-4 w-4" />
                </Button>

                {exportMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setExportMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-40 rounded-lg border border-border bg-popover shadow-sm z-50">
                      <div className="p-1">
                        {config.export.formats.map((format) => (
                          <button
                            key={format}
                            onClick={() => handleExport(format)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted rounded transition-colors"
                          >
                            Export as {format.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {onFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onFullscreen}
                title="Fullscreen"
              >
                <IconMaximize className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                {config.loading?.message || 'Loading chart data...'}
              </p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3 text-center max-w-md">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-2xl">⚠</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Failed to load chart</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error.message || 'An unexpected error occurred'}
                </p>
              </div>
              {config.error?.retry && (
                <Button variant="outline" size="sm" onClick={config.error.retry}>
                  Try Again
                </Button>
              )}
            </div>
          </div>
        )}

        {!loading && !error && children}
      </CardContent>

      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-xl" />
      )}
    </Card>
  );
};

ChartContainer.displayName = 'ChartContainer';
