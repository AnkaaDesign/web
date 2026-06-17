import { useCallback, useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconUser, IconCalendar, IconNotes, IconProgress } from "@tabler/icons-react";

import {
  thirteenthCreateSchema,
  thirteenthUpdateSchema,
  type ThirteenthCreateFormData,
  type ThirteenthUpdateFormData,
} from "../../../../schemas/thirteenth";
import type { Thirteenth } from "../../../../types/thirteenth";
import type { User } from "../../../../types";
import { THIRTEENTH_STATUS, THIRTEENTH_STATUS_LABELS } from "../../../../constants";
import { getUsers } from "../../../../api-client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormMoneyInput } from "@/components/ui/form-money-input";

interface CreateModeProps {
  mode: "create";
  /** When provided, the colaborador is fixed (per-collaborator context) and the picker is hidden. */
  fixedUser?: { id: string; name: string };
  onSubmit: (data: ThirteenthCreateFormData) => Promise<void>;
}

interface UpdateModeProps {
  mode: "update";
  thirteenth: Thirteenth;
  onSubmit: (data: ThirteenthUpdateFormData) => Promise<void>;
}

type ThirteenthFormProps = (CreateModeProps | UpdateModeProps) & {
  /** Stable id so a Dialog footer button can submit the right form. */
  formId?: string;
  isSubmitting?: boolean;
  disabled?: boolean;
};

/**
 * 13º Salário form — rendered inside a Dialog/Drawer from the colaborador
 * detail page. It no longer has dedicated pages, so it renders only the fields
 * (the dialog provides the title/footer chrome).
 */
