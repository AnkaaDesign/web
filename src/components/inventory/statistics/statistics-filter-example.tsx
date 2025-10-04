import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconChartBar, IconFilter, IconSettings } from "@tabler/icons-react";

import { StatisticsFilterBar, type StatisticsFilters } from "./statistics-filter-bar";

/**
 * Example component demonstrating the complete usage of Statistics Filter components
 * This shows how to integrate all filter functionality in a real statistics dashboard
 */
export function StatisticsFilterExample() {
  const [filters, setFilters] = useState<StatisticsFilters | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFiltersChange = (newFilters: StatisticsFilters) => {
    setFilters(newFilters);
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  const handleReset = () => {
    setFilters(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconChartBar className="h-5 w-5" />
            Estatísticas de Inventário
          </CardTitle>
          <CardDescription>
            Exemplo completo de uso dos componentes de filtros para estatísticas
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Filter Bar */}
      <StatisticsFilterBar
        onFiltersChange={handleFiltersChange}
        onReset={handleReset}
        showPresets={true}
        disabled={isLoading}
      />

      {/* Current Filters Display */}
      {filters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconFilter className="h-4 w-4" />
              Filtros Aplicados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Period Info */}
              <div>
                <div className="text-sm font-medium mb-2">Período</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {filters.period === 'custom' ? 'Personalizado' :
                     filters.period === 'day' ? 'Dia' :
                     filters.period === 'week' ? 'Semana' :
                     filters.period === 'month' ? 'Mês' :
                     filters.period === 'quarter' ? 'Trimestre' :
                     filters.period === 'year' ? 'Ano' : filters.period}
                  </Badge>
                  {filters.dateRange?.from && filters.dateRange?.to && (
                    <span className="text-sm text-muted-foreground">
                      {filters.dateRange.from.toLocaleDateString('pt-BR')} - {filters.dateRange.to.toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Grouping and Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-2">Agrupamento</div>
                  <Badge variant="secondary">
                    {filters.groupBy === 'category' ? 'Categoria' :
                     filters.groupBy === 'brand' ? 'Marca' :
                     filters.groupBy === 'supplier' ? 'Fornecedor' :
                     filters.groupBy === 'user' ? 'Usuário' :
                     filters.groupBy === 'sector' ? 'Setor' :
                     filters.groupBy === 'month' ? 'Mês' :
                     filters.groupBy === 'week' ? 'Semana' : filters.groupBy}
                  </Badge>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Métricas</div>
                  <div className="flex flex-wrap gap-1">
                    {filters.metrics.map((metric) => (
                      <Badge key={metric} variant="outline">
                        {metric === 'totalValue' ? 'Valor Total' :
                         metric === 'totalItems' ? 'Total de Itens' :
                         metric === 'averageValue' ? 'Valor Médio' :
                         metric === 'stockLevel' ? 'Nível de Estoque' :
                         metric === 'turnoverRate' ? 'Taxa de Rotatividade' :
                         metric === 'activities' ? 'Atividades' : metric}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Display Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm font-medium mb-2">Tipo de Gráfico</div>
                  <Badge variant="secondary">
                    {filters.chartType === 'bar' ? 'Barras' :
                     filters.chartType === 'line' ? 'Linhas' :
                     filters.chartType === 'area' ? 'Área' :
                     filters.chartType === 'pie' ? 'Pizza' :
                     filters.chartType === 'donut' ? 'Rosca' : filters.chartType}
                  </Badge>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Agregação</div>
                  <Badge variant="outline">
                    {filters.aggregationType === 'sum' ? 'Soma' :
                     filters.aggregationType === 'average' ? 'Média' :
                     filters.aggregationType === 'count' ? 'Contagem' :
                     filters.aggregationType === 'min' ? 'Mínimo' :
                     filters.aggregationType === 'max' ? 'Máximo' : filters.aggregationType}
                  </Badge>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Comparação</div>
                  <Badge variant={filters.compareWith !== 'none' ? 'default' : 'secondary'}>
                    {filters.compareWith === 'none' ? 'Nenhuma' :
                     filters.compareWith === 'previous-period' ? 'Período Anterior' :
                     filters.compareWith === 'previous-year' ? 'Ano Anterior' : filters.compareWith}
                  </Badge>
                </div>
              </div>

              {/* Additional Options */}
              {(filters.showTrends || filters.showLabels || filters.showValues || filters.showPercentages) && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm font-medium mb-2">Opções de Exibição</div>
                    <div className="flex flex-wrap gap-1">
                      {filters.showTrends && <Badge variant="outline">Tendências</Badge>}
                      {filters.showLabels && <Badge variant="outline">Rótulos</Badge>}
                      {filters.showValues && <Badge variant="outline">Valores</Badge>}
                      {filters.showPercentages && <Badge variant="outline">Percentuais</Badge>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mock Chart Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <IconSettings className="h-4 w-4" />
            Área do Gráfico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted/50 rounded-md flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              {isLoading ? (
                <div className="space-y-2">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                  <div>Carregando dados...</div>
                </div>
              ) : filters ? (
                <div className="space-y-2">
                  <IconChartBar className="h-12 w-12 mx-auto" />
                  <div>Gráfico seria renderizado aqui</div>
                  <div className="text-xs">
                    Tipo: {filters.chartType} | Agrupado por: {filters.groupBy}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <IconFilter className="h-12 w-12 mx-auto" />
                  <div>Configure os filtros para visualizar os dados</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Como Usar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground space-y-2">
            <div>• <strong>Período:</strong> Use o seletor de período para datas rápidas ou escolha um período personalizado</div>
            <div>• <strong>Presets:</strong> Clique no botão de presets para aplicar configurações pré-definidas</div>
            <div>• <strong>Avançado:</strong> Abra as opções avançadas para comparações e configurações de visualização</div>
            <div>• <strong>Estado Persistente:</strong> Suas configurações são salvas automaticamente no navegador</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}