import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StockItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  reorderPoint: number;
  percentage: number;
  daysUntilStockout: number;
}

export function LowStockHeatmap() {
  // Generate mock data
  const generateLowStockItems = (): StockItem[] => {
    const categories = ["Ferramentas", "EPIs", "Materiais", "Eletrônicos", "Consumíveis"];
    const items: StockItem[] = [];

    categories.forEach(category => {
      for (let i = 0; i < 8; i++) {
        const reorderPoint = Math.floor(Math.random() * 100) + 50;
        const currentStock = Math.floor(Math.random() * reorderPoint * 1.5);
        const percentage = (currentStock / reorderPoint) * 100;
        const consumptionRate = Math.random() * 5 + 1;
        const daysUntilStockout = Math.floor(currentStock / consumptionRate);

        items.push({
          id: `${category}-${i}`,
          name: `${category} Item ${i + 1}`,
          category,
          currentStock,
          reorderPoint,
          percentage,
          daysUntilStockout,
        });
      }
    });

    return items.sort((a, b) => a.percentage - b.percentage);
  };

  const items = generateLowStockItems();
  const categories = ["Ferramentas", "EPIs", "Materiais", "Eletrônicos", "Consumíveis"];

  // Get color based on stock level
  const getColor = (percentage: number) => {
    if (percentage <= 0) return "bg-gray-900 text-white"; // Out of stock
    if (percentage < 25) return "bg-red-600 text-white"; // Critical
    if (percentage < 50) return "bg-orange-500 text-white"; // Low
    if (percentage < 75) return "bg-yellow-400"; // Warning
    if (percentage < 100) return "bg-green-400"; // OK
    return "bg-green-600 text-white"; // Good
  };

  // Group items by category
  const itemsByCategory = categories.map(category => ({
    category,
    items: items.filter(item => item.category === category).slice(0, 10),
  }));

  // Calculate statistics
  const criticalCount = items.filter(i => i.percentage < 25).length;
  const lowCount = items.filter(i => i.percentage >= 25 && i.percentage < 50).length;
  const warningCount = items.filter(i => i.percentage >= 50 && i.percentage < 75).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <CardTitle>Mapa de Calor - Estoque Baixo</CardTitle>
          </div>
          <div className="flex gap-2">
            <Badge variant="destructive">{criticalCount} Críticos</Badge>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              {lowCount} Baixos
            </Badge>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              {warningCount} Atenção
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center justify-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-900"></div>
              <span>Sem Estoque</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-600"></div>
              <span>Crítico (&lt;25%)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-orange-500"></div>
              <span>Baixo (25-50%)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-yellow-400"></div>
              <span>Atenção (50-75%)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-500"></div>
              <span>OK (&gt;75%)</span>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="space-y-3">
            {itemsByCategory.map(({ category, items: categoryItems }) => (
              <div key={category}>
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  {category}
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {categoryItems.map(item => (
                    <div
                      key={item.id}
                      className={`relative group cursor-pointer transition-all hover:scale-110 ${getColor(
                        item.percentage
                      )} rounded p-2 text-center`}
                      title={`${item.name}\nEstoque: ${item.currentStock}\nPonto de Pedido: ${item.reorderPoint}\nDias até ruptura: ${item.daysUntilStockout}`}
                    >
                      <div className="text-xs font-bold">
                        {item.percentage.toFixed(0)}%
                      </div>
                      {item.daysUntilStockout < 7 && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Critical Items List */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Itens Mais Críticos (Ação Imediata)</h4>
            <div className="space-y-2">
              {items.slice(0, 5).map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded"
                >
                  <div>
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.currentStock} unidades • Ruptura em {item.daysUntilStockout} dias
                    </div>
                  </div>
                  <Badge variant="destructive" className="ml-2">
                    {item.percentage.toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}