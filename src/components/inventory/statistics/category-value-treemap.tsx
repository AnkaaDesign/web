import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package2, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Treemap, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "../../../utils";

interface CategoryData {
  name: string;
  value: number;
  fill: string;
  items: number;
  trend: number;
  children?: CategoryData[];
}

interface CustomTreemapContent {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  value: number;
  fill: string;
  items?: number;
}

export function CategoryValueTreemap() {
  const [viewMode, setViewMode] = useState<"value" | "quantity">("value");

  // Generate mock category data with subcategories
  const generateCategoryData = (): CategoryData[] => {
    const categories = [
      {
        name: "Ferramentas",
        baseValue: 450000,
        color: "#3B82F6",
        subcategories: [
          { name: "Elétricas", percentage: 0.4 },
          { name: "Manuais", percentage: 0.35 },
          { name: "Pneumáticas", percentage: 0.25 },
        ],
      },
      {
        name: "EPIs",
        baseValue: 320000,
        color: "#10B981",
        subcategories: [
          { name: "Capacetes", percentage: 0.25 },
          { name: "Luvas", percentage: 0.3 },
          { name: "Botas", percentage: 0.45 },
        ],
      },
      {
        name: "Matéria Prima",
        baseValue: 680000,
        color: "#F59E0B",
        subcategories: [
          { name: "Metais", percentage: 0.5 },
          { name: "Plásticos", percentage: 0.3 },
          { name: "Químicos", percentage: 0.2 },
        ],
      },
      {
        name: "Eletrônicos",
        baseValue: 280000,
        color: "#8B5CF6",
        subcategories: [
          { name: "Sensores", percentage: 0.4 },
          { name: "Controladores", percentage: 0.35 },
          { name: "Cabos", percentage: 0.25 },
        ],
      },
      {
        name: "Consumíveis",
        baseValue: 190000,
        color: "#EF4444",
        subcategories: [
          { name: "Escritório", percentage: 0.3 },
          { name: "Limpeza", percentage: 0.4 },
          { name: "Manutenção", percentage: 0.3 },
        ],
      },
      {
        name: "Peças",
        baseValue: 420000,
        color: "#06B6D4",
        subcategories: [
          { name: "Reposição", percentage: 0.6 },
          { name: "Upgrade", percentage: 0.4 },
        ],
      },
    ];

    return categories.map(cat => ({
      name: cat.name,
      value: cat.baseValue + Math.random() * 50000 - 25000,
      fill: cat.color,
      items: Math.floor(Math.random() * 500) + 100,
      trend: Math.random() * 40 - 20, // -20% to +20%
      children: cat.subcategories.map(sub => ({
        name: `${cat.name} - ${sub.name}`,
        value: cat.baseValue * sub.percentage,
        fill: cat.color,
        items: Math.floor((Math.random() * 500 + 100) * sub.percentage),
        trend: Math.random() * 40 - 20,
      })),
    }));
  };

  const categoryData = generateCategoryData();

  // Calculate totals
  const totalValue = categoryData.reduce((sum, cat) => sum + cat.value, 0);
  const totalItems = categoryData.reduce((sum, cat) => sum + cat.items, 0);

  // Find top categories
  const topCategories = [...categoryData].sort((a, b) => b.value - a.value).slice(0, 3);

  // Custom content renderer for treemap rectangles
  const CustomizedContent = (props: any) => {
    const { x, y, width, height, name, value, fill, items } = props as CustomTreemapContent;

    // Only show label if rectangle is large enough
    if (width < 80 || height < 40) return null;

    const displayName = name.includes(" - ") ? name.split(" - ")[1] : name;
    const displayValue = viewMode === "value"
      ? formatCurrency(value)
      : `${items?.toLocaleString("pt-BR")} itens`;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill,
            stroke: "#fff",
            strokeWidth: 2,
            strokeOpacity: 1,
          }}
        />
        <text
          x={x + width / 2}
          y={y + height / 2 - 10}
          textAnchor="middle"
          fill="#fff"
          fontSize={14}
          fontWeight="600"
        >
          {displayName}
        </text>
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          fill="#fff"
          fontSize={12}
        >
          {displayValue}
        </text>
      </g>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border">
          <p className="font-semibold">{data.name}</p>
          <div className="space-y-1 mt-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-medium">{formatCurrency(data.value)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Itens:</span>
              <span className="font-medium">{data.items?.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">% do Total:</span>
              <span className="font-medium">
                {((data.value / totalValue) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between gap-4 items-center">
              <span className="text-muted-foreground">Tendência:</span>
              <span className={`font-medium flex items-center gap-1 ${
                data.trend > 0 ? "text-green-600" : "text-red-600"
              }`}>
                {data.trend > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {data.trend > 0 ? "+" : ""}{data.trend.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package2 className="h-5 w-5 text-primary" />
            <CardTitle>Valor do Estoque por Categoria</CardTitle>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("value")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === "value"
                  ? "bg-primary text-primary-foreground"
                  : "bg-gray-100 dark:bg-gray-800"
              }`}
            >
              Valor
            </button>
            <button
              onClick={() => setViewMode("quantity")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === "quantity"
                  ? "bg-primary text-primary-foreground"
                  : "bg-gray-100 dark:bg-gray-800"
              }`}
            >
              Quantidade
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                Valor Total
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(totalValue)}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Package2 className="h-4 w-4" />
                Total de Itens
              </div>
              <div className="text-2xl font-bold">
                {totalItems.toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                Valor Médio/Item
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(totalValue / totalItems)}
              </div>
            </div>
          </div>

          {/* Treemap Chart */}
          <ResponsiveContainer width="100%" height={400}>
            <Treemap
              data={categoryData}
              dataKey={viewMode === "value" ? "value" : "items"}
              aspectRatio={4 / 3}
              stroke="#fff"
              fill="#3B82F6"
              content={<CustomizedContent />}
            >
              <Tooltip content={<CustomTooltip />} />
            </Treemap>
          </ResponsiveContainer>

          {/* Top Categories */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Top 3 Categorias por Valor
            </h3>
            <div className="space-y-2">
              {topCategories.map((cat, index) => (
                <div
                  key={cat.name}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.fill }}
                    />
                    <div>
                      <div className="font-medium">{cat.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {cat.items} itens • {((cat.value / totalValue) * 100).toFixed(1)}% do total
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(cat.value)}</div>
                    <div className={`text-sm flex items-center gap-1 ${
                      cat.trend > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {cat.trend > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {cat.trend > 0 ? "+" : ""}{cat.trend.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Distribution */}
          <div className="flex flex-wrap gap-2">
            {categoryData.map(cat => (
              <Badge
                key={cat.name}
                variant="outline"
                style={{ borderColor: cat.fill }}
              >
                <div
                  className="w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: cat.fill }}
                />
                {cat.name}: {((cat.value / totalValue) * 100).toFixed(1)}%
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}