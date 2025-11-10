import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconX, IconGripVertical } from "@tabler/icons-react";
import { FilterCondition as FilterConditionType, FilterFieldDefinition, FilterOperator } from "@/utils/table-filter-utils";
import { cn } from "@/lib/utils";

export interface FilterConditionProps {
  condition: FilterConditionType;
  fields: Record<string, FilterFieldDefinition>;
  onUpdate: (updates: Partial<FilterConditionType>) => void;
  onRemove: () => void;
  operators: FilterOperator[];
  className?: string;
  showDragHandle?: boolean;
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "é igual a",
  notEquals: "é diferente de",
  contains: "contém",
  startsWith: "começa com",
  endsWith: "termina com",
  greaterThan: "é maior que",
  greaterThanOrEqual: "é maior ou igual a",
  lessThan: "é menor que",
  lessThanOrEqual: "é menor ou igual a",
  between: "está entre",
  in: "está em",
  notIn: "não está em",
  isEmpty: "está vazio",
  isNotEmpty: "não está vazio",
};

export function FilterCondition({
  condition,
  fields,
  onUpdate,
  onRemove,
  operators,
  className,
  showDragHandle = false,
}: FilterConditionProps) {
  const currentField = fields[condition.field];

  const renderValueInput = () => {
    // Skip value input for isEmpty/isNotEmpty operators
    if (condition.operator === "isEmpty" || condition.operator === "isNotEmpty") {
      return null;
    }

    if (!currentField) return null;

    // Between operator needs two inputs
    if (condition.operator === "between") {
      if (currentField.dataType === "number" || currentField.dataType === "range") {
        return (
          <div className="flex gap-2 flex-1">
            <Input
              type="number"
              placeholder="Mínimo"
              value={condition.value?.min || ""}
              onChange={(e) => onUpdate({
                value: { ...condition.value, min: Number(e.target.value) }
              })}
            />
            <Input
              type="number"
              placeholder="Máximo"
              value={condition.value?.max || ""}
              onChange={(e) => onUpdate({
                value: { ...condition.value, max: Number(e.target.value) }
              })}
            />
          </div>
        );
      }

      if (currentField.dataType === "date" || currentField.dataType === "dateRange") {
        return (
          <div className="flex gap-2 flex-1">
            <Input
              type="date"
              placeholder="De"
              value={condition.value?.gte instanceof Date ? condition.value.gte.toISOString().split('T')[0] : condition.value?.gte || ""}
              onChange={(e) => onUpdate({
                value: { ...condition.value, gte: new Date(e.target.value) }
              })}
            />
            <Input
              type="date"
              placeholder="Até"
              value={condition.value?.lte instanceof Date ? condition.value.lte.toISOString().split('T')[0] : condition.value?.lte || ""}
              onChange={(e) => onUpdate({
                value: { ...condition.value, lte: new Date(e.target.value) }
              })}
            />
          </div>
        );
      }
    }

    // Select field with options
    if (currentField.dataType === "select" && currentField.options) {
      return (
        <Select
          value={String(condition.value || "")}
          onValueChange={(value) => onUpdate({ value })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {currentField.options.map((option) => (
              <SelectItem key={String(option.value)} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Boolean field
    if (currentField.dataType === "boolean") {
      return (
        <Select
          value={String(condition.value)}
          onValueChange={(value) => onUpdate({ value: value === "true" })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Sim</SelectItem>
            <SelectItem value="false">Não</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // Date field
    if (currentField.dataType === "date") {
      return (
        <Input
          type="date"
          className="flex-1"
          value={condition.value instanceof Date ? condition.value.toISOString().split('T')[0] : condition.value || ""}
          onChange={(e) => onUpdate({ value: new Date(e.target.value) })}
        />
      );
    }

    // Number field
    if (currentField.dataType === "number") {
      return (
        <Input
          type="number"
          className="flex-1"
          placeholder="Digite o valor..."
          value={condition.value || ""}
          onChange={(e) => onUpdate({ value: Number(e.target.value) })}
        />
      );
    }

    // Default: string input
    return (
      <Input
        type="text"
        className="flex-1"
        placeholder="Digite o valor..."
        value={condition.value || ""}
        onChange={(e) => onUpdate({ value: e.target.value })}
      />
    );
  };

  return (
    <div className={cn("flex items-center gap-2 p-3 border rounded-lg bg-muted/20", className)}>
      {showDragHandle && (
        <IconGripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
      )}

      {/* Field selector */}
      <Select
        value={condition.field}
        onValueChange={(field) => {
          const newField = fields[field];
          onUpdate({
            field,
            dataType: newField.dataType,
            operator: newField.operators[0],
            value: "",
          });
        }}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.values(fields).map((field) => (
            <SelectItem key={field.key} value={field.key}>
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select
        value={condition.operator}
        onValueChange={(operator) => onUpdate({ operator: operator as FilterOperator })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((operator) => (
            <SelectItem key={operator} value={operator}>
              {OPERATOR_LABELS[operator]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {renderValueInput()}

      {/* Remove button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={onRemove}
        className="shrink-0"
      >
        <IconX className="h-4 w-4" />
      </Button>
    </div>
  );
}
