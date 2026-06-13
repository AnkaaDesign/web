import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconHeartHandshake, IconUser, IconGift, IconCalendar, IconTicket } from "@tabler/icons-react";

import type { User } from "../../../../types";
import type { Benefit, UserBenefit } from "../../../../types/benefit";
import type { UserBenefitCreateFormData, UserBenefitUpdateFormData } from "../../../../schemas/benefit";
import { userBenefitCreateSchema } from "../../../../schemas/benefit";
import { routes, BENEFIT_KIND, BENEFIT_KIND_LABELS, BENEFIT_ENROLLMENT_STATUS } from "../../../../constants";
import { userService } from "../../../../api-client";
import { getBenefits } from "../../../../api-client/benefit";
import { useUserBenefitMutations } from "../../../../hooks/personnel-department/use-user-benefits";
import { getKindDiscountCap, getKindDiscountHelper } from "../../benefit/discount-caps";
import { calculateBenefitSplit } from "../../../../utils/benefit-discount";
import { getPositionMonthlySalary } from "../../../../utils/overtime-cost";
import { formatCurrency } from "../../../../utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { FormInput } from "@/components/ui/form-input";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Textarea } from "@/components/ui/textarea";

interface CreateModeProps {
  mode: "create";
}

interface UpdateModeProps {
  mode: "update";
  // Should be loaded with include { user: true, benefit: true }
  userBenefit: UserBenefit;
}

type UserBenefitFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
};