export function ThirteenthForm(props: ThirteenthFormProps) {
  const thirteenth = props.mode === "update" ? props.thirteenth : undefined;
  const fixedUser = props.mode === "create" ? props.fixedUser : undefined;
  const formId = props.formId ?? "thirteenth-form";

  const form = useForm<ThirteenthCreateFormData | ThirteenthUpdateFormData>({
    resolver: zodResolver(props.mode === "create" ? thirteenthCreateSchema : thirteenthUpdateSchema),
    defaultValues:
      props.mode === "create"
        ? {
            userId: fixedUser?.id ?? "",
            year: new Date().getFullYear(),
            avos: undefined,
            baseRemuneration: null,
            notes: null,
          }
        : {
            avos: thirteenth?.avos ?? undefined,
            baseRemuneration: thirteenth?.baseRemuneration ?? null,
            notes: thirteenth?.notes ?? null,
            status: thirteenth?.status,
          },
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;
  const fieldsDisabled = props.disabled || isSubmitting;

  const queryUsers = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = { page, take: 50, orderBy: { name: "asc" }, include: { position: true } };
    if (search?.trim()) queryParams.searchingFor = search.trim();
    const response = await getUsers(queryParams);
    return { data: response.data || [], hasMore: response.meta?.hasNextPage || false };
  }, []);

  const statusOptions = useMemo(() => Object.entries(THIRTEENTH_STATUS_LABELS).map(([value, label]) => ({ value, label })), []);

  const handleSubmit = async (data: ThirteenthCreateFormData | ThirteenthUpdateFormData) => {
    try {
      if (props.mode === "create") {
        await props.onSubmit(data as ThirteenthCreateFormData);
      } else {
        await props.onSubmit(data as ThirteenthUpdateFormData);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting thirteenth form:", error);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <button id={`${formId}-submit`} type="submit" className="hidden" disabled={fieldsDisabled} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Colaborador */}
          {props.mode === "create" && !fixedUser ? (
            <FormField
              control={form.control}
              name={"userId" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <div className="flex items-center gap-2">
                      <IconUser className="h-4 w-4" />
                      Colaborador <span className="text-destructive">*</span>
                    </div>
                  </FormLabel>
                  <FormControl>
                    <Combobox<User>
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={fieldsDisabled}
                      placeholder="Selecione o colaborador"
                      emptyText="Nenhum colaborador encontrado"
                      searchPlaceholder="Buscar colaborador..."
                      async={true}
                      queryKey={["users", "thirteenth-collaborator"]}
                      queryFn={queryUsers}
                      initialOptions={[]}
                      getOptionLabel={(u) => u.name}
                      getOptionValue={(u) => u.id}
                      renderOption={(u) => (
                        <div>
                          <p className="font-medium">{u.name}</p>
                          {u.position && <p className="text-xs text-muted-foreground">{u.position.name}</p>}
                        </div>
                      )}
                      minSearchLength={0}
                      pageSize={50}
                      debounceMs={300}
                      searchable={true}
                      clearable={true}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormItem>
              <FormLabel>
                <div className="flex items-center gap-2">
                  <IconUser className="h-4 w-4" />
                  Colaborador
                </div>
              </FormLabel>
              <Input value={fixedUser?.name ?? thirteenth?.user?.name ?? "-"} disabled readOnly />
            </FormItem>
          )}

          {/* Ano */}
          {props.mode === "create" ? (
            <FormField
              control={form.control}
              name={"year" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <div className="flex items-center gap-2">
                      <IconCalendar className="h-4 w-4" />
                      Ano <span className="text-destructive">*</span>
                    </div>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={2000}
                      max={2100}
                      value={field.value ?? ""}
                      disabled={fieldsDisabled}
                      onChange={(value) => {
                        const num = value === null || value === "" ? undefined : Number(value);
                        field.onChange(Number.isFinite(num) ? num : undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormItem>
              <FormLabel>
                <div className="flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Ano
                </div>
              </FormLabel>
              <Input value={String(thirteenth?.year ?? "-")} disabled readOnly />
            </FormItem>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Avos */}
          <FormField
            control={form.control}
            name={"avos" as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Avos (0–12)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={12}
                    placeholder={props.mode === "create" ? "Automático" : ""}
                    value={field.value ?? ""}
                    disabled={fieldsDisabled}
                    onChange={(value) => {
                      field.onChange(value === null || value === "" ? undefined : Number(value));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Base de cálculo */}
          <FormMoneyInput<ThirteenthCreateFormData | ThirteenthUpdateFormData>
            name={"baseRemuneration" as any}
            label="Base de Cálculo (média de variáveis)"
            placeholder="Automático"
            disabled={fieldsDisabled}
          />
        </div>

        {/* Status — update only */}
        {props.mode === "update" && (
          <FormField
            control={form.control}
            name={"status" as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <div className="flex items-center gap-2">
                    <IconProgress className="h-4 w-4" />
                    Status
                  </div>
                </FormLabel>
                <FormControl>
                  <Combobox
                    options={statusOptions}
                    value={field.value ?? ""}
                    onValueChange={(value) => field.onChange(Array.isArray(value) ? value[0] : value)}
                    disabled={fieldsDisabled}
                    placeholder="Selecione o status"
                    searchable={false}
                  />
                </FormControl>
                <FormMessage />
                {field.value === THIRTEENTH_STATUS.CANCELLED && (
                  <p className="text-xs text-muted-foreground">Cancelar interrompe o pagamento das parcelas.</p>
                )}
              </FormItem>
            )}
          />
        )}

        {/* Observações */}
        <FormField
          control={form.control}
          name={"notes" as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <div className="flex items-center gap-2">
                  <IconNotes className="h-4 w-4" />
                  Observações
                </div>
              </FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} disabled={fieldsDisabled} rows={3} placeholder="Notas internas sobre este 13º (opcional)" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {props.mode === "create" && (
          <Alert>
            <AlertDescription>
              Deixe avos e base em branco para o sistema calcular automaticamente a partir da admissão do vínculo. Para gerar o 13º de todos os colaboradores CLT de uma vez,
              use a ação "Gerar 13º do ano" na listagem de colaboradores.
            </AlertDescription>
          </Alert>
        )}
      </form>
    </FormProvider>
  );
}
