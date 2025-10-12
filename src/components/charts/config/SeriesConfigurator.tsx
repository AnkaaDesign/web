/**
 * Series Configurator
 *
 * UI component for configuring chart series (data lines/bars).
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { SeriesConfig, ChartType } from '@/lib/charts/chart-config';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconPlus, IconX, IconGripVertical } from '@tabler/icons-react';

export interface SeriesConfiguratorProps {
  value: SeriesConfig[];
  onChange: (series: SeriesConfig[]) => void;
  chartType: ChartType;
  availableFields?: string[];
  className?: string;
}

export const SeriesConfigurator: React.FC<SeriesConfiguratorProps> = ({
  value,
  onChange,
  chartType,
  availableFields = [],
  className,
}) => {
  const handleAddSeries = () => {
    const newSeries: SeriesConfig = {
      name: `Series ${value.length + 1}`,
      dataKey: '',
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    };
    onChange([...value, newSeries]);
  };

  const handleRemoveSeries = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleUpdateSeries = (index: number, updates: Partial<SeriesConfig>) => {
    const newSeries = [...value];
    newSeries[index] = { ...newSeries[index], ...updates };
    onChange(newSeries);
  };

  const supportsMultipleSeries = ['line', 'bar', 'area', 'combo'].includes(chartType);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Series Configuration</h4>
        {supportsMultipleSeries && (
          <Button variant="ghost" size="sm" onClick={handleAddSeries}>
            <IconPlus className="h-4 w-4 mr-1" />
            Add Series
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {value.map((series, index) => (
          <div
            key={index}
            className="p-4 rounded-lg border border-border space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconGripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                <span className="font-medium text-sm">Series {index + 1}</span>
              </div>
              {value.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveSeries(index)}
                >
                  <IconX className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  type="text"
                  value={series.name}
                  onChange={(e) =>
                    handleUpdateSeries(index, { name: e.target.value })
                  }
                  placeholder="Series name"
                />
              </div>

              <div className="space-y-2">
                <Label>Data Field</Label>
                {availableFields.length > 0 ? (
                  <Select
                    value={series.dataKey}
                    onValueChange={(dataKey) =>
                      handleUpdateSeries(index, { dataKey })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map((field) => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="text"
                    value={series.dataKey}
                    onChange={(e) =>
                      handleUpdateSeries(index, { dataKey: e.target.value })
                    }
                    placeholder="Field name"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={series.color || '#3b82f6'}
                    onChange={(e) =>
                      handleUpdateSeries(index, { color: e.target.value })
                    }
                    className="h-9 w-12 rounded border border-border cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={series.color || '#3b82f6'}
                    onChange={(e) =>
                      handleUpdateSeries(index, { color: e.target.value })
                    }
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>

              {chartType === 'combo' && (
                <div className="space-y-2">
                  <Label>Chart Type</Label>
                  <Select
                    value={series.type || 'bar'}
                    onValueChange={(type: any) =>
                      handleUpdateSeries(index, { type })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {(chartType === 'bar' || chartType === 'area') && (
              <div className="space-y-2">
                <Label>Stack ID (optional)</Label>
                <Input
                  type="text"
                  value={series.stackId || ''}
                  onChange={(e) =>
                    handleUpdateSeries(index, { stackId: e.target.value })
                  }
                  placeholder="Leave empty for no stacking"
                />
                <p className="text-xs text-muted-foreground">
                  Series with the same stack ID will be stacked together
                </p>
              </div>
            )}

            {chartType === 'line' && (
              <div className="space-y-2">
                <Label>Line Style</Label>
                <Select
                  value={series.lineStyle?.type || 'solid'}
                  onValueChange={(type: any) =>
                    handleUpdateSeries(index, {
                      lineStyle: { ...series.lineStyle, type },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="dashed">Dashed</SelectItem>
                    <SelectItem value="dotted">Dotted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`series-${index}-hide`}
                checked={series.hide || false}
                onChange={(e) =>
                  handleUpdateSeries(index, { hide: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              <Label
                htmlFor={`series-${index}-hide`}
                className="text-sm font-normal"
              >
                Hide series by default
              </Label>
            </div>
          </div>
        ))}

        {value.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No series configured</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddSeries}
              className="mt-3"
            >
              <IconPlus className="h-4 w-4 mr-1" />
              Add First Series
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

SeriesConfigurator.displayName = 'SeriesConfigurator';
