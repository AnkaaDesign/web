/**
 * Chart Type Selector
 *
 * UI component for selecting chart type with visual previews.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChartType } from '@/lib/charts/chart-config';
import { Label } from '@/components/ui/label';
import {
  IconChartLine,
  IconChartBar,
  IconChartPie,
  IconChartArea,
  IconChartDots,
  IconChartInfographic,
  IconChartTreemap,
} from '@tabler/icons-react';

export interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
  className?: string;
}

const chartTypes: Array<{
  type: ChartType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    type: 'line',
    label: 'Line Chart',
    icon: IconChartLine,
    description: 'Show trends over time',
  },
  {
    type: 'bar',
    label: 'Bar Chart',
    icon: IconChartBar,
    description: 'Compare categories',
  },
  {
    type: 'pie',
    label: 'Pie Chart',
    icon: IconChartPie,
    description: 'Show proportions',
  },
  {
    type: 'area',
    label: 'Area Chart',
    icon: IconChartArea,
    description: 'Cumulative trends',
  },
  {
    type: 'combo',
    label: 'Combo Chart',
    icon: IconChartInfographic,
    description: 'Multiple chart types',
  },
  {
    type: 'heatmap',
    label: 'Heatmap',
    icon: IconChartDots,
    description: 'Density visualization',
  },
  {
    type: 'funnel',
    label: 'Funnel Chart',
    icon: IconChartTreemap,
    description: 'Conversion tracking',
  },
];

export const ChartTypeSelector: React.FC<ChartTypeSelectorProps> = ({
  value,
  onChange,
  className,
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      <Label>Chart Type</Label>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {chartTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = value === type.type;

          return (
            <button
              key={type.type}
              onClick={() => onChange(type.type)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-center',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              <Icon
                className={cn(
                  'h-8 w-8',
                  isSelected ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <div>
                <p
                  className={cn(
                    'text-sm font-medium',
                    isSelected ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {type.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {type.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

ChartTypeSelector.displayName = 'ChartTypeSelector';
