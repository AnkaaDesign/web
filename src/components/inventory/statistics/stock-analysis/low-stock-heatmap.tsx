import React, { useMemo } from "react";
import { Loader2, AlertTriangle, AlertCircle } from "lucide-react";

// Types
interface StatisticsFilters {
  dateRange: {
    from: Date;
    to: Date;
  };
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  userId?: string;
  sectorId?: string;
}

interface HeatmapItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  stockPercentage: number;
  urgencyLevel: 'critical' | 'low' | 'warning' | 'normal';
  lastMovement: string;
}

interface LowStockHeatmapProps {
  filters: StatisticsFilters;
}

// Mock data generator
const generateMockHeatmapData = (): HeatmapItem[] => {
  const categories = ['Ferramentas', 'Materiais', 'EPI', 'Eletrônicos', 'Consumíveis'];
  const data: HeatmapItem[] = [];

  for (let i = 0; i < 20; i++) {
    const minStock = Math.floor(Math.random() * 20) + 5;
    const maxStock = minStock + Math.floor(Math.random() * 50) + 20;
    const currentStock = Math.floor(Math.random() * (maxStock + 10));
    const stockPercentage = (currentStock / maxStock) * 100;

    let urgencyLevel: HeatmapItem['urgencyLevel'];
    if (currentStock <= minStock * 0.5) urgencyLevel = 'critical';
    else if (currentStock <= minStock) urgencyLevel = 'low';
    else if (currentStock <= minStock * 1.5) urgencyLevel = 'warning';
    else urgencyLevel = 'normal';

    data.push({
      id: `item-${i}`,
      name: `Item ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      currentStock,
      minStock,
      maxStock,
      stockPercentage: Math.max(0, stockPercentage),
      urgencyLevel,
      lastMovement: `${Math.floor(Math.random() * 30) + 1} dias atrás`,
    });
  }

  return data.sort((a, b) => a.stockPercentage - b.stockPercentage);
};

const getUrgencyColor = (level: HeatmapItem['urgencyLevel']) => {
  switch (level) {
    case 'critical':
      return 'bg-red-100 border-red-300 text-red-900';
    case 'low':
      return 'bg-orange-100 border-orange-300 text-orange-900';
    case 'warning':
      return 'bg-yellow-100 border-yellow-300 text-yellow-900';
    case 'normal':
      return 'bg-green-100 border-green-300 text-green-900';
    default:
      return 'bg-gray-100 border-gray-300 text-gray-900';
  }
};

const getUrgencyIcon = (level: HeatmapItem['urgencyLevel']) => {
  switch (level) {
    case 'critical':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    case 'low':
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    default:
      return null;
  }
};

export const LowStockHeatmap: React.FC<LowStockHeatmapProps> = ({ filters }) => {
  const { data, isLoading, error } = useMemo(() => {
    try {
      // Filter based on urgency - only show items that need attention
      const mockData = generateMockHeatmapData().filter(item =>
        item.urgencyLevel !== 'normal'
      );
      return { data: mockData, isLoading: false, error: null };
    } catch (err) {
      return { data: [], isLoading: false, error: 'Erro ao carregar dados' };
    }
  }, [filters]);

  const summary = useMemo(() => {
    if (!data) return null;

    return {
      critical: data.filter(item => item.urgencyLevel === 'critical').length,
      low: data.filter(item => item.urgencyLevel === 'low').length,
      warning: data.filter(item => item.urgencyLevel === 'warning').length,
      total: data.length,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando dados...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <span>{error}</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <div className="text-green-600 mb-2">🎉</div>
          <span>Todos os itens estão com estoque adequado!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
          <div className="text-center p-2 rounded bg-red-50 border border-red-200">
            <div className="font-semibold text-red-600">{summary.critical}</div>
            <div className="text-red-500">Crítico</div>
          </div>
          <div className="text-center p-2 rounded bg-orange-50 border border-orange-200">
            <div className="font-semibold text-orange-600">{summary.low}</div>
            <div className="text-orange-500">Baixo</div>
          </div>
          <div className="text-center p-2 rounded bg-yellow-50 border border-yellow-200">
            <div className="font-semibold text-yellow-600">{summary.warning}</div>
            <div className="text-yellow-500">Atenção</div>
          </div>
          <div className="text-center p-2 rounded bg-gray-50 border border-gray-200">
            <div className="font-semibold text-gray-600">{summary.total}</div>
            <div className="text-gray-500">Total</div>
          </div>
        </div>
      )}

      {/* Heatmap Grid */}
      <div className="h-48 overflow-y-auto">
        <div className="grid grid-cols-4 gap-2">
          {data.map((item) => (
            <div
              key={item.id}
              className={`p-2 rounded-md border text-xs ${getUrgencyColor(item.urgencyLevel)}`}
              title={`${item.name} - ${item.category}\nEstoque: ${item.currentStock}/${item.maxStock}\nMín: ${item.minStock}\nÚltima movimentação: ${item.lastMovement}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium truncate">{item.name}</span>
                {getUrgencyIcon(item.urgencyLevel)}
              </div>

              <div className="text-xs opacity-75 mb-1 truncate">{item.category}</div>

              <div className="flex items-center justify-between">
                <span className="font-mono">{item.currentStock}/{item.maxStock}</span>
                <span className="font-semibold">{item.stockPercentage.toFixed(0)}%</span>
              </div>

              {/* Stock level bar */}
              <div className="w-full bg-white/50 rounded-full h-1 mt-1">
                <div
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, item.stockPercentage)}%`,
                    backgroundColor: item.urgencyLevel === 'critical' ? '#dc2626' :
                                   item.urgencyLevel === 'low' ? '#ea580c' :
                                   item.urgencyLevel === 'warning' ? '#ca8a04' : '#16a34a'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span>Crítico (&lt; 50% do mínimo)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-500"></div>
          <span>Baixo (&lt; mínimo)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500"></div>
          <span>Atenção (&lt; 150% do mínimo)</span>
        </div>
      </div>
    </div>
  );
};