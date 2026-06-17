import { useCallback, useEffect } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconBeach, IconCalendar, IconFileDescription, IconUsersGroup } from "@tabler/icons-react";

import { vacationGroupCreateSchema, type VacationGroupCreateFormData } from "../../../../schemas/vacation-group";
import { VACATION_GROUP_TYPE, VACATION_GROUP_TYPE_LABELS } from "../../../../constants";
import type { Sector, Position } from "../../../../types";
import { getSectors, getPositions } from "../../../../api-client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface VacationGroupFormProps {
  mode: "create";
  onSubmit: (data: VacationGroupCreateFormData) => Promise<void>;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export function VacationGroupForm({ onSubmit, isSubmitting: isSubmittingProp, disabled }: VacationGroupFormProps) {
  const form = useForm<VacationGroupCreateFormData>({
    resolver: zodResolver(vacationGroupCreateSchema),
    defaultValues: {
      name: "",
      type: VACATION_GROUP_TYPE.ALL,
      acquisitiveStart: undefined,
      acquisitiveEnd: undefined,
      sectorIds: [],
      positionIds: [],
      notes: null,
      startDate: undefined,
      days: 30,
    } as any,
  });

  const isSubmitting = isSubmittingProp || form.formState.isSubmitting;
  const fieldsDisabled = disabled || isSubmitting;

  const watchedType = useWatch({ control: form.control, name: "type" });

  // Reset the irrelevant target list when type changes.
  useEffect(() => {
    if (watchedType !== VACATION_GROUP_TYPE.SECTOR) form.setValue("sectorIds", []);
    if (watchedType !== VACATION_GROUP_TYPE.POSITION) form.setValue("positionIds", []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedType]);

  const querySectors = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = { page, take: 50, orderBy: { name: "asc" } };
    if (search && search.trim()) queryParams.searchingFor = search.trim();
    const response = await getSectors(queryParams);
    return { data: response.data || [], hasMore: response.meta?.hasNextPage || false };
  }, []);

  const queryPositions = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = { page, take: 50, orderBy: { name: "asc" } };
    if (search && search.trim()) queryParams.searchingFor = search.trim();
    const response = await getPositions(queryParams);
    return { data: response.data || [], hasMore: response.meta?.hasNextPage || false };
  }, []);

  const handleSubmit = async (data: VacationGroupCreateFormData) => {
    try {
      await onSubmit({
        ...data,
        sectorIds: data.type === VACATION_GROUP_TYPE.SECTOR ? data.sectorIds : undefined,
        positionIds: data.type === VACATION_GROUP_TYPE.POSITION ? data.positionIds : undefined,
      } as VacationGroupCreateFormData);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting vacation group form:", error);
      }
    }
  };

  const typeOptions = Object.entries(VACATION_GROUP_TYPE_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <FormProvider {...form}>
      <form id="vacation-group-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        <button id="vacation-group-form-submit" type="submit" className="hidden" disabled={fieldsDisabled} />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBeach className="h-5 w-5 text-muted-foreground" />
                Informações das Férias Coletivas
              </CardTitle>
              <CardDescription>Defina o nome, a abrangência e o período aquisitivo de referência.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nome <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value)}
                        disabled={fieldsDisabled}
                        placeholder="Ex.: Férias coletivas de fim de ano"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <IconUsersGroup className="h-4 w-4" />
                        Abrangência <span className="text-destructive">*</span>
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        options={typeOptions}
                        value={field.value}
                        onValueChange={(value) => field.onChange(Array.isArray(value) ? value[0] : value)}
                        disabled={fieldsDisabled}
                        placeholder="Selecione a abrangência"
                        searchable={false}
                        clearable={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedType === VACATION_GROUP_TYPE.SECTOR && (
                <FormField
                  control={form.control}
                  name="sectorIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Setores <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Combobox<Sector>
                          mode="multiple"
                          value={field.value ?? []}
                          onValueChange={(value) => field.onChange(Array.isArray(value) ? value : value ? [value] : [])}
                          disabled={fieldsDisabled}
                          placeholder="Selecione os setores"
                          emptyText="Nenhum setor encontrado"
                          searchPlaceholder="Buscar setor..."
                          async={true}
                          queryKey={["sectors", "vacation-group-target"]}
                          queryFn={querySectors}
                          initialOptions={[]}
                          getOptionLabel={(s) => s.name}
                          getOptionValue={(s) => s.id}
                          minSearchLength={0}
                          pageSize={50}
                          debounceMs={300}
                          searchable={true}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {watchedType === VACATION_GROUP_TYPE.POSITION && (
                <FormField
                  control={form.control}
                  name="positionIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Cargos <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Combobox<Position>
                          mode="multiple"
                          value={field.value ?? []}
                          onValueChange={(value) => field.onChange(Array.isArray(value) ? value : value ? [value] : [])}
                          disabled={fieldsDisabled}
                          placeholder="Selecione os cargos"
                          emptyText="Nenhum cargo encontrado"
                          searchPlaceholder="Buscar cargo..."
                          async={true}
                          queryKey={["positions", "vacation-group-target"]}
                          queryFn={queryPositions}
                          initialOptions={[]}
                          getOptionLabel={(p) => p.name}
                          getOptionValue={(p) => p.id}
                          minSearchLength={0}
                          pageSize={50}
                          debounceMs={300}
                          searchable={true}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {watchedType === VACATION_GROUP_TYPE.ALL && (
                <Alert>
                  <AlertDescription>As férias coletivas serão aplicadas a todos os colaboradores elegíveis da empresa.</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="acquisitiveStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <DateTimeInput
                          mode="date"
                          value={field.value as Date | undefined}
                          onChange={(date) => field.onChange(date instanceof Date ? date : undefined)}
                          label="Início do período aquisitivo *"
                          disabled={fieldsDisabled}
                          placeholder="Selecione a data"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="acquisitiveEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <DateTimeInput
                          mode="date"
                          value={field.value as Date | undefined}
                          onChange={(date) => field.onChange(date instanceof Date ? date : undefined)}
                          label="Fim do período aquisitivo *"
                          disabled={fieldsDisabled}
                          placeholder="Selecione a data"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCalendar className="h-5 w-5 text-muted-foreground" />
                Período de Gozo
              </CardTitle>
              <CardDescription>Defina o início e a quantidade de dias do gozo coletivo. Será aplicado a cada colaborador elegível.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={"startDate" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <DateTimeInput
                          mode="date"
                          value={field.value as Date | undefined}
                          onChange={(date) => field.onChange(date instanceof Date ? date : undefined)}
                          label="Início do gozo *"
                          disabled={fieldsDisabled}
                          placeholder="Selecione a data"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={"days" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dias de gozo *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={field.value ?? ""}
                          onChange={(value) => field.onChange(value === "" || value === null ? undefined : Number(value))}
                          disabled={fieldsDisabled}
                          placeholder="30"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconFileDescription className="h-5 w-5 text-muted-foreground" />
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                        disabled={fieldsDisabled}
                        placeholder="Observações sobre as férias coletivas (opcional)"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
      </form>
    </FormProvider>
  );
}
