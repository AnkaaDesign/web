import React from "react";

interface StatisticsFilters {
  dateRange: { from: Date; to: Date; };
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  categoryId?: string; brandId?: string; supplierId?: string; userId?: string; sectorId?: string;
}

interface ComponentProps {
  filters: StatisticsFilters;
}

export const SeasonalPatternChart: React.FC<ComponentProps> = ({ filters }) => {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="text-center">
        <div className="text-4xl mb-2">🔮</div>
        <span>Padrões Sazonais</span>
        <div className="text-xs mt-1">Em desenvolvimento</div>
      </div>
    </div>
  );
};
