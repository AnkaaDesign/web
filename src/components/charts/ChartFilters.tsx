/**
 * Chart Filters
 *
 * Filterable controls for chart data with support for various filter types.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { FilterConfig } from '@/lib/charts/chart-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconX } from '@tabler/icons-react';

export interface ChartFiltersProps {
  filters: FilterConfig[];
  activeFilters: FilterConfig[];
  onChange: (filters: FilterConfig[]) => void;
  className?: string;
}

export const ChartFilters: React.FC<ChartFiltersProps> = ({
  filters,
  activeFilters,
  onChange,
  className,
}) => {
  const handleFilterChange = (index: number, value: any) => {
    const newFilters = [...activeFilters];
    newFilters[index] = { ...newFilters[index], value };
    onChange(newFilters);
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = activeFilters.filter((_, i) => i !== index);
    onChange(newFilters);
  };

  const handleResetFilters = () => {
    onChange(filters);
  };

  const renderFilterInput = (filter: FilterConfig, index: number) => {
    switch (filter.type) {
      case 'select':
        return (
          <Select
            value={String(filter.value)}
            onValueChange={(value) => handleFilterChange(index, value)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={`Select ${filter.label}`} />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        return (
          <div className="flex flex-wrap gap-2">
            {filter.options?.map((option) => {
              const isSelected =
                Array.isArray(filter.value) && filter.value.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    const currentValues = Array.isArray(filter.value) ? filter.value : [];
                    const newValues = isSelected
                      ? currentValues.filter((v) => v !== option.value)
                      : [...currentValues, option.value];
                    handleFilterChange(index, newValues);
                  }}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-md border transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border'
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={filter.value}
            onChange={(value) => handleFilterChange(index, Number(value as string))}
            className="h-9"
            placeholder={`Enter ${filter.label}`}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={filter.value}
            onChange={(value) => handleFilterChange(index, value as string)}
            className="h-9"
          />
        );

      case 'text':
      default:
        return (
          <Input
            type="text"
            value={filter.value}
            onChange={(value) => handleFilterChange(index, value as string)}
            className="h-9"
            placeholder={`Enter ${filter.label}`}
          />
        );
    }
  };

  const hasChanges = JSON.stringify(activeFilters) !== JSON.stringify(filters);

  return (
    <div className={cn('rounded-lg border border-border bg-muted/30 p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium">Filters</h4>
        {hasChanges && (
          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            Reset All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeFilters.map((filter, index) => (
          <div key={`${filter.field}-${index}`} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`filter-${index}`} className="text-xs font-medium">
                {filter.label}
              </Label>
              {activeFilters.length > 1 && (
                <button
                  onClick={() => handleRemoveFilter(index)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Remove filter"
                >
                  <IconX className="h-3 w-3" />
                </button>
              )}
            </div>
            {renderFilterInput(filter, index)}
            <p className="text-xs text-muted-foreground">
              {filter.operator.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

ChartFilters.displayName = 'ChartFilters';
