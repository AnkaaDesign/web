/**
 * Filter Builder
 *
 * UI component for building and managing chart filters.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { FilterConfig, FilterOperator } from '@/lib/charts/chart-config';
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
import { IconPlus, IconX } from '@tabler/icons-react';

export interface FilterBuilderProps {
  value: FilterConfig[];
  onChange: (filters: FilterConfig[]) => void;
  availableFields?: string[];
  className?: string;
}

const filterOperators: Array<{ value: FilterOperator; label: string }> = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'notContains', label: 'Does Not Contain' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'In List' },
  { value: 'notIn', label: 'Not In List' },
];

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  value,
  onChange,
  availableFields = [],
  className,
}) => {
  const handleAddFilter = () => {
    const newFilter: FilterConfig = {
      field: '',
      label: '',
      operator: 'equals',
      value: '',
      type: 'text',
    };
    onChange([...value, newFilter]);
  };

  const handleRemoveFilter = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleUpdateFilter = (index: number, updates: Partial<FilterConfig>) => {
    const newFilters = [...value];
    newFilters[index] = { ...newFilters[index], ...updates };
    onChange(newFilters);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Label>Filters</Label>
        <Button variant="ghost" size="sm" onClick={handleAddFilter}>
          <IconPlus className="h-4 w-4 mr-1" />
          Add Filter
        </Button>
      </div>

      <div className="space-y-3">
        {value.map((filter, index) => (
          <div
            key={index}
            className="p-4 rounded-lg border border-border space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Filter {index + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveFilter(index)}
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Field</Label>
                {availableFields.length > 0 ? (
                  <Select
                    value={filter.field}
                    onValueChange={(field) =>
                      handleUpdateFilter(index, {
                        field,
                        label: field,
                      })
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
                    value={filter.field}
                    onChange={(e) =>
                      handleUpdateFilter(index, {
                        field: e.target.value,
                        label: e.target.value,
                      })
                    }
                    placeholder="Field name"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  type="text"
                  value={filter.label}
                  onChange={(e) =>
                    handleUpdateFilter(index, { label: e.target.value })
                  }
                  placeholder="Filter label"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select
                  value={filter.operator}
                  onValueChange={(operator: FilterOperator) =>
                    handleUpdateFilter(index, { operator })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOperators.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={filter.type || 'text'}
                  onValueChange={(type: any) =>
                    handleUpdateFilter(index, { type })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="select">Select</SelectItem>
                    <SelectItem value="multiselect">Multi-Select</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Default Value</Label>
              {filter.operator === 'between' ? (
                <div className="flex gap-2">
                  <Input
                    type={filter.type === 'number' ? 'number' : 'text'}
                    value={Array.isArray(filter.value) ? filter.value[0] : ''}
                    onChange={(e) =>
                      handleUpdateFilter(index, {
                        value: [e.target.value, Array.isArray(filter.value) ? filter.value[1] : ''],
                      })
                    }
                    placeholder="Min"
                  />
                  <Input
                    type={filter.type === 'number' ? 'number' : 'text'}
                    value={Array.isArray(filter.value) ? filter.value[1] : ''}
                    onChange={(e) =>
                      handleUpdateFilter(index, {
                        value: [Array.isArray(filter.value) ? filter.value[0] : '', e.target.value],
                      })
                    }
                    placeholder="Max"
                  />
                </div>
              ) : (
                <Input
                  type={
                    filter.type === 'number'
                      ? 'number'
                      : filter.type === 'date'
                      ? 'date'
                      : 'text'
                  }
                  value={
                    Array.isArray(filter.value)
                      ? filter.value.join(', ')
                      : String(filter.value)
                  }
                  onChange={(e) =>
                    handleUpdateFilter(index, { value: e.target.value })
                  }
                  placeholder="Default value"
                />
              )}
            </div>

            {(filter.type === 'select' || filter.type === 'multiselect') && (
              <div className="space-y-2">
                <Label>Options (comma-separated)</Label>
                <Input
                  type="text"
                  value={
                    filter.options
                      ?.map((opt) => `${opt.label}:${opt.value}`)
                      .join(', ') || ''
                  }
                  onChange={(e) => {
                    const options = e.target.value
                      .split(',')
                      .map((opt) => {
                        const [label, value] = opt.trim().split(':');
                        return { label: label || '', value: value || label || '' };
                      })
                      .filter((opt) => opt.label);
                    handleUpdateFilter(index, { options });
                  }}
                  placeholder="Option1:value1, Option2:value2"
                />
                <p className="text-xs text-muted-foreground">
                  Format: Label:Value (e.g., "Active:true, Inactive:false")
                </p>
              </div>
            )}
          </div>
        ))}

        {value.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No filters configured</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddFilter}
              className="mt-3"
            >
              <IconPlus className="h-4 w-4 mr-1" />
              Add First Filter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

FilterBuilder.displayName = 'FilterBuilder';
