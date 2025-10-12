/**
 * TaskStatusDistribution
 * Business-specific chart for task status breakdown
 */

import React, { useMemo } from 'react';
import { PieChartComponent, PieChartDataPoint } from '../PieChartComponent';
import { COLOR_PALETTES } from '../utils/chart-colors';
import { ClipboardList } from 'lucide-react';

export interface TaskStatusData {
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  on_hold?: number;
}

export interface TaskStatusDistributionProps {
  data: TaskStatusData;
  className?: string;
  title?: string;
  description?: string;
  height?: number;
  variant?: 'pie' | 'donut';
  showPercentages?: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
  error?: Error | string | null;
}

export const TaskStatusDistribution = React.memo<TaskStatusDistributionProps>(({
  data,
  className,
  title = 'Distribuição de Tarefas por Status',
  description = 'Visão geral do status das tarefas',
  height = 400,
  variant = 'donut',
  showPercentages = true,
  onRefresh,
  isLoading,
  error,
}) => {
  // Convert data to pie chart format
  const chartData: PieChartDataPoint[] = useMemo(() => {
    const statusLabels = {
      pending: 'Pendente',
      in_progress: 'Em Andamento',
      completed: 'Concluído',
      cancelled: 'Cancelado',
      on_hold: 'Em Espera',
    };

    return Object.entries(data)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: statusLabels[key as keyof typeof statusLabels] || key,
        value,
        color: COLOR_PALETTES.status[key as keyof typeof COLOR_PALETTES.status],
      }));
  }, [data]);

  // Calculate total for center label
  const total = useMemo(() => {
    return Object.values(data).reduce((sum, val) => sum + (val || 0), 0);
  }, [data]);

  return (
    <PieChartComponent
      data={chartData}
      className={className}
      title={title}
      description={description}
      icon={<ClipboardList className="h-5 w-5" />}
      height={height}
      variant={variant}
      showPercentages={showPercentages}
      showValues={true}
      centerLabel="Total"
      centerValue={total}
      onRefresh={onRefresh}
      isLoading={isLoading}
      error={error}
    />
  );
});

TaskStatusDistribution.displayName = 'TaskStatusDistribution';
