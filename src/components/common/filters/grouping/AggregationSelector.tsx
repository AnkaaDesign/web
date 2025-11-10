import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AggregationFunction = "sum" | "avg" | "count" | "min" | "max" | "first" | "last";

export interface Aggregation {
  id: string;
  field: string;
  function: AggregationFunction;
  displayFormat?: "number" | "currency" | "percentage";
  label?: string;
}

export interface AggregationField {
  field: string;
  label: string;
  dataType?: "string" | "number" | "date" | "boolean";
  allowedFunctions?: AggregationFunction[];
}

export interface AggregationSelectorProps {
  value: Aggregation[];
  onChange: (value: Aggregation[]) => void;
  availableFields: AggregationField[];
  className?: string;
}

const FUNCTION_LABELS: Record<AggregationFunction, string> = {
  sum: "Soma",
  avg: "Média",
  count: "Contagem",
  min: "Mínimo",
  max: "Máximo",
  first: "Primeiro",
  last: "Último",
};

const DEFAULT_FUNCTIONS_BY_TYPE: Record<string, AggregationFunction[]> = {
  number: ["sum", "avg", "count", "min", "max"],
  string: ["count", "first", "last"],
  date: ["count", "min", "max", "first", "last"],
  boolean: ["count"],
};

export function AggregationSelector({
  value,
  onChange,
  availableFields,
  className,
}: AggregationSelectorProps) {
  const addAggregation = () => {
    const newAgg: Aggregation = {
      id: `agg-${Date.now()}`,
      field: availableFields[0]?.field || "",
      function: "count",
      displayFormat: "number",
    };
    onChange([...value, newAgg]);
  };

  const removeAggregation = (id: string) => {
    onChange(value.filter((agg) => agg.id !== id));
  };

  const updateAggregation = (id: string, updates: Partial<Aggregation>) => {
    onChange(value.map((agg) => (agg.id === id ? { ...agg, ...updates } : agg)));
  };

  const getAvailableFunctions = (field: string): AggregationFunction[] => {
    const fieldDef = availableFields.find((f) => f.field === field);
    if (fieldDef?.allowedFunctions) {
      return fieldDef.allowedFunctions;
    }
    return DEFAULT_FUNCTIONS_BY_TYPE[fieldDef?.dataType || "string"];
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        {value.map((aggregation) => {
          const fieldDef = availableFields.find((f) => f.field === aggregation.field);
          const functions = getAvailableFunctions(aggregation.field);

          return (
            <Card key={aggregation.id}>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Campo</Label>
                    <Select
                      value={aggregation.field}
                      onValueChange={(field) => {
                        const newFunctions = getAvailableFunctions(field);
                        updateAggregation(aggregation.id, {
                          field,
                          function: newFunctions[0],
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields.map((field) => (
                          <SelectItem key={field.field} value={field.field}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Função</Label>
                    <Select
                      value={aggregation.function}
                      onValueChange={(func) =>
                        updateAggregation(aggregation.id, { function: func as AggregationFunction })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {functions.map((func) => (
                          <SelectItem key={func} value={func}>
                            {FUNCTION_LABELS[func]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Formato</Label>
                    <Select
                      value={aggregation.displayFormat || "number"}
                      onValueChange={(format) =>
                        updateAggregation(aggregation.id, {
                          displayFormat: format as "number" | "currency" | "percentage",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Número</SelectItem>
                        <SelectItem value="currency">Moeda</SelectItem>
                        <SelectItem value="percentage">Porcentagem</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
