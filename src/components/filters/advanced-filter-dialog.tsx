import { useState, useCallback, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IconFilter,
  IconX,
  IconPlus,
  IconSave,
  IconTrash,
  IconEdit,
  IconCopy,
  IconSettings,
  IconSearch,
  IconCalendar,
  IconHash,
  IconToggleLeft,
  IconList,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  FilterDefinition,
  FilterGroup,
  FilterCondition,
  FilterFieldDefinition,
  FilterDataType,
  FilterOperator,
  createFilterGroup,
  createFilterPreset,
  addConditionToGroup,
  removeConditionFromGroup,
  validateFilterCondition,
  getValidOperatorsForDataType,
  sanitizeFilterValue,
  isFilterDefinitionEmpty,
  getFilterSummary,
  StringFilterBuilder,
  NumberFilterBuilder,
  DateFilterBuilder,
  BooleanFilterBuilder,
  SelectFilterBuilder,
  LocalStorageFilterPresets,
  type FilterPresetStorage,
} from "@/utils/table-filter-utils";
import { FilterAutocomplete, type FilterSuggestion, type SuggestionProvider } from "./filter-autocomplete";

/**
 * Props for the AdvancedFilterDialog component
 */
export interface AdvancedFilterDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback when dialog open state changes
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Available fields for filtering
   */
  fields: Record<string, FilterFieldDefinition>;

  /**
   * Current filter definition
   */
  value?: FilterDefinition;

  /**
   * Callback when filter definition changes
   */
  onValueChange?: (definition: FilterDefinition) => void;

  /**
   * Callback when filters are applied
   */
  onApply?: (definition: FilterDefinition) => void;

  /**
   * Dialog title
   */
  title?: string;

  /**
   * Dialog description
   */
  description?: string;

  /**
   * Allow saving filter presets
   */
  allowPresets?: boolean;

  /**
   * Preset storage implementation
   */
  presetStorage?: FilterPresetStorage;

  /**
   * Current user ID for preset management
   */
  userId?: string;

  /**
   * Suggestion providers for filter values
   */
  suggestionProviders?: Record<string, SuggestionProvider>;

  /**
   * Custom operators for specific fields
   */
  customOperators?: Record<string, FilterOperator[]>;

  /**
   * Maximum number of filter groups
   */
  maxGroups?: number;

  /**
   * Maximum number of conditions per group
   */
  maxConditionsPerGroup?: number;

  /**
   * Show advanced features
   */
  showAdvanced?: boolean;

  /**
   * Enable real-time validation
   */
  enableValidation?: boolean;

  /**
   * Custom validation messages
   */
  validationMessages?: Record<string, string>;
}

/**
 * Advanced filter dialog component
 *
 * Features:
 * - Visual filter builder with groups and conditions
 * - Support for complex logical operations (AND/OR)
 * - Real-time validation
 * - Filter presets with save/load functionality
 * - Autocomplete suggestions for filter values
 * - Import/export capabilities
 * - Responsive design
 * - Type-safe field definitions
 *
 * @example
 * ```tsx
 * <AdvancedFilterDialog
 *   open={showFilters}
 *   onOpenChange={setShowFilters}
 *   fields={{
 *     name: {
 *       key: 'name',
 *       label: 'Nome',
 *       dataType: 'string',
 *       operators: ['contains', 'equals', 'startsWith']
 *     },
 *     status: {
 *       key: 'status',
 *       label: 'Status',
 *       dataType: 'select',
 *       operators: ['equals', 'in'],
 *       options: [
 *         { value: 'ACTIVE', label: 'Ativo' },
 *         { value: 'INACTIVE', label: 'Inativo' }
 *       ]
 *     }
 *   }}
 *   suggestionProviders={{
 *     categoryId: async (query) => {
 *       const categories = await fetchCategories({ search: query });
 *       return categories.map(c => ({
 *         id: c.id,
 *         label: c.name,
 *         value: c.id
 *       }));
 *     }
 *   }}
 *   onApply={(definition) => {
 *     const query = convertFilterDefinitionToQuery(definition);
 *     setFilters(query);
 *   }}
 * />
 * ```
 */
