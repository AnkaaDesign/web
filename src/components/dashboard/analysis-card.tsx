import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface AnalysisData {
  label: string;
  value: number;
  percentage: number;
  info?: string;
  color: string;
}

interface AnalysisCardProps {
  title: string;
  type: "ABC" | "XYZ" | "custom" | "SERVICE" | "PROCESS" | "PERFORMANCE" | "COLOR" | "COMPLEXITY" | "REVENUE";
  data: AnalysisData[];
  icon: LucideIcon;
  className?: string;
  onDetailsClick?: () => void;
}

export function AnalysisCard({ title, type, data, icon: Icon, className, onDetailsClick }: AnalysisCardProps) {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className={cn("hover:shadow-sm transition-shadow", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
        </div>

        <div>
          {/* Visual Bar */}
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1">
              {type === "ABC" ? "Distribuição de Valor" : type === "XYZ" ? "Análise de Rotatividade" : type === "SERVICE" ? "Distribuição de Serviços" : "Distribuição"}
            </p>
            <div className="flex h-8 rounded-lg overflow-hidden">
              {data.map((item, index) => (
                <div
                  key={index}
                  className={cn("flex items-center justify-center text-white font-medium", item.color)}
                  style={{ width: `${item.percentage}%` }}
                  title={`${item.info || item.label}: ${item.value} ${type === "SERVICE" ? "ordens" : "itens"}`}
                />
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-1 text-xs">
            {data.map((item, index) => (
              <div key={index} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded", item.color)} />
                  <span className="text-muted-foreground">
                    {type === "ABC"
                      ? `Classe ${item.label}`
                      : type === "XYZ"
                        ? `${item.label} - ${item.info}`
                        : type === "SERVICE"
                          ? item.label
                          : type === "PERFORMANCE"
                            ? item.label
                            : type === "COLOR"
                              ? item.label
                              : type === "COMPLEXITY"
                                ? `${item.label} - ${item.info}`
                                : type === "REVENUE"
                                  ? item.label
                                  : item.info || item.label}
                  </span>
                </div>
                <span className="font-medium">
                  {type === "PERFORMANCE"
                    ? item.info
                    : type === "SERVICE"
                      ? `${item.value} ordens`
                      : type === "COLOR"
                        ? `${item.value} cores`
                        : type === "COMPLEXITY"
                          ? `${item.value} fórmulas`
                          : type === "REVENUE"
                            ? item.info || `${item.value}`
                            : `${item.value} itens`}
                </span>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">
                {type === "PERFORMANCE"
                  ? `${totalValue} funcionários`
                  : type === "SERVICE"
                    ? `${totalValue} ordens`
                    : type === "COLOR"
                      ? `${totalValue} cores`
                      : type === "COMPLEXITY"
                        ? `${totalValue} fórmulas`
                        : type === "REVENUE"
                          ? data.reduce((sum, item) => {
                              const match = item.info?.match(/R\$\s?([\d.,]+)/);
                              const value = match ? parseFloat(match[1].replace(/\./g, '').replace(',', '.')) : 0;
                              return sum + value;
                            }, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : `${totalValue} itens`}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
