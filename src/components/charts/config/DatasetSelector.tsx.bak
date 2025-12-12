/**
 * Dataset Selector
 *
 * UI component for selecting data source and endpoints.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { DataSourceConfig, DataSourceType } from '@/lib/charts/chart-config';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { IconPlus, IconX } from '@tabler/icons-react';

export interface DatasetSelectorProps {
  value: DataSourceConfig;
  onChange: (config: DataSourceConfig) => void;
  className?: string;
}

export const DatasetSelector: React.FC<DatasetSelectorProps> = ({
  value,
  onChange,
  className,
}) => {
  const [params, setParams] = React.useState<Array<{ key: string; value: string }>>(
    Object.entries(value.params || {}).map(([key, val]) => ({ key, value: String(val) }))
  );

  const handleTypeChange = (type: DataSourceType) => {
    onChange({ ...value, type });
  };

  const handleEndpointChange = (endpoint: string) => {
    onChange({ ...value, endpoint });
  };

  const handleParamChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const newParams = [...params];
    newParams[index][field] = newValue;
    setParams(newParams);
    updateParams(newParams);
  };

  const handleAddParam = () => {
    const newParams = [...params, { key: '', value: '' }];
    setParams(newParams);
  };

  const handleRemoveParam = (index: number) => {
    const newParams = params.filter((_, i) => i !== index);
    setParams(newParams);
    updateParams(newParams);
  };

  const updateParams = (newParams: Array<{ key: string; value: string }>) => {
    const paramsObject = newParams.reduce((acc, param) => {
      if (param.key) {
        acc[param.key] = param.value;
      }
      return acc;
    }, {} as Record<string, any>);
    onChange({ ...value, params: paramsObject });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-2">
        <Label>Data Source Type</Label>
        <Select value={value.type} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="api">API Endpoint</SelectItem>
            <SelectItem value="static">Static Data</SelectItem>
            <SelectItem value="realtime">Real-time Stream</SelectItem>
            <SelectItem value="computed">Computed Data</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(value.type === 'api' || value.type === 'realtime') && (
        <div className="space-y-2">
          <Label>Endpoint URL</Label>
          <Input
            type="text"
            value={value.endpoint || ''}
            onChange={(e) => handleEndpointChange(e.target.value)}
            placeholder="/api/data/endpoint"
          />
        </div>
      )}

      {value.type === 'api' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Query Parameters</Label>
            <Button variant="ghost" size="sm" onClick={handleAddParam}>
              <IconPlus className="h-4 w-4 mr-1" />
              Add Parameter
            </Button>
          </div>

          <div className="space-y-2">
            {params.map((param, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Key"
                  value={param.key}
                  onChange={(e) => handleParamChange(index, 'key', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={param.value}
                  onChange={(e) => handleParamChange(index, 'value', e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveParam(index)}
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {params.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No parameters added yet
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Cache Settings</Label>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cache-enabled"
              checked={value.cache?.enabled || false}
              onChange={(e) =>
                onChange({
                  ...value,
                  cache: { ...value.cache, enabled: e.target.checked, ttl: value.cache?.ttl || 300 },
                })
              }
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="cache-enabled" className="text-sm font-normal">
              Enable caching
            </Label>
          </div>

          {value.cache?.enabled && (
            <div className="flex items-center gap-2">
              <Label htmlFor="cache-ttl" className="text-sm font-normal">
                TTL (seconds):
              </Label>
              <Input
                id="cache-ttl"
                type="number"
                value={value.cache.ttl || 300}
                onChange={(e) =>
                  onChange({
                    ...value,
                    cache: { ...value.cache, enabled: true, ttl: Number(e.target.value) },
                  })
                }
                className="w-24"
                min={0}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

DatasetSelector.displayName = 'DatasetSelector';
