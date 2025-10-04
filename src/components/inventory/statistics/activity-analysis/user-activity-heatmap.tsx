import React, { useMemo } from "react";
import { Loader2 } from "lucide-react";

interface StatisticsFilters {
  dateRange: { from: Date; to: Date; };
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  categoryId?: string; brandId?: string; supplierId?: string; userId?: string; sectorId?: string;
}

interface UserActivityHeatmapProps {
  filters: StatisticsFilters;
}

export const UserActivityHeatmap: React.FC<UserActivityHeatmapProps> = ({ filters }) => {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="text-center">
        <div className="text-4xl mb-2">🚧</div>
        <span>Mapa de Calor de Atividade por Usuário</span>
        <div className="text-xs mt-1">Em desenvolvimento</div>
      </div>
    </div>
  );
};