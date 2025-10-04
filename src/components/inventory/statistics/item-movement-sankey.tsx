import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch } from "lucide-react";
import { Sankey, Tooltip, ResponsiveContainer } from "recharts";

interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

interface SankeyNode {
  name: string;
}

export function ItemMovementSankey() {
  // Generate mock Sankey data showing item flow
  const nodes: SankeyNode[] = [
    // Sources
    { name: "Fornecedor A" },
    { name: "Fornecedor B" },
    { name: "Fornecedor C" },
    { name: "Devolução" },
    // Middle layer - Warehouse
    { name: "Estoque Central" },
    { name: "Estoque Secundário" },
    // Destinations
    { name: "Produção" },
    { name: "Manutenção" },
    { name: "EPIs" },
    { name: "Empréstimos" },
    { name: "Perdas" },
  ];

  const links: SankeyLink[] = [
    // From suppliers to warehouses
    { source: 0, target: 4, value: 120 }, // Fornecedor A -> Estoque Central
    { source: 1, target: 4, value: 85 },  // Fornecedor B -> Estoque Central
    { source: 2, target: 5, value: 45 },  // Fornecedor C -> Estoque Secundário
    { source: 3, target: 4, value: 25 },  // Devolução -> Estoque Central

    // From warehouses to destinations
    { source: 4, target: 6, value: 150 }, // Estoque Central -> Produção
    { source: 4, target: 7, value: 40 },  // Estoque Central -> Manutenção
    { source: 4, target: 8, value: 30 },  // Estoque Central -> EPIs
    { source: 5, target: 6, value: 35 },  // Estoque Secundário -> Produção
    { source: 5, target: 9, value: 8 },   // Estoque Secundário -> Empréstimos
    { source: 4, target: 10, value: 5 },  // Estoque Central -> Perdas
  ];

  // Calculate totals for summary
  const totalInflow = links
    .filter(link => link.target === 4 || link.target === 5)
    .reduce((sum, link) => sum + link.value, 0);

  const totalOutflow = links
    .filter(link => link.source === 4 || link.source === 5)
    .reduce((sum, link) => sum + link.value, 0);

  // Since Recharts doesn't have native Sankey, we'll create a visual representation
  // For a real implementation, you'd use a library like d3-sankey or react-sankey-diagram

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <CardTitle>Fluxo de Movimentação de Itens</CardTitle>
          </div>
          <div className="text-sm text-muted-foreground">
            Últimos 30 dias
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Visual Flow Representation */}
          <div className="relative">
            <div className="grid grid-cols-3 gap-8">
              {/* Sources Column */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Origens</h4>
                {nodes.slice(0, 4).map((node, index) => (
                  <div
                    key={node.name}
                    className="bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3"
                  >
                    <div className="font-medium text-sm">{node.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {links
                        .filter(link => link.source === index)
                        .reduce((sum, link) => sum + link.value, 0)} itens
                    </div>
                  </div>
                ))}
              </div>

              {/* Middle Column - Warehouses */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Estoques</h4>
                {nodes.slice(4, 6).map((node, nodeIndex) => {
                  const index = nodeIndex + 4;
                  const inflow = links
                    .filter(link => link.target === index)
                    .reduce((sum, link) => sum + link.value, 0);
                  const outflow = links
                    .filter(link => link.source === index)
                    .reduce((sum, link) => sum + link.value, 0);

                  return (
                    <div
                      key={node.name}
                      className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-4"
                    >
                      <div className="font-medium">{node.name}</div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Entrada:</span>
                          <span className="ml-1 text-green-600 dark:text-green-400 font-medium">
                            +{inflow}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Saída:</span>
                          <span className="ml-1 text-red-600 dark:text-red-400 font-medium">
                            -{outflow}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Destinations Column */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Destinos</h4>
                {nodes.slice(6).map((node, nodeIndex) => {
                  const index = nodeIndex + 6;
                  const inflow = links
                    .filter(link => link.target === index)
                    .reduce((sum, link) => sum + link.value, 0);

                  return (
                    <div
                      key={node.name}
                      className={`border rounded-md p-3 ${
                        node.name === "Perdas"
                          ? "bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                          : "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      }`}
                    >
                      <div className="font-medium text-sm">{node.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {inflow} itens
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Flow Lines Visual Representation */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: -1 }}
              preserveAspectRatio="none"
            >
              {links.map((link, index) => {
                // This is a simplified representation
                // In a real implementation, you'd calculate proper curve paths
                const sourceY = 50 + (link.source % 4) * 80;
                const targetY = 50 + ((link.target - 4) % 5) * 80;
                const opacity = Math.min(0.3 + (link.value / 100) * 0.5, 0.8);

                return (
                  <path
                    key={index}
                    d={`M ${link.source < 4 ? 100 : 350} ${sourceY}
                        Q 250 ${(sourceY + targetY) / 2}
                        ${link.target > 5 ? 500 : 350} ${targetY}`}
                    stroke="currentColor"
                    strokeWidth={Math.max(1, link.value / 20)}
                    fill="none"
                    opacity={opacity}
                    className="text-primary"
                  />
                );
              })}
            </svg>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-4 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Total Entrada</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                +{totalInflow}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Saída</p>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                -{totalOutflow}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Para Produção</p>
              <p className="text-lg font-semibold">
                {links.filter(l => l.target === 6).reduce((sum, l) => sum + l.value, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Perda</p>
              <p className="text-lg font-semibold">
                {((links.find(l => l.target === 10)?.value || 0) / totalOutflow * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}