import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { IconInfoCircle, IconCircleCheck, IconLayoutGrid } from "@tabler/icons-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormInput } from "@/components/ui/form-input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WAREHOUSE_LOCATION_TYPE, WAREHOUSE_LOCATION_TYPE_LABELS } from "../../../../constants";
import {
  warehouseLocationCreateSchema,
  warehouseLocationUpdateSchema,
  type WarehouseLocationCreateFormData,
  type WarehouseLocationUpdateFormData,
} from "../../../../schemas";

interface BaseProps {
  isSubmitting?: boolean;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
}

interface CreateProps extends BaseProps {
  mode: "create";
  onSubmit: (data: WarehouseLocationCreateFormData) => Promise<void>;
  defaultValues?: Partial<WarehouseLocationCreateFormData>;
}

interface UpdateProps extends BaseProps {
  mode: "update";
  onSubmit: (data: WarehouseLocationUpdateFormData) => Promise<void>;
  defaultValues?: Partial<WarehouseLocationUpdateFormData>;
}

type WarehouseLocationFormProps = CreateProps | UpdateProps;

const MAX_LEVELS = 100;

const CREATE_DEFAULTS: WarehouseLocationCreateFormData = {
  name: "",
  section: null,
  code: null,
  description: null,
  isActive: true,
  type: WAREHOUSE_LOCATION_TYPE.ESTANTE,
  levels: 1,
  columns: 1,
  columnsPerLevel: undefined,
};

export function WarehouseLocationForm(props: WarehouseLocationFormProps) {
  const { isSubmitting, mode, defaultValues, onFormStateChange } = props;

  const resolver = useMemo(
    () => (mode === "create" ? zodResolver(warehouseLocationCreateSchema) : zodResolver(warehouseLocationUpdateSchema)),
    [mode],
  );

  const form = useForm({
    resolver,
    defaultValues: mode === "create" ? { ...CREATE_DEFAULTS, ...defaultValues } : defaultValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const { isValid, isDirty } = form.formState;

  useEffect(() => {
    onFormStateChange?.({ isValid, isDirty });
  }, [isValid, isDirty, onFormStateChange]);

  // Watch grid-related fields to render the per-level editor.
  const levels = form.watch("levels") ?? 1;
  const columns = form.watch("columns") ?? 1;
  const columnsPerLevel = form.watch("columnsPerLevel");

  const onSubmit = async (data: WarehouseLocationCreateFormData | WarehouseLocationUpdateFormData) => {
    if (mode === "create") {
      await (props as CreateProps).onSubmit(data as WarehouseLocationCreateFormData);
    } else {
      // For update mode, only submit dirty fields
      const dirtyFields = form.formState.dirtyFields;
      const onlyDirty: Partial<WarehouseLocationUpdateFormData> = {};
      Object.keys(dirtyFields).forEach((key) => {
        if ((dirtyFields as any)[key]) {
          (onlyDirty as any)[key] = (data as any)[key];
        }
      });
      await (props as UpdateProps).onSubmit(onlyDirty as WarehouseLocationUpdateFormData);
    }
  };

  // Build the per-level rows; each defaults to `columns` when not overridden.
  const levelCount = Math.max(1, Math.min(Number(levels) || 1, MAX_LEVELS));
  const colCount = Math.max(1, Number(columns) || 1);

  const handleLevelColumnsChange = (levelIndex: number, rawValue: string) => {
    const next = [...(columnsPerLevel ?? [])];
    // Ensure length covers all levels, defaulting each to the base column count.
    for (let i = 0; i < levelCount; i++) {
      if (next[i] == null) next[i] = colCount;
    }
    const parsed = parseInt(rawValue, 10);
    next[levelIndex] = isNaN(parsed) ? colCount : Math.max(1, Math.min(parsed, MAX_LEVELS));
    // Trim to the current level count.
    form.setValue("columnsPerLevel", next.slice(0, levelCount), { shouldDirty: true, shouldValidate: true });
  };

  return (
    <Form {...form}>
      <form id="warehouse-location-form" onSubmit={form.handleSubmit(onSubmit)} className="container mx-auto max-w-4xl">
        <button id="warehouse-location-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
          Submit
        </button>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                Informações Básicas
              </CardTitle>
              <CardDescription>Dados da localização de armazenamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormInput<WarehouseLocationCreateFormData | WarehouseLocationUpdateFormData>
                name="name"
                label="Nome"
                placeholder="Ex: Prateleira A1"
                required
                disabled={isSubmitting}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput<WarehouseLocationCreateFormData | WarehouseLocationUpdateFormData>
                  name="section"
                  label="Setor"
                  placeholder="Ex: Setor 1"
                  disabled={isSubmitting}
                />
                <FormInput<WarehouseLocationCreateFormData | WarehouseLocationUpdateFormData>
                  name="code"
                  label="Código"
                  placeholder="Ex: A1"
                  disabled={isSubmitting}
                />
              </div>

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value ?? WAREHOUSE_LOCATION_TYPE.ESTANTE} onValueChange={field.onChange} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(WAREHOUSE_LOCATION_TYPE).map((type) => (
                          <SelectItem key={type} value={type}>
                            {WAREHOUSE_LOCATION_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações sobre a localização"
                        disabled={isSubmitting}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between space-x-2">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center gap-2">
                        <IconCircleCheck className="h-4 w-4" />
                        Ativo
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">Localização está ativa e disponível no sistema</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value ?? true} onCheckedChange={field.onChange} disabled={isSubmitting} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Grid layout */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconLayoutGrid className="h-5 w-5 text-muted-foreground" />
                Estrutura Interna
              </CardTitle>
              <CardDescription>Níveis e colunas da estrutura (usado no mapa do armazém)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="levels"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Níveis</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={MAX_LEVELS}
                          disabled={isSubmitting}
                          value={field.value ?? 1}
                          onChange={(value) => {
                            const parsed = parseInt(String(value), 10);
                            field.onChange(isNaN(parsed) ? 1 : parsed);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="columns"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colunas</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={MAX_LEVELS}
                          disabled={isSubmitting}
                          value={field.value ?? 1}
                          onChange={(value) => {
                            const parsed = parseInt(String(value), 10);
                            field.onChange(isNaN(parsed) ? 1 : parsed);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Per-level columns editor */}
              {levelCount > 1 && (
                <div className="space-y-2">
                  <Label>Colunas por nível</Label>
                  <p className="text-xs text-muted-foreground">Defina quantas colunas cada nível possui. Cada nível inicia com o valor padrão de colunas ({colCount}).</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Array.from({ length: levelCount }, (_, i) => {
                      const value = columnsPerLevel?.[i] ?? colCount;
                      return (
                        <div key={i} className="space-y-1">
                          <Label htmlFor={`level-cols-${i}`} className="text-xs text-muted-foreground">
                            Colunas no nível {i + 1}
                          </Label>
                          <Input
                            id={`level-cols-${i}`}
                            type="number"
                            min={1}
                            max={MAX_LEVELS}
                            disabled={isSubmitting}
                            value={value}
                            onChange={(v) => handleLevelColumnsChange(i, String(v))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}
