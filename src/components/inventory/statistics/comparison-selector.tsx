import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconTrendingUp, IconCompare, IconCalendar } from "@tabler/icons-react";

export type ComparisonType = 'previous-period' | 'previous-year' | 'none';

interface ComparisonSelectorProps {
  compareWith?: ComparisonType;
  showTrends?: boolean;
  onChange: (compareWith: ComparisonType, showTrends: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const COMPARISON_OPTIONS = [
  {
    value: 'none' as ComparisonType,
    label: 'Sem comparação',
    description: 'Exibir apenas os dados do período selecionado',
    icon: IconCalendar,
  },
  {
    value: 'previous-period' as ComparisonType,
    label: 'Período anterior',
    description: 'Comparar com o período imediatamente anterior',
    icon: IconCompare,
  },
  {
    value: 'previous-year' as ComparisonType,
    label: 'Mesmo período do ano anterior',
    description: 'Comparar com o mesmo período do ano passado',
    icon: IconTrendingUp,
  },
];

export function ComparisonSelector({
  compareWith = 'none',
  showTrends = false,
  onChange,
  disabled = false,
  className,
}: ComparisonSelectorProps) {
  const handleComparisonChange = (value: string) => {
    onChange(value as ComparisonType, showTrends);
  };

  const handleTrendsChange = (checked: boolean) => {
    onChange(compareWith, checked);
  };

  const selectedOption = COMPARISON_OPTIONS.find(option => option.value === compareWith);

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <IconCompare className="h-4 w-4" />
          Comparações e Tendências
        </CardTitle>
        <CardDescription>
          Configure como os dados serão comparados e se as tendências devem ser exibidas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comparison Type Selector */}
        <div className="space-y-2">
          <Label htmlFor="comparison-type">Tipo de Comparação</Label>
          <Select
            value={compareWith}
            onValueChange={handleComparisonChange}
            disabled={disabled}
          >
            <SelectTrigger id="comparison-type">
              <SelectValue placeholder="Selecionar tipo de comparação" />
            </SelectTrigger>
            <SelectContent>
              {COMPARISON_OPTIONS.map((option) => {
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
        </div>

        {/* Comparison Description */}
        {selectedOption && selectedOption.value !== 'none' && (
          <div className="p-3 bg-muted/50 rounded-md">
            <div className="flex items-start gap-2">
              <selectedOption.icon className="h-4 w-4 mt-0.5 text-primary" />
              <div className="text-sm">
                <div className="font-medium text-foreground">
                  {selectedOption.label}
                </div>
                <div className="text-muted-foreground mt-1">
                  {selectedOption.description}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show Trends Toggle */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="show-trends" className="text-sm font-medium">
              Exibir Tendências
            </Label>
            <div className="text-xs text-muted-foreground">
              Mostrar linhas de tendência e indicadores de crescimento
            </div>
          </div>
          <Switch
            id="show-trends"
            checked={showTrends}
            onCheckedChange={handleTrendsChange}
            disabled={disabled}
          />
        </div>

        {/* Trends Description */}
        {showTrends && (
          <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
            <div className="flex items-start gap-2">
              <IconTrendingUp className="h-4 w-4 mt-0.5 text-primary" />
              <div className="text-sm">
                <div className="font-medium text-primary">
                  Tendências Ativadas
                </div>
                <div className="text-muted-foreground mt-1">
                  Os gráficos irão exibir linhas de tendência, percentuais de crescimento
                  e indicadores visuais de direção dos dados.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Examples */}
        {compareWith !== 'none' && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Exemplos de Comparação</Label>
            <div className="text-xs text-muted-foreground space-y-1">
              {compareWith === 'previous-period' && (
                <>
                  <div>• Se o período for "Este mês", será comparado com o mês anterior</div>
                  <div>• Se o período for "Esta semana", será comparado com a semana anterior</div>
                  <div>• Para períodos personalizados, será usado um período de igual duração anterior</div>
                </>
              )}
              {compareWith === 'previous-year' && (
                <>
                  <div>• Se o período for "Janeiro 2024", será comparado com "Janeiro 2023"</div>
                  <div>• Se o período for "Q1 2024", será comparado com "Q1 2023"</div>
                  <div>• Para períodos personalizados, será usado o mesmo período do ano anterior</div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}