export function AdvancedFilterDialog({
  open,
  onOpenChange,
  fields,
  value,
  onValueChange,
  onApply,
  title = "Filtros Avançados",
  description = "Configure filtros complexos para refinar sua pesquisa",
  allowPresets = true,
  presetStorage = new LocalStorageFilterPresets(),
  userId,
  suggestionProviders = {},
  customOperators = {},
  maxGroups = 5,
  maxConditionsPerGroup = 10,
  showAdvanced = true,
  enableValidation = true,
  validationMessages = {},
}: AdvancedFilterDialogProps) {
  // Local state for building filters
  const [filterDefinition, setFilterDefinition] = useState<FilterDefinition>(() => ({
    id: "",
    name: "",
    groups: [createFilterGroup([], "AND")],
  }));

  // Preset management
  const [presets, setPresets] = useState<FilterDefinition[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [showPresetSave, setShowPresetSave] = useState(false);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

  // Load initial value
  useEffect(() => {
    if (value) {
      setFilterDefinition(value);
    } else {
      setFilterDefinition({
        id: "",
        name: "",
        groups: [createFilterGroup([], "AND")],
      });
    }
  }, [value]);

  // Load presets
  useEffect(() => {
    if (allowPresets && open) {
      presetStorage.loadPresets(userId).then(setPresets);
    }
  }, [allowPresets, open, presetStorage, userId]);

  // Field options
  const fieldOptions = useMemo(() => {
    return Object.values(fields).map((field) => ({
      value: field.key,
      label: field.label,
    }));
  }, [fields]);

  // Get operators for a field
  const getOperatorsForField = useCallback(
    (fieldKey: string): FilterOperator[] => {
      const field = fields[fieldKey];
      if (!field) return [];

      // Use custom operators if provided
      if (customOperators[fieldKey]) {
        return customOperators[fieldKey];
      }

      // Use field-specific operators
      if (field.operators) {
        return field.operators;
      }

      // Fall back to data type operators
      return getValidOperatorsForDataType(field.dataType);
    },
    [fields, customOperators],
  );

  // Get operator label
  const getOperatorLabel = useCallback((operator: FilterOperator): string => {
    const labels: Record<FilterOperator, string> = {
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
    return labels[operator] || operator;
  }, []);

  // Validate filter definition
  const validateDefinition = useCallback(
    (definition: FilterDefinition) => {
      if (!enableValidation) return {};

      const errors: Record<string, string[]> = {};

      definition.groups.forEach((group, groupIndex) => {
        group.conditions.forEach((condition, conditionIndex) => {
          const field = fields[condition.field];
          const result = validateFilterCondition(condition, field);

          if (!result.valid) {
            const key = `group_${groupIndex}_condition_${conditionIndex}`;
            errors[key] = result.errors;
          }
        });
      });

      return errors;
    },
    [enableValidation, fields],
  );

  // Update validation on definition change
  useEffect(() => {
    const errors = validateDefinition(filterDefinition);
    setValidationErrors(errors);
  }, [filterDefinition, validateDefinition]);

  // Add new group
  const addGroup = useCallback(() => {
    if (filterDefinition.groups.length >= maxGroups) {
      toast({
        title: "Limite atingido",
        description: `Máximo de ${maxGroups} grupos permitido`,
        variant: "destructive",
      });
      return;
    }

    const newDefinition = {
      ...filterDefinition,
      groups: [...filterDefinition.groups, createFilterGroup([], "AND")],
    };

    setFilterDefinition(newDefinition);
    onValueChange?.(newDefinition);
  }, [filterDefinition, maxGroups, onValueChange]);

  // Remove group
  const removeGroup = useCallback(
    (groupIndex: number) => {
      const newGroups = filterDefinition.groups.filter((_, index) => index !== groupIndex);
      const newDefinition = {
        ...filterDefinition,
        groups: newGroups.length > 0 ? newGroups : [createFilterGroup([], "AND")],
      };

      setFilterDefinition(newDefinition);
      onValueChange?.(newDefinition);
    },
    [filterDefinition, onValueChange],
  );

  // Update group operator
  const updateGroupOperator = useCallback(
    (groupIndex: number, operator: "AND" | "OR") => {
      const newGroups = [...filterDefinition.groups];
      newGroups[groupIndex] = { ...newGroups[groupIndex], operator };

      const newDefinition = { ...filterDefinition, groups: newGroups };
      setFilterDefinition(newDefinition);
      onValueChange?.(newDefinition);
    },
    [filterDefinition, onValueChange],
  );

  // Add condition to group
  const addCondition = useCallback(
    (groupIndex: number) => {
      const group = filterDefinition.groups[groupIndex];
      if (group.conditions.length >= maxConditionsPerGroup) {
        toast({
          title: "Limite atingido",
          description: `Máximo de ${maxConditionsPerGroup} condições por grupo`,
          variant: "destructive",
        });
        return;
      }

      const firstField = Object.keys(fields)[0];
      if (!firstField) return;

      const field = fields[firstField];
      const operators = getOperatorsForField(firstField);
      const operator = operators[0];

      if (!operator) return;

      const newCondition: FilterCondition = {
        field: firstField,
        operator,
        value: "",
        dataType: field.dataType,
      };

      const newGroups = [...filterDefinition.groups];
      newGroups[groupIndex] = addConditionToGroup(group, newCondition);

      const newDefinition = { ...filterDefinition, groups: newGroups };
      setFilterDefinition(newDefinition);
      onValueChange?.(newDefinition);
    },
    [filterDefinition, fields, getOperatorsForField, maxConditionsPerGroup, onValueChange],
  );

  // Remove condition from group
  const removeCondition = useCallback(
    (groupIndex: number, conditionIndex: number) => {
      const group = filterDefinition.groups[groupIndex];
      const newGroups = [...filterDefinition.groups];
      newGroups[groupIndex] = removeConditionFromGroup(group, conditionIndex);

      const newDefinition = { ...filterDefinition, groups: newGroups };
      setFilterDefinition(newDefinition);
      onValueChange?.(newDefinition);
    },
    [filterDefinition, onValueChange],
  );

  // Update condition
  const updateCondition = useCallback(
    (groupIndex: number, conditionIndex: number, updates: Partial<FilterCondition>) => {
      const newGroups = [...filterDefinition.groups];
      const condition = { ...newGroups[groupIndex].conditions[conditionIndex], ...updates };

      // Sanitize value if data type changed
      if (updates.dataType || updates.value !== undefined) {
        const field = fields[condition.field];
        if (field) {
          condition.value = sanitizeFilterValue(condition.value, field.dataType);
        }
      }

      newGroups[groupIndex].conditions[conditionIndex] = condition;

      const newDefinition = { ...filterDefinition, groups: newGroups };
      setFilterDefinition(newDefinition);
      onValueChange?.(newDefinition);
    },
    [filterDefinition, fields, onValueChange],
  );

  // Apply filters
  const handleApply = useCallback(() => {
    const errors = validateDefinition(filterDefinition);
    if (Object.keys(errors).length > 0) {
      toast({
        title: "Erro de validação",
        description: "Corrija os erros antes de aplicar os filtros",
        variant: "destructive",
      });
      return;
    }

    onApply?.(filterDefinition);
    onOpenChange(false);
  }, [filterDefinition, validateDefinition, onApply, onOpenChange]);

  // Save preset
  const handleSavePreset = useCallback(async () => {
    if (!presetName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para o preset",
        variant: "destructive",
      });
      return;
    }

    const preset = createFilterPreset(presetName.trim(), filterDefinition.groups, {
      description: getFilterSummary(filterDefinition),
      createdBy: userId,
    });

    try {
      await presetStorage.savePreset(preset);
      setPresets(await presetStorage.loadPresets(userId));
      setPresetName("");
      setShowPresetSave(false);
      toast({
        title: "Preset salvo",
        description: `Preset "${preset.name}" foi salvo com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o preset",
        variant: "destructive",
      });
    }
  }, [presetName, filterDefinition, userId, presetStorage]);

  // Load preset
  const handleLoadPreset = useCallback(
    async (presetId: string) => {
      try {
        const preset = await presetStorage.loadPreset(presetId);
        if (preset) {
          setFilterDefinition(preset);
          onValueChange?.(preset);
          setSelectedPreset(presetId);
        }
      } catch (error) {
        toast({
          title: "Erro ao carregar",
          description: "Não foi possível carregar o preset",
          variant: "destructive",
        });
      }
    },
    [presetStorage, onValueChange],
  );

  // Delete preset
  const handleDeletePreset = useCallback(
    async (presetId: string) => {
      try {
        await presetStorage.deletePreset(presetId);
        setPresets(await presetStorage.loadPresets(userId));
        if (selectedPreset === presetId) {
          setSelectedPreset(null);
        }
        toast({
          title: "Preset removido",
          description: "Preset foi removido com sucesso",
        });
      } catch (error) {
        toast({
          title: "Erro ao remover",
          description: "Não foi possível remover o preset",
          variant: "destructive",
        });
      }
    },
    [presetStorage, userId, selectedPreset],
  );

  // Clear all filters
  const handleClear = useCallback(() => {
    const newDefinition = {
      id: "",
      name: "",
      groups: [createFilterGroup([], "AND")],
    };
    setFilterDefinition(newDefinition);
    onValueChange?.(newDefinition);
    setSelectedPreset(null);
  }, [onValueChange]);

  // Render condition value input
  const renderConditionValue = useCallback(
    (condition: FilterCondition, groupIndex: number, conditionIndex: number) => {
      const field = fields[condition.field];
      if (!field) return null;

      const errorKey = `group_${groupIndex}_condition_${conditionIndex}`;
      const hasError = validationErrors[errorKey]?.length > 0;

      // Skip value input for isEmpty/isNotEmpty operators
      if (condition.operator === "isEmpty" || condition.operator === "isNotEmpty") {
        return null;
      }

      const updateValue = (value: any) => {
        updateCondition(groupIndex, conditionIndex, { value });
      };

      // Render based on data type
      switch (field.dataType) {
        case "string":
          return (
            <Input value={condition.value || ""} onChange={(e) => updateValue(e.target.value)} placeholder="Digite o valor..." className={cn(hasError && "border-destructive")} />
          );

        case "number":
          return (
            <Input
              type="number"
              value={condition.value || ""}
              onChange={(e) => updateValue(Number(e.target.value))}
              placeholder="Digite o número..."
              className={cn(hasError && "border-destructive")}
            />
          );

        case "boolean":
          return (
            <Select value={String(condition.value)} onValueChange={(value) => updateValue(value === "true")}>
              <SelectTrigger className={cn(hasError && "border-destructive")}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Não</SelectItem>
              </SelectContent>
            </Select>
          );

        case "select":
        case "multiSelect":
          if (field.options) {
            if (condition.operator === "in" || condition.operator === "notIn") {
              // Multi-select
              return (
                <FilterAutocomplete
                  value={Array.isArray(condition.value) ? condition.value : []}
                  onValueChange={updateValue}
                  placeholder="Selecione valores..."
                  staticSuggestions={field.options.map((opt) => ({
                    id: String(opt.value),
                    label: opt.label,
                    value: opt.value,
                  }))}
                  getSuggestions={async () => []}
                  multiple
                  className={cn(hasError && "border-destructive")}
                />
              );
            } else {
              // Single select
              return (
                <Select value={condition.value} onValueChange={updateValue}>
                  <SelectTrigger className={cn(hasError && "border-destructive")}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={String(option.value)} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }
          }

          // Use autocomplete if suggestion provider is available
          const suggestionProvider = suggestionProviders[condition.field];
          if (suggestionProvider) {
            return (
              <FilterAutocomplete
                value={Array.isArray(condition.value) ? condition.value : condition.value ? [condition.value] : []}
                onValueChange={(values) => {
                  if (condition.operator === "in" || condition.operator === "notIn") {
                    updateValue(values);
                  } else {
                    updateValue(values[0]);
                  }
                }}
                placeholder="Buscar valores..."
                getSuggestions={suggestionProvider}
                multiple={condition.operator === "in" || condition.operator === "notIn"}
                className={cn(hasError && "border-destructive")}
              />
            );
          }

          return (
            <Input value={condition.value || ""} onChange={(e) => updateValue(e.target.value)} placeholder="Digite o valor..." className={cn(hasError && "border-destructive")} />
          );

        case "date":
        case "dateRange":
          return (
            <Input
              type="date"
              value={condition.value instanceof Date ? condition.value.toISOString().split("T")[0] : condition.value || ""}
              onChange={(e) => updateValue(new Date(e.target.value))}
              className={cn(hasError && "border-destructive")}
            />
          );

        case "range":
          if (condition.operator === "between") {
            return (
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={condition.value?.min || ""}
                  onChange={(e) => updateValue({ ...condition.value, min: Number(e.target.value) })}
                  placeholder="Mínimo"
                  className={cn(hasError && "border-destructive")}
                />
                <Input
                  type="number"
                  value={condition.value?.max || ""}
                  onChange={(e) => updateValue({ ...condition.value, max: Number(e.target.value) })}
                  placeholder="Máximo"
                  className={cn(hasError && "border-destructive")}
                />
              </div>
            );
          }
          return null;

        default:
          return (
            <Input value={condition.value || ""} onChange={(e) => updateValue(e.target.value)} placeholder="Digite o valor..." className={cn(hasError && "border-destructive")} />
          );
      }
    },
    [fields, validationErrors, updateCondition, suggestionProviders],
  );

  // Get data type icon
  const getDataTypeIcon = useCallback((dataType: FilterDataType) => {
    switch (dataType) {
      case "string":
        return <IconSearch className="h-4 w-4" />;
      case "number":
      case "range":
        return <IconHash className="h-4 w-4" />;
      case "boolean":
        return <IconToggleLeft className="h-4 w-4" />;
      case "date":
      case "dateRange":
        return <IconCalendar className="h-4 w-4" />;
      case "select":
      case "multiSelect":
        return <IconList className="h-4 w-4" />;
      default:
        return <IconFilter className="h-4 w-4" />;
    }
  }, []);

  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const isEmpty = isFilterDefinitionEmpty(filterDefinition);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            {title}
            {!isEmpty && <Badge variant="secondary">{getFilterSummary(filterDefinition)}</Badge>}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="builder" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
              <TabsTrigger value="builder">Construtor</TabsTrigger>
              {allowPresets && <TabsTrigger value="presets">Presets</TabsTrigger>}
              {showAdvanced && <TabsTrigger value="advanced">Avançado</TabsTrigger>}
            </TabsList>

            <div className="flex-1 overflow-hidden mt-4">
              <TabsContent value="builder" className="h-full">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-6">
                    {filterDefinition.groups.map((group, groupIndex) => (
                      <Card key={groupIndex} className="relative">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              Grupo {groupIndex + 1}
                              <Select value={group.operator} onValueChange={(value: "AND" | "OR") => updateGroupOperator(groupIndex, value)}>
                                <SelectTrigger className="w-20 h-7">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AND">E</SelectItem>
                                  <SelectItem value="OR">OU</SelectItem>
                                </SelectContent>
                              </Select>
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => addCondition(groupIndex)} disabled={group.conditions.length >= maxConditionsPerGroup}>
                                <IconPlus className="h-4 w-4 mr-1" />
                                Condição
                              </Button>
                              {filterDefinition.groups.length > 1 && (
                                <Button size="sm" variant="outline" onClick={() => removeGroup(groupIndex)}>
                                  <IconTrash className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                          {group.conditions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <IconFilter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>Nenhuma condição definida</p>
                              <p className="text-sm">Clique em "Condição" para adicionar</p>
                            </div>
                          ) : (
                            group.conditions.map((condition, conditionIndex) => {
                              const field = fields[condition.field];
                              const operators = getOperatorsForField(condition.field);
                              const errorKey = `group_${groupIndex}_condition_${conditionIndex}`;
                              const errors = validationErrors[errorKey] || [];

                              return (
                                <div key={conditionIndex} className="p-3 border rounded-lg bg-muted/20">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                                      {/* Field selection */}
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Campo</Label>
                                        <Select
                                          value={condition.field}
                                          onValueChange={(field) => {
                                            const fieldDef = fields[field];
                                            const newOperators = getOperatorsForField(field);
                                            const operator = newOperators[0];
                                            updateCondition(groupIndex, conditionIndex, {
                                              field,
                                              dataType: fieldDef.dataType,
                                              operator,
                                              value: "",
                                            });
                                          }}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {fieldOptions.map((option) => (
                                              <SelectItem key={option.value} value={option.value}>
                                                <div className="flex items-center gap-2">
                                                  {getDataTypeIcon(fields[option.value]?.dataType)}
                                                  {option.label}
                                                </div>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      {/* Operator selection */}
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Operador</Label>
                                        <Select value={condition.operator} onValueChange={(operator: FilterOperator) => updateCondition(groupIndex, conditionIndex, { operator })}>
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {operators.map((operator) => (
                                              <SelectItem key={operator} value={operator}>
                                                {getOperatorLabel(operator)}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      {/* Value input */}
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Valor</Label>
                                        {renderConditionValue(condition, groupIndex, conditionIndex)}
                                      </div>
                                    </div>

                                    <Button size="sm" variant="ghost" onClick={() => removeCondition(groupIndex, conditionIndex)} className="mt-6">
                                      <IconX className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  {errors.length > 0 && (
                                    <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
                                      <IconAlertCircle className="h-4 w-4" />
                                      <div>
                                        {errors.map((error, index) => (
                                          <div key={index}>{error}</div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </CardContent>
                      </Card>
                    ))}

                    {filterDefinition.groups.length < maxGroups && (
                      <Button variant="dashed" onClick={addGroup} className="w-full">
                        <IconPlus className="h-4 w-4 mr-2" />
                        Adicionar Grupo
                      </Button>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {allowPresets && (
                <TabsContent value="presets" className="h-full">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Presets Salvos</h3>
                      <Button size="sm" onClick={() => setShowPresetSave(true)} disabled={isEmpty}>
                        <IconSave className="h-4 w-4 mr-2" />
                        Salvar Atual
                      </Button>
                    </div>

                    {showPresetSave && (
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nome do preset..."
                              value={presetName}
                              onChange={(e) => setPresetName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSavePreset();
                                }
                              }}
                            />
                            <Button onClick={handleSavePreset}>
                              <IconCheck className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" onClick={() => setShowPresetSave(false)}>
                              <IconX className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {presets.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <IconSave className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Nenhum preset salvo</p>
                          </div>
                        ) : (
                          presets.map((preset) => (
                            <Card
                              key={preset.id}
                              className={cn("cursor-pointer transition-colors hover:bg-muted/50", selectedPreset === preset.id && "bg-primary/10 border-primary")}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1" onClick={() => handleLoadPreset(preset.id)}>
                                    <h4 className="font-medium">{preset.name}</h4>
                                    {preset.description && <p className="text-sm text-muted-foreground">{preset.description}</p>}
                                    {preset.createdAt && <p className="text-xs text-muted-foreground">{preset.createdAt.toLocaleDateString("pt-BR")}</p>}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => handleLoadPreset(preset.id)} title="Carregar preset">
                                      <IconCheck className="h-4 w-4" />
                                    </Button>
                                    {!preset.isPreset && (
                                      <Button size="sm" variant="ghost" onClick={() => handleDeletePreset(preset.id)} title="Excluir preset">
                                        <IconTrash className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              )}

              {showAdvanced && (
                <TabsContent value="advanced" className="h-full">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Configurações</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="enableValidation"
                            checked={enableValidation}
                            onCheckedChange={() => {
                              /* Toggle validation */
                            }}
                          />
                          <Label htmlFor="enableValidation">Validação em tempo real</Label>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Estatísticas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Grupos:</span> <span className="font-medium">{filterDefinition.groups.length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Condições:</span>{" "}
                            <span className="font-medium">{filterDefinition.groups.reduce((sum, group) => sum + group.conditions.length, 0)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Erros:</span>{" "}
                            <span className={cn("font-medium", hasValidationErrors ? "text-destructive" : "text-muted-foreground")}>{Object.keys(validationErrors).length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>{" "}
                            <span className={cn("font-medium", isEmpty ? "text-muted-foreground" : "text-primary")}>{isEmpty ? "Vazio" : "Configurado"}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              )}
            </div>
          </Tabs>
        </div>

        <Separator />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClear} disabled={isEmpty}>
            <IconX className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button onClick={onOpenChange.bind(null, false)} variant="outline">
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={hasValidationErrors || isEmpty} className="min-w-[120px]">
            <IconCheck className="h-4 w-4 mr-2" />
            Aplicar Filtros
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
