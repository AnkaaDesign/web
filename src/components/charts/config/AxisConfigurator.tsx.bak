/**
 * Axis Configurator
 *
 * UI component for configuring chart axes (X and Y).
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { AxisConfig } from '@/lib/charts/chart-config';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface AxisConfiguratorProps {
  axis: 'x' | 'y';
  value: AxisConfig;
  onChange: (config: AxisConfig) => void;
  availableFields?: string[];
  className?: string;
}

export const AxisConfigurator: React.FC<AxisConfiguratorProps> = ({
  axis,
  value,
  onChange,
  availableFields = [],
  className,
}) => {
  const axisLabel = axis === 'x' ? 'X-Axis' : 'Y-Axis';

  return (
    <div className={cn('space-y-4 p-4 rounded-lg border border-border', className)}>
      <h4 className="font-medium text-sm">{axisLabel} Configuration</h4>

      <div className="space-y-2">
        <Label>Data Field</Label>
        {availableFields.length > 0 ? (
          <Select
            value={value.dataKey || ''}
            onValueChange={(dataKey) => onChange({ ...value, dataKey })}
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
            value={value.dataKey || ''}
            onChange={(e) => onChange({ ...value, dataKey: e.target.value })}
            placeholder="Enter field name"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Axis Type</Label>
        <Select
          value={value.type || 'category'}
          onValueChange={(type: any) => onChange({ ...value, type })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="time">Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          type="text"
          value={value.label || ''}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder={`${axisLabel} label`}
        />
      </div>

      {value.type === 'number' && (
        <>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Input
              type="text"
              value={value.unit || ''}
              onChange={(e) => onChange({ ...value, unit: e.target.value })}
              placeholder="e.g., $, %, units"
            />
          </div>

          <div className="space-y-2">
            <Label>Domain</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={value.domain?.[0] || 'auto'}
                onChange={(e) =>
                  onChange({
                    ...value,
                    domain: [e.target.value as any, value.domain?.[1] || 'auto'],
                  })
                }
                placeholder="Min (auto)"
              />
              <Input
                type="text"
                value={value.domain?.[1] || 'auto'}
                onChange={(e) =>
                  onChange({
                    ...value,
                    domain: [value.domain?.[0] || 'auto', e.target.value as any],
                  })
                }
                placeholder="Max (auto)"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Scale</Label>
            <Select
              value={value.scale || 'auto'}
              onValueChange={(scale: any) => onChange({ ...value, scale })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="log">Logarithmic</SelectItem>
                <SelectItem value="sqrt">Square Root</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`${axis}-hide`}
          checked={value.hide || false}
          onChange={(e) => onChange({ ...value, hide: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor={`${axis}-hide`} className="text-sm font-normal">
          Hide axis
        </Label>
      </div>

      {value.type === 'number' && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`${axis}-decimals`}
            checked={value.allowDecimals !== false}
            onChange={(e) => onChange({ ...value, allowDecimals: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor={`${axis}-decimals`} className="text-sm font-normal">
            Allow decimal values
          </Label>
        </div>
      )}
    </div>
  );
};

AxisConfigurator.displayName = 'AxisConfigurator';