export function UserBenefitForm(props: UserBenefitFormProps) {
  const navigate = useNavigate();
  const userBenefitMutations = useUserBenefitMutations();

  // Cache of fetched benefits so we can resolve kind/defaults on selection
  const benefitCacheRef = useRef<Map<string, Benefit>>(new Map());
  if (props.mode === "update" && props.userBenefit.benefit && !benefitCacheRef.current.has(props.userBenefit.benefit.id)) {
    benefitCacheRef.current.set(props.userBenefit.benefit.id, props.userBenefit.benefit);
  }

  // Cache of fetched users so we can resolve the current salary on selection
  // (the VT percent rule discounts % of the BASE SALARY, not of the VT cost)
  const userCacheRef = useRef<Map<string, User>>(new Map());
  if (props.mode === "update" && props.userBenefit.user && !userCacheRef.current.has(props.userBenefit.user.id)) {
    userCacheRef.current.set(props.userBenefit.user.id, props.userBenefit.user);
  }

  // The selected benefit kind drives the discount percent cap and the
  // dailyTickets visibility. Kept in a ref so the (stable) zod schema can read
  // the current value at validation time.
  const kindRef = useRef<string | undefined>(props.mode === "update" ? props.userBenefit.benefit?.kind : undefined);
  const [selectedBenefitKind, setSelectedBenefitKind] = useState<string | undefined>(kindRef.current);

  // Local form schema: shared create schema + XOR discount rule + dynamic caps.
  const formSchema = useMemo(
    () =>
      userBenefitCreateSchema.superRefine((data, ctx) => {
        const bothMessage = "Informe o desconto em percentual OU em valor fixo, não ambos";
        if (data.employeeDiscountPercent !== null && data.employeeDiscountPercent !== undefined && data.employeeDiscountValue !== null && data.employeeDiscountValue !== undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["employeeDiscountPercent"], message: bothMessage });
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["employeeDiscountValue"], message: bothMessage });
        }

        if (data.employeeDiscountPercent !== null && data.employeeDiscountPercent !== undefined) {
          const cap = getKindDiscountCap(kindRef.current);
          if (data.employeeDiscountPercent > cap) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["employeeDiscountPercent"], message: getKindDiscountHelper(kindRef.current) });
          }
        }

        if (
          data.employeeDiscountValue !== null &&
          data.employeeDiscountValue !== undefined &&
          data.monthlyValue !== null &&
          data.monthlyValue !== undefined &&
          data.employeeDiscountValue > data.monthlyValue
        ) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["employeeDiscountValue"], message: "O desconto não pode exceder o valor mensal" });
        }
      }),
    [],
  );

  const form = useForm<UserBenefitCreateFormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues:
      props.mode === "create"
        ? {
            userId: undefined,
            benefitId: undefined,
            status: BENEFIT_ENROLLMENT_STATUS.ACTIVE,
            startDate: new Date(),
            endDate: null,
            monthlyValue: undefined,
            employeeDiscountValue: null,
            employeeDiscountPercent: null,
            dailyTickets: null,
            notes: null,
          }
        : {
            userId: props.userBenefit.userId,
            benefitId: props.userBenefit.benefitId,
            status: props.userBenefit.status,
            startDate: props.userBenefit.startDate ? new Date(props.userBenefit.startDate) : new Date(),
            endDate: props.userBenefit.endDate ? new Date(props.userBenefit.endDate) : null,
            monthlyValue: props.userBenefit.monthlyValue,
            employeeDiscountValue: props.userBenefit.employeeDiscountValue,
            employeeDiscountPercent: props.userBenefit.employeeDiscountPercent,
            dailyTickets: props.userBenefit.dailyTickets,
            notes: props.userBenefit.notes,
          },
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  const discountCap = getKindDiscountCap(selectedBenefitKind);
  const discountHelper = getKindDiscountHelper(selectedBenefitKind);
  const showDailyTickets = selectedBenefitKind === BENEFIT_KIND.TRANSPORT_VOUCHER;

  // Live employer/employee split preview — updates as the user/value/discount
  // fields change. Uses the canonical payroll rule (utils/benefit-discount):
  // VT percent = % of the BASE SALARY (capped at the VT cost); others = % of cost.
  const watchedUserId = form.watch("userId");
  const watchedMonthlyValue = form.watch("monthlyValue");
  const watchedDiscountValue = form.watch("employeeDiscountValue");
  const watchedDiscountPercent = form.watch("employeeDiscountPercent");
  const selectedUser = watchedUserId ? userCacheRef.current.get(watchedUserId) : undefined;
  const selectedUserSalary = getPositionMonthlySalary(selectedUser?.position);
  const costSplit = calculateBenefitSplit(
    {
      monthlyValue: watchedMonthlyValue ?? 0,
      employeeDiscountValue: watchedDiscountValue,
      employeeDiscountPercent: watchedDiscountPercent,
      benefitKind: selectedBenefitKind,
    },
    selectedUserSalary,
  );
  const splitSalaryKnown = !costSplit.dependsOnSalary || selectedUserSalary !== null;

  // ===== User combobox (async) =====
  const initialUserOptions = useMemo(() => (props.mode === "update" && props.userBenefit.user ? [props.userBenefit.user] : []), []);

  const queryUsers = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = {
      page,
      take: 50,
      where: { isActive: true },
      orderBy: { name: "asc" },
      // remunerations = salário-base do cargo, usado no preview Empresa × Colaborador
      include: { position: { include: { remunerations: true } }, sector: true },
    };
    if (search?.trim()) queryParams.searchingFor = search.trim();
    const response = await userService.getUsers(queryParams);
    const users = (response.data || []) as User[];
    users.forEach((u) => userCacheRef.current.set(u.id, u));
    return { data: users, hasMore: response.meta?.hasNextPage || false };
  }, []);

  const renderUserOption = useCallback(
    (u: User) => (
      <div>
        <p className="font-medium">{u.name}</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {u.position?.name && <span>{u.position.name}</span>}
          {u.sector?.name && <span>· {u.sector.name}</span>}
        </div>
      </div>
    ),
    [],
  );

  // ===== Benefit combobox (async, active only) =====
  const initialBenefitOptions = useMemo(() => (props.mode === "update" && props.userBenefit.benefit ? [props.userBenefit.benefit] : []), []);

  const queryBenefits = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = {
      page,
      take: 50,
      isActive: true,
      orderBy: { name: "asc" },
    };
    if (search?.trim()) queryParams.searchingFor = search.trim();
    const response = await getBenefits(queryParams);
    const benefits = (response.data || []) as Benefit[];
    benefits.forEach((benefit) => benefitCacheRef.current.set(benefit.id, benefit));
    return { data: benefits, hasMore: response.meta?.hasNextPage || false };
  }, []);

  const renderBenefitOption = useCallback(
    (b: Benefit) => (
      <div>
        <p className="font-medium">{b.name}</p>
        <p className="text-xs text-muted-foreground">{BENEFIT_KIND_LABELS[b.kind] || b.kind}</p>
      </div>
    ),
    [],
  );

  // Auto-fill monthlyValue / employeeDiscountPercent from the selected benefit
  // defaults — only when the fields are still untouched or empty.
  const handleBenefitSelected = useCallback(
    (benefitId: string | undefined) => {
      const benefit = benefitId ? benefitCacheRef.current.get(benefitId) : undefined;
      kindRef.current = benefit?.kind;
      setSelectedBenefitKind(benefit?.kind);

      if (benefit?.kind !== BENEFIT_KIND.TRANSPORT_VOUCHER) {
        form.setValue("dailyTickets", null);
      }

      if (!benefit) return;

      if (benefit.defaultValue !== null && benefit.defaultValue !== undefined) {
        const monthlyValueState = form.getFieldState("monthlyValue");
        const monthlyValue = form.getValues("monthlyValue");
        if (!monthlyValueState.isDirty || monthlyValue === undefined || monthlyValue === null) {
          form.setValue("monthlyValue", benefit.defaultValue, { shouldValidate: true });
        }
      }

      if (benefit.defaultEmployeeDiscountPercent !== null && benefit.defaultEmployeeDiscountPercent !== undefined) {
        const percentState = form.getFieldState("employeeDiscountPercent");
        const percent = form.getValues("employeeDiscountPercent");
        const discountValue = form.getValues("employeeDiscountValue");
        if ((!percentState.isDirty || percent === undefined || percent === null) && (discountValue === undefined || discountValue === null)) {
          form.setValue("employeeDiscountPercent", benefit.defaultEmployeeDiscountPercent, { shouldValidate: true });
        }
      }
    },
    [form],
  );

  const handleSubmit = async (data: UserBenefitCreateFormData) => {
    try {
      if (props.mode === "create") {
        const result = await userBenefitMutations.createAsync(data);
        if (result.data?.id) {
          navigate(routes.personnelDepartment.benefits.enrollments.details(result.data.id));
        } else {
          navigate(routes.personnelDepartment.benefits.enrollments.root);
        }
      } else {
        await userBenefitMutations.updateAsync({
          id: props.userBenefit.id,
          data: data as UserBenefitUpdateFormData,
        });
        navigate(routes.personnelDepartment.benefits.enrollments.details(props.userBenefit.id));
      }
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting enrollment form:", error);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form id="user-benefit-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        {/* Hidden submit button for external form submission */}
        <button id="user-benefit-form-submit" type="submit" className="hidden" disabled={isSubmitting} />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconHeartHandshake className="h-5 w-5 text-muted-foreground" />
                Informações da Adesão
              </CardTitle>
              <CardDescription>Vincule um colaborador a um benefício</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Colaborador */}
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>
                        <div className="flex items-center gap-2">
                          <IconUser className="h-4 w-4" />
                          Colaborador <span className="text-destructive">*</span>
                        </div>
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isSubmitting}
                          placeholder="Buscar colaborador..."
                          emptyText="Nenhum colaborador encontrado"
                          async
                          queryKey={["users", "user-benefit-form"]}
                          minSearchLength={0}
                          queryFn={queryUsers}
                          initialOptions={initialUserOptions}
                          getOptionLabel={(u: User) => u.name}
                          getOptionValue={(u: User) => u.id}
                          renderOption={renderUserOption}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Benefício */}
                <FormField
                  control={form.control}
                  name="benefitId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>
                        <div className="flex items-center gap-2">
                          <IconGift className="h-4 w-4" />
                          Benefício <span className="text-destructive">*</span>
                        </div>
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleBenefitSelected(typeof value === "string" ? value : undefined);
                          }}
                          disabled={isSubmitting}
                          placeholder="Buscar benefício..."
                          emptyText="Nenhum benefício ativo encontrado"
                          async
                          queryKey={["benefits", "active", "user-benefit-form"]}
                          minSearchLength={0}
                          queryFn={queryBenefits}
                          initialOptions={initialBenefitOptions}
                          getOptionLabel={(b: Benefit) => b.name}
                          getOptionValue={(b: Benefit) => b.id}
                          renderOption={renderBenefitOption}
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
                <IconGift className="h-5 w-5 text-muted-foreground" />
                Valores e Descontos
              </CardTitle>
              <CardDescription>Informe o desconto do colaborador em percentual OU em valor fixo — nunca ambos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormMoneyInput<UserBenefitCreateFormData> name="monthlyValue" label="Valor Mensal" disabled={isSubmitting} required />

                {showDailyTickets && (
                  <FormInput<UserBenefitCreateFormData>
                    name="dailyTickets"
                    label={
                      <span className="flex items-center gap-2">
                        <IconTicket className="h-4 w-4" />
                        Passagens por Dia
                      </span>
                    }
                    type="natural"
                    min={0}
                    description="Quantidade de passagens diárias (Vale Transporte)"
                    disabled={isSubmitting}
                  />
                )}

                <FormInput<UserBenefitCreateFormData>
                  name="employeeDiscountPercent"
                  label="Desconto do Colaborador (%)"
                  type="percentage"
                  min={0}
                  max={discountCap}
                  description={discountHelper}
                  disabled={isSubmitting}
                />

                <FormMoneyInput<UserBenefitCreateFormData> name="employeeDiscountValue" label="Desconto do Colaborador (R$)" disabled={isSubmitting} />
              </div>

              {/* Live employer/employee split summary (canonical payroll rule) */}
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">Custo total {formatCurrency(costSplit.monthlyValue)}</span>
                <span className="text-muted-foreground"> • </span>
                {splitSalaryKnown ? (
                  <>
                    <span>
                      Empresa paga <span className="font-medium">{formatCurrency(costSplit.companyShare)}</span>
                    </span>
                    <span className="text-muted-foreground"> • </span>
                    <span>
                      Colaborador paga <span className="font-medium">{formatCurrency(costSplit.employeeShare)}</span>
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Colaborador paga {watchedDiscountPercent}% do salário — selecione um colaborador com salário cadastrado para calcular
                  </span>
                )}
                {costSplit.dependsOnSalary && selectedUserSalary !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Vale Transporte: {watchedDiscountPercent}% do salário-base de {formatCurrency(selectedUserSalary)}, limitado ao custo do VT.
                  </p>
                )}
                {(selectedBenefitKind === BENEFIT_KIND.TRANSPORT_VOUCHER ||
                  selectedBenefitKind === BENEFIT_KIND.MEAL_VOUCHER ||
                  selectedBenefitKind === BENEFIT_KIND.FOOD_VOUCHER) && (
                  <p className="text-xs text-muted-foreground mt-1">{discountHelper}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCalendar className="h-5 w-5 text-muted-foreground" />
                Vigência e Observações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>
                        <div className="flex items-center gap-2">
                          <IconCalendar className="h-4 w-4" />
                          Data de Início
                        </div>
                      </FormLabel>
                      <FormControl>
                        <DateTimeInput
                          mode="date"
                          value={field.value ?? null}
                          onChange={(date) => field.onChange(date instanceof Date ? date : undefined)}
                          disabled={isSubmitting}
                          hideLabel
                          placeholder="Selecionar data..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>
                        <div className="flex items-center gap-2">
                          <IconCalendar className="h-4 w-4" />
                          Data de Fim
                        </div>
                      </FormLabel>
                      <FormControl>
                        <DateTimeInput
                          mode="date"
                          value={field.value ?? null}
                          onChange={(date) => field.onChange(date instanceof Date ? date : null)}
                          disabled={isSubmitting}
                          hideLabel
                          placeholder="Selecionar data..."
                        />
                      </FormControl>
                      <FormDescription>Opcional — preenchida automaticamente ao encerrar a adesão</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        onBlur={field.onBlur}
                        placeholder="Observações sobre a adesão (opcional)"
                        rows={3}
                        disabled={isSubmitting}
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
