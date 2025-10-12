/**
 * Chart Config Panel
 *
 * Main UI panel for configuring all chart settings.
 * Combines all configuration sub-components into a unified interface.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  ChartConfiguration,
  createChartConfig,
  createAxisConfig,
  createSeriesConfig,
  createDataSourceConfig,
  validateChartConfig,
} from '@/lib/charts/chart-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartTypeSelector } from './ChartTypeSelector';
import { DatasetSelector } from './DatasetSelector';
import { AxisConfigurator } from './AxisConfigurator';
import { SeriesConfigurator } from './SeriesConfigurator';
import { ColorPicker } from './ColorPicker';
import { FilterBuilder } from './FilterBuilder';
import { IconDeviceFloppy, IconX, IconAlertCircle } from '@tabler/icons-react';

export interface ChartConfigPanelProps {
  config: ChartConfiguration;
  onChange: (config: ChartConfiguration) => void;
  onSave?: (config: ChartConfiguration) => void;
  onCancel?: () => void;
  className?: string;
}

export const ChartConfigPanel: React.FC<ChartConfigPanelProps> = ({
  config,
  onChange,
  onSave,
  onCancel,
  className,
}) => {
  const [validation, setValidation] = React.useState<{
    valid: boolean;
    errors: string[];
  }>({ valid: true, errors: [] });

  // Validate on config change
  React.useEffect(() => {
    const result = validateChartConfig(config);
    setValidation(result);
  }, [config]);

  const handleSave = () => {
    const result = validateChartConfig(config);
    if (result.valid && onSave) {
      onSave(config);
    } else {
      setValidation(result);
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Chart Configuration</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure all aspects of your chart
            </p>
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                <IconX className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            )}
            {onSave && (
              <Button onClick={handleSave} disabled={!validation.valid}>
                <IconDeviceFloppy className="h-4 w-4 mr-1" />
                Save
              </Button>
            )}
          </div>
        </div>

        {/* Validation Errors */}
        {!validation.valid && validation.errors.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2">
              <IconAlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-destructive">
                  Configuration Errors
                </p>
                <ul className="mt-1 space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index} className="text-sm text-destructive/90">
                      • {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Tabs */}
      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="general" className="h-full">
          <TabsList className="w-full justify-start border-b rounded-none px-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="data">Data Source</TabsTrigger>
            <TabsTrigger value="axes">Axes</TabsTrigger>
            <TabsTrigger value="series">Series</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <div className="p-4">
            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Chart ID</Label>
                <Input
                  type="text"
                  value={config.id}
                  onChange={(e) => onChange({ ...config, id: e.target.value })}
                  placeholder="unique-chart-id"
                />
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  type="text"
                  value={config.title}
                  onChange={(e) => onChange({ ...config, title: e.target.value })}
                  placeholder="Chart Title"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  type="text"
                  value={config.description || ''}
                  onChange={(e) =>
                    onChange({ ...config, description: e.target.value })
                  }
                  placeholder="Chart description (optional)"
                />
              </div>

              <ChartTypeSelector
                value={config.type}
                onChange={(type) => onChange({ ...config, type })}
              />

              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  type="text"
                  value={config.category || ''}
                  onChange={(e) => onChange({ ...config, category: e.target.value })}
                  placeholder="e.g., inventory, production, financial"
                />
              </div>
            </TabsContent>

            {/* Data Source Tab */}
            <TabsContent value="data" className="mt-0">
              <DatasetSelector
                value={config.dataSource}
                onChange={(dataSource) => onChange({ ...config, dataSource })}
              />
            </TabsContent>

            {/* Axes Tab */}
            <TabsContent value="axes" className="space-y-4 mt-0">
              <AxisConfigurator
                axis="x"
                value={config.xAxis || createAxisConfig()}
                onChange={(xAxis) => onChange({ ...config, xAxis })}
              />

              <AxisConfigurator
                axis="y"
                value={config.yAxis || createAxisConfig({ type: 'number' })}
                onChange={(yAxis) => onChange({ ...config, yAxis })}
              />

              {config.type === 'combo' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable-secondary-y"
                      checked={!!config.secondaryYAxis}
                      onChange={(e) =>
                        onChange({
                          ...config,
                          secondaryYAxis: e.target.checked
                            ? createAxisConfig({ type: 'number', position: 'right' })
                            : undefined,
                        })
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="enable-secondary-y" className="font-normal">
                      Enable secondary Y-axis
                    </Label>
                  </div>

                  {config.secondaryYAxis && (
                    <AxisConfigurator
                      axis="y"
                      value={config.secondaryYAxis}
                      onChange={(secondaryYAxis) =>
                        onChange({ ...config, secondaryYAxis })
                      }
                    />
                  )}
                </div>
              )}
            </TabsContent>

            {/* Series Tab */}
            <TabsContent value="series" className="mt-0">
              <SeriesConfigurator
                value={config.series}
                onChange={(series) => onChange({ ...config, series })}
                chartType={config.type}
              />
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="space-y-4 mt-0">
              <ColorPicker
                value={config.style?.colors || []}
                onChange={(colors) =>
                  onChange({
                    ...config,
                    style: { ...config.style, colors },
                  })
                }
              />

              <div className="space-y-2">
                <Label>Height</Label>
                <Input
                  type="number"
                  value={config.height || 400}
                  onChange={(e) =>
                    onChange({ ...config, height: Number(e.target.value) })
                  }
                  placeholder="400"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="responsive"
                  checked={config.responsive !== false}
                  onChange={(e) =>
                    onChange({ ...config, responsive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="responsive" className="font-normal">
                  Responsive sizing
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-grid"
                  checked={config.style?.grid?.show !== false}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      style: {
                        ...config.style,
                        grid: { ...config.style?.grid, show: e.target.checked },
                      },
                    })
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="show-grid" className="font-normal">
                  Show grid lines
                </Label>
              </div>
            </TabsContent>

            {/* Filters Tab */}
            <TabsContent value="filters" className="mt-0">
              <FilterBuilder
                value={config.filters || []}
                onChange={(filters) => onChange({ ...config, filters })}
              />
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Refresh Interval (ms)</Label>
                <Input
                  type="number"
                  value={config.refreshInterval || ''}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      refreshInterval: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="0 (disabled)"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-refresh data at specified interval (0 to disable)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Export Formats</Label>
                <div className="space-y-2">
                  {['png', 'svg', 'pdf', 'csv', 'excel'].map((format) => (
                    <div key={format} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`export-${format}`}
                        checked={config.export?.formats.includes(format as any) || false}
                        onChange={(e) => {
                          const currentFormats = config.export?.formats || [];
                          const newFormats = e.target.checked
                            ? [...currentFormats, format as any]
                            : currentFormats.filter((f) => f !== format);
                          onChange({
                            ...config,
                            export: {
                              ...config.export,
                              enabled: true,
                              formats: newFormats as any,
                            },
                          });
                        }}
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor={`export-${format}`} className="font-normal">
                        {format.toUpperCase()}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Interactions</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable-zoom"
                      checked={config.interaction?.zoom?.enabled || false}
                      onChange={(e) =>
                        onChange({
                          ...config,
                          interaction: {
                            ...config.interaction,
                            zoom: { enabled: e.target.checked },
                          },
                        })
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="enable-zoom" className="font-normal">
                      Enable zoom
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable-brush"
                      checked={config.interaction?.brush?.enabled || false}
                      onChange={(e) =>
                        onChange({
                          ...config,
                          interaction: {
                            ...config.interaction,
                            brush: { enabled: e.target.checked },
                          },
                        })
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="enable-brush" className="font-normal">
                      Enable brush selection
                    </Label>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

ChartConfigPanel.displayName = 'ChartConfigPanel';
