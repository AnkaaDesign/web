import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconPlus, IconTrash, IconX, IconCheck } from "@tabler/icons-react";
import { FilterCondition } from "./FilterCondition";
import type {
  FilterDefinition,
  FilterFieldDefinition,
  FilterCondition as FilterConditionType,
} from "@/utils/table-filter-utils";
import {
  createFilterGroup,
  addConditionToGroup,
  removeConditionFromGroup,
  getValidOperatorsForDataType,
} from "@/utils/table-filter-utils";
import { cn } from "@/lib/utils";

export interface AdvancedFilterBuilderProps {
  definition: FilterDefinition;
  fields: Record<string, FilterFieldDefinition>;
  onChange: (definition: FilterDefinition) => void;
  onApply?: () => void;
  onCancel?: () => void;
  maxGroups?: number;
  maxConditionsPerGroup?: number;
  className?: string;
}

export function AdvancedFilterBuilder({
  definition,
  fields,
  onChange,
  onApply,
  onCancel,
  maxGroups = 5,
  maxConditionsPerGroup = 10,
  className,
}: AdvancedFilterBuilderProps) {
  const addGroup = () => {
    if (definition.groups.length >= maxGroups) return;

    onChange({
      ...definition,
      groups: [...definition.groups, createFilterGroup([], "AND")],
    });
  };

  const removeGroup = (groupIndex: number) => {
    const newGroups = definition.groups.filter((_, index) => index !== groupIndex);
    onChange({
      ...definition,
      groups: newGroups.length > 0 ? newGroups : [createFilterGroup([], "AND")],
    });
  };

  const updateGroupOperator = (groupIndex: number, operator: "AND" | "OR") => {
    const newGroups = [...definition.groups];
    newGroups[groupIndex] = { ...newGroups[groupIndex], operator };
    onChange({ ...definition, groups: newGroups });
  };

  const addCondition = (groupIndex: number) => {
    const group = definition.groups[groupIndex];
    if (group.conditions.length >= maxConditionsPerGroup) return;

    const firstFieldKey = Object.keys(fields)[0];
    if (!firstFieldKey) return;

    const firstField = fields[firstFieldKey];
    const operators = getValidOperatorsForDataType(firstField.dataType);

    const newCondition: FilterConditionType = {
      field: firstFieldKey,
      operator: operators[0],
      value: "",
      dataType: firstField.dataType,
    };

    const newGroups = [...definition.groups];
    newGroups[groupIndex] = addConditionToGroup(group, newCondition);
    onChange({ ...definition, groups: newGroups });
  };

  const removeCondition = (groupIndex: number, conditionIndex: number) => {
    const group = definition.groups[groupIndex];
    const newGroups = [...definition.groups];
    newGroups[groupIndex] = removeConditionFromGroup(group, conditionIndex);
    onChange({ ...definition, groups: newGroups });
  };

  const updateCondition = (
    groupIndex: number,
    conditionIndex: number,
    updates: Partial<FilterConditionType>
  ) => {
    const newGroups = [...definition.groups];
    const condition = { ...newGroups[groupIndex].conditions[conditionIndex], ...updates };
    newGroups[groupIndex].conditions[conditionIndex] = condition;
    onChange({ ...definition, groups: newGroups });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {definition.groups.map((group, groupIndex) => (
        <Card key={groupIndex}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Grupo {groupIndex + 1}
                <Select
                  value={group.operator}
                  onValueChange={(value: "AND" | "OR") => updateGroupOperator(groupIndex, value)}
                >
                  <SelectTrigger className="w-[80px] h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">E</SelectItem>
                    <SelectItem value="OR">OU</SelectItem>
                  </SelectContent>
                </Select>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addCondition(groupIndex)}
                  disabled={group.conditions.length >= maxConditionsPerGroup}
                >
                  <IconPlus className="h-4 w-4 mr-1" />
                  Condição
                </Button>
                {definition.groups.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeGroup(groupIndex)}
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.conditions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma condição definida</p>
                <p className="text-sm">Clique em "Condição" para adicionar</p>
              </div>
            ) : (
              group.conditions.map((condition, conditionIndex) => (
                <FilterCondition
                  key={conditionIndex}
                  condition={condition}
                  fields={fields}
                  operators={getValidOperatorsForDataType(condition.dataType)}
                  onUpdate={(updates) => updateCondition(groupIndex, conditionIndex, updates)}
                  onRemove={() => removeCondition(groupIndex, conditionIndex)}
                />
              ))
            )}
          </CardContent>
        </Card>
      ))}

      {definition.groups.length < maxGroups && (
        <Button variant="outline" onClick={addGroup} className="w-full">
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar Grupo
        </Button>
      )}

      {(onApply || onCancel) && (
        <div className="flex gap-2 justify-end">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              <IconX className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          )}
          {onApply && (
            <Button onClick={onApply}>
              <IconCheck className="mr-2 h-4 w-4" />
              Aplicar Filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
