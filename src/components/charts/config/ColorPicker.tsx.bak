/**
 * Color Picker
 *
 * UI component for selecting colors with presets and custom colors.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface ColorPickerProps {
  value: string[];
  onChange: (colors: string[]) => void;
  label?: string;
  maxColors?: number;
  className?: string;
}

const colorPresets = [
  {
    name: 'Default',
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
  },
  {
    name: 'Pastel',
    colors: ['#a5b4fc', '#86efac', '#fde047', '#fca5a5', '#c4b5fd', '#7dd3fc'],
  },
  {
    name: 'Vibrant',
    colors: ['#0ea5e9', '#22c55e', '#eab308', '#dc2626', '#9333ea', '#14b8a6'],
  },
  {
    name: 'Monochrome',
    colors: ['#1e293b', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'],
  },
  {
    name: 'Warm',
    colors: ['#dc2626', '#ea580c', '#f59e0b', '#fbbf24', '#fb923c', '#fca5a5'],
  },
  {
    name: 'Cool',
    colors: ['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16'],
  },
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label = 'Colors',
  maxColors = 10,
  className,
}) => {
  const [customColor, setCustomColor] = React.useState('#3b82f6');

  const handlePresetSelect = (colors: string[]) => {
    onChange(colors);
  };

  const handleAddColor = () => {
    if (value.length < maxColors) {
      onChange([...value, customColor]);
    }
  };

  const handleRemoveColor = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleColorChange = (index: number, color: string) => {
    const newColors = [...value];
    newColors[index] = color;
    onChange(newColors);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <Label>{label}</Label>

      <div className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground mb-2">Color Presets</p>
          <div className="grid grid-cols-2 gap-2">
            {colorPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetSelect(preset.colors)}
                className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex gap-1">
                  {preset.colors.slice(0, 4).map((color, index) => (
                    <div
                      key={index}
                      className="h-6 w-6 rounded"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-2">Custom Colors</p>
          <div className="space-y-2">
            {value.map((color, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(index, e.target.value)}
                  className="h-9 w-12 rounded border border-border cursor-pointer"
                />
                <Input
                  type="text"
                  value={color}
                  onChange={(e) => handleColorChange(index, e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveColor(index)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>

          {value.length < maxColors && (
            <div className="flex gap-2 mt-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="h-9 w-12 rounded border border-border cursor-pointer"
              />
              <Input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="#3b82f6"
                className="flex-1"
              />
              <Button variant="outline" onClick={handleAddColor}>
                Add
              </Button>
            </div>
          )}

          {value.length >= maxColors && (
            <p className="text-xs text-muted-foreground mt-2">
              Maximum of {maxColors} colors reached
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {value.map((color, index) => (
          <div
            key={index}
            className="h-8 w-8 rounded border-2 border-border"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
};

ColorPicker.displayName = 'ColorPicker';
