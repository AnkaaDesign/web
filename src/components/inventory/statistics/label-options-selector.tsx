import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { IconSettings, IconChartBar, IconChartLine, IconChartPie, IconChartArea, IconChartDonut, IconSum, IconTrendingUp, IconCalendar } from "@tabler/icons-react";

export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'donut';
export type AggregationType = 'sum' | 'average' | 'count' | 'min' | 'max';

interface LabelOptions {
  chartType?: ChartType;
  aggregationType?: AggregationType;
  showLabels?: boolean;
  showValues?: boolean;
  showPercentages?: boolean;
}

interface LabelOptionsSelectorProps {
  chartType?: ChartType;
  aggregationType?: AggregationType;
  showLabels?: boolean;
  showValues?: boolean;
  showPercentages?: boolean;
  onChange: (options: LabelOptions) => void;
  disabled?: boolean;
  className?: string;
}

const CHART_TYPE_OPTIONS = [
  {
    value: 'bar' as ChartType,
    label: 'Barras',
    description: 'Gráfico de barras verticais',
    icon: IconChartBar,
  },
  {
    value: 'line' as ChartType,
    label: 'Linhas',
    description: 'Gráfico de linhas conectadas',
    icon: IconChartLine,
  },
  {
    value: 'area' as ChartType,
    label: 'Área',
    description: 'Gráfico de área preenchida',
    icon: IconChartArea,
  },
  {
    value: 'pie' as ChartType,
    label: 'Pizza',
    description: 'Gráfico circular de setores',
    icon: IconChartPie,
  },
  {
    value: 'donut' as ChartType,
    label: 'Rosca',
    description: 'Gráfico circular com centro vazio',
    icon: IconChartDonut,
  },
];

const AGGREGATION_TYPE_OPTIONS = [
  {
    value: 'sum' as AggregationType,
    label: 'Soma',
    description: 'Somar todos os valores',
    icon: IconSum,
  },
  {
    value: 'average' as AggregationType,
    label: 'Média',
    description: 'Calcular a média dos valores',
    icon: IconTrendingUp,
  },
  {
    value: 'count' as AggregationType,
    label: 'Contagem',
    description: 'Contar o número de itens',
    icon: IconCalendar,
  },
  {
    value: 'min' as AggregationType,
    label: 'Mínimo',
    description: 'Valor mínimo encontrado',
    icon: IconTrendingUp,
  },
  {
    value: 'max' as AggregationType,
    label: 'Máximo',
    description: 'Valor máximo encontrado',
    icon: IconTrendingUp,
  },
];

export function LabelOptionsSelector({
  chartType = 'bar',
  aggregationType = 'sum',
  showLabels = true,
  showValues = true,
  showPercentages = false,
  onChange,
  disabled = false,
  className,
}: LabelOptionsSelectorProps) {
  const handleChartTypeChange = (value: string) => {
    onChange({ chartType: value as ChartType });
  };

  const handleAggregationTypeChange = (value: string) => {
    onChange({ aggregationType: value as AggregationType });
  };

  const handleLabelOptionChange = (option: keyof LabelOptions, value: boolean) => {
    onChange({ [option]: value });
  };

  const selectedChartType = CHART_TYPE_OPTIONS.find(option => option.value === chartType);
  const selectedAggregationType = AGGREGATION_TYPE_OPTIONS.find(option => option.value === aggregationType);

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <IconSettings className="h-4 w-4" />
          Opções de Visualização
        </CardTitle>
        <CardDescription>
          Configure o tipo de gráfico, agregação de dados e opções de exibição
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chart Type Selector */}
        <div className="space-y-2">
          <Label htmlFor="chart-type">Tipo de Gráfico</Label>
          <Select
            value={chartType}
            onValueChange={handleChartTypeChange}
            disabled={disabled}
          >
            <SelectTrigger id="chart-type">
              <SelectValue placeholder="Selecionar tipo de gráfico" />
            </SelectTrigger>
            <SelectContent>
              {CHART_TYPE_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-start gap-3 py-1">
                      <IconComponent className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Chart Type Description */}
          {selectedChartType && (
            <div className="p-3 bg-muted/50 rounded-md">
              <div className="flex items-start gap-2">
                <selectedChartType.icon className="h-4 w-4 mt-0.5 text-primary" />
                <div className="text-sm">
                  <div className="font-medium text-foreground">
                    {selectedChartType.label}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {selectedChartType.description}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Aggregation Type Selector */}
        <div className="space-y-2">
          <Label htmlFor="aggregation-type">Tipo de Agregação</Label>
          <Select
            value={aggregationType}
            onValueChange={handleAggregationTypeChange}
            disabled={disabled}
          >
            <SelectTrigger id="aggregation-type">
              <SelectValue placeholder="Selecionar tipo de agregação" />
            </SelectTrigger>
            <SelectContent>
              {AGGREGATION_TYPE_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-start gap-3 py-1">
                      <IconComponent className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Aggregation Type Description */}
          {selectedAggregationType && (
            <div className="p-3 bg-muted/50 rounded-md">
              <div className="flex items-start gap-2">
                <selectedAggregationType.icon className="h-4 w-4 mt-0.5 text-primary" />
                <div className="text-sm">
                  <div className="font-medium text-foreground">
                    {selectedAggregationType.label}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {selectedAggregationType.description}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Display Options */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Opções de Exibição</Label>

          {/* Show Labels */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="show-labels" className="text-sm font-medium">
                Mostrar Rótulos
              </Label>
              <div className="text-xs text-muted-foreground">
                Exibir nomes das categorias nos elementos do gráfico
              </div>
            </div>
            <Switch
              id="show-labels"
              checked={showLabels}
              onCheckedChange={(checked) => handleLabelOptionChange('showLabels', checked)}
              disabled={disabled}
            />
          </div>

          {/* Show Values */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="show-values" className="text-sm font-medium">
                Mostrar Valores
              </Label>
              <div className="text-xs text-muted-foreground">
                Exibir valores numéricos nos elementos do gráfico
              </div>
            </div>
            <Switch
              id="show-values"
              checked={showValues}
              onCheckedChange={(checked) => handleLabelOptionChange('showValues', checked)}
              disabled={disabled}
            />
          </div>

          {/* Show Percentages */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="show-percentages" className="text-sm font-medium">
                Mostrar Percentuais
              </Label>
              <div className="text-xs text-muted-foreground">
                Exibir percentuais relativos ao total
              </div>
            </div>
            <Switch
              id="show-percentages"
              checked={showPercentages}
              onCheckedChange={(checked) => handleLabelOptionChange('showPercentages', checked)}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Chart Type Recommendations */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
          <div className="text-sm">
            <div className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              Recomendações por Tipo de Gráfico
            </div>
            <div className="text-blue-700 dark:text-blue-200 space-y-1 text-xs">
              <div>• <strong>Barras:</strong> Ideal para comparar valores entre categorias</div>
              <div>• <strong>Linhas:</strong> Melhor para mostrar tendências ao longo do tempo</div>
              <div>• <strong>Área:</strong> Boa para mostrar volume e tendências combinados</div>
              <div>• <strong>Pizza/Rosca:</strong> Excelente para mostrar proporções do total</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}