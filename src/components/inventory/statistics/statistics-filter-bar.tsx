import React, { useState, useCallback } from "react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { IconFilter, IconX, IconSettings, IconRefresh, IconBookmark } from "@tabler/icons-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";

import { PeriodSelector } from "./period-selector";
import { ComparisonSelector } from "./comparison-selector";
import { LabelOptionsSelector } from "./label-options-selector";
import { FilterPresets } from "./filter-presets";
import { useStatisticsFilterState } from "./use-statistics-filter-state";

export interface StatisticsFilters {
  // Date and period filters
  dateRange: DateRange | undefined;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

  // Entity filters
  categoryIds?: string[];
  brandIds?: string[];
  supplierIds?: string[];
  userIds?: string[];
  sectorIds?: string[];

  // Grouping and metrics
  groupBy: 'category' | 'brand' | 'supplier' | 'user' | 'sector' | 'month' | 'week';
  metrics: string[];

  // Comparison options
  compareWith?: 'previous-period' | 'previous-year' | 'none';
  showTrends?: boolean;

  // Display options
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'donut';
  aggregationType?: 'sum' | 'average' | 'count' | 'min' | 'max';

  // Label and formatting options
  showLabels?: boolean;
  showValues?: boolean;
  showPercentages?: boolean;
}

interface StatisticsFilterBarProps {
  initialFilters?: Partial<StatisticsFilters>;
  onFiltersChange: (filters: StatisticsFilters) => void;
  onReset?: () => void;
  className?: string;
  disabled?: boolean;
  showPresets?: boolean;
  compact?: boolean;
}

const METRIC_OPTIONS = [
  { value: 'totalValue', label: 'Valor Total', description: 'Soma do valor total dos itens' },
  { value: 'totalItems', label: 'Total de Itens', description: 'Quantidade total de itens' },
  { value: 'averageValue', label: 'Valor Médio', description: 'Valor médio por item' },
  { value: 'stockLevel', label: 'Nível de Estoque', description: 'Quantidade em estoque' },
  { value: 'turnoverRate', label: 'Taxa de Rotatividade', description: 'Taxa de rotação do estoque' },
  { value: 'activities', label: 'Atividades', description: 'Número de movimentações' },
];

const GROUP_BY_OPTIONS = [
  { value: 'category', label: 'Categoria' },
  { value: 'brand', label: 'Marca' },
  { value: 'supplier', label: 'Fornecedor' },
  { value: 'user', label: 'Usuário' },
  { value: 'sector', label: 'Setor' },
  { value: 'month', label: 'Mês' },
  { value: 'week', label: 'Semana' },
];

export function StatisticsFilterBar({
  initialFilters,
  onFiltersChange,
  onReset,
  className,
  disabled = false,
  showPresets = true,
  compact = false,
}: StatisticsFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    filters,
    activeFilterCount,
    currentPreset,
    updateFilter,
    updateFilters,
    resetFilters,
    applyPreset,
    presets,
  } = useStatisticsFilterState(initialFilters);

  // Notify parent component when filters change
  React.useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  const handleDateRangeChange = useCallback((dateRange: DateRange | undefined) => {
    updateFilter('dateRange', dateRange);
    if (dateRange) {
      updateFilter('period', 'custom');
    }
  }, [updateFilter]);

  const handlePeriodChange = useCallback((period: StatisticsFilters['period'], dateRange?: DateRange) => {
    updateFilter('period', period);
    if (dateRange) {
      updateFilter('dateRange', dateRange);
    }
  }, [updateFilter]);

  const handleGroupByChange = useCallback((groupBy: string) => {
    updateFilter('groupBy', groupBy as StatisticsFilters['groupBy']);
  }, [updateFilter]);

  const handleMetricsChange = useCallback((metrics: string[]) => {
    updateFilter('metrics', metrics);
  }, [updateFilter]);

  const handleReset = useCallback(() => {
    if (onReset) {
      onReset();
    } else {
      resetFilters();
    }
  }, [onReset, resetFilters]);

  return (
    <Card className={className}>
      <div className="p-4 space-y-4">
        {/* Top Row - Main Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              Período:
            </label>
            <DateRangePicker
              dateRange={filters.dateRange}
              onDateRangeChange={handleDateRangeChange}
              placeholder="Selecionar período"
              disabled={disabled}
              className="w-[280px]"
            />
          </div>

          {/* Period Quick Selector */}
          <PeriodSelector
            value={filters.period}
            onChange={handlePeriodChange}
            disabled={disabled}
          />

          {/* Group By Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              Agrupar por:
            </label>
            <select
              value={filters.groupBy}
              onChange={(e) => handleGroupByChange(e.target.value)}
              disabled={disabled}
              className="px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {GROUP_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Metrics Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              Métricas:
            </label>
            <select
              value={filters.metrics[0] || 'totalValue'}
              onChange={(e) => handleMetricsChange([e.target.value])}
              disabled={disabled}
              className="px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} title={option.description}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {showPresets && (
              <FilterPresets
                presets={presets}
                currentPreset={currentPreset}
                onApplyPreset={applyPreset}
                onReset={resetFilters}
                disabled={disabled}
              />
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={disabled}
            >
              <IconSettings className="h-4 w-4 mr-2" />
              Avançado
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={disabled}
            >
              <IconRefresh className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <>
            <Separator />
            <div className="space-y-4">
              {/* Comparison Options */}
              <ComparisonSelector
                compareWith={filters.compareWith}
                showTrends={filters.showTrends}
                onChange={(compareWith, showTrends) =>
                  updateFilters({ compareWith, showTrends })
                }
                disabled={disabled}
              />

              {/* Label and Display Options */}
              <LabelOptionsSelector
                chartType={filters.chartType}
                aggregationType={filters.aggregationType}
                showLabels={filters.showLabels}
                showValues={filters.showValues}
                showPercentages={filters.showPercentages}
                onChange={(options) => updateFilters(options)}
                disabled={disabled}
              />

              {/* Entity Filters - Placeholder for future implementation */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Filtros de entidades (categorias, marcas, fornecedores) serão implementados conforme necessário
                </div>
              </div>
            </div>
          </>
        )}

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <>
            <Separator />
            <div className="flex items-center gap-2">
              <IconFilter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Filtros ativos:
              </span>
              <Badge variant="outline">
                {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="ml-auto"
                disabled={disabled}
              >
                <IconX className="h-4 w-4 mr-1" />
                Limpar todos
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}