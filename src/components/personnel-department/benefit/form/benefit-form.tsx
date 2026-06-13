import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconGift, IconToggleRight } from "@tabler/icons-react";

import type { Benefit } from "../../../../types/benefit";
import type { BenefitCreateFormData, BenefitUpdateFormData } from "../../../../schemas/benefit";
import { benefitCreateSchema } from "../../../../schemas/benefit";
import { routes, BENEFIT_KIND_LABELS } from "../../../../constants";
import { useBenefitMutations } from "../../../../hooks/personnel-department/use-benefits";
import { getKindDiscountCap, getKindDiscountHelper } from "../discount-caps";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormCombobox } from "@/components/ui/form-combobox";
import { FormInput } from "@/components/ui/form-input";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { Textarea } from "@/components/ui/textarea";

// Local form schema: extends the shared create schema with the kind-dependent
// discount percent cap (TRANSPORT_VOUCHER ≤ 6, MEAL/FOOD_VOUCHER ≤ 20, else ≤ 100).
const benefitFormSchema = benefitCreateSchema.superRefine((data, ctx) => {
  if (data.defaultEmployeeDiscountPercent !== null && data.defaultEmployeeDiscountPercent !== undefined) {
    const cap = getKindDiscountCap(data.kind);
    if (data.defaultEmployeeDiscountPercent > cap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultEmployeeDiscountPercent"],
        message: getKindDiscountHelper(data.kind),
      });
    }
  }
});

interface CreateModeProps {
  mode: "create";
}

interface UpdateModeProps {
  mode: "update";
  benefit: Benefit;
}

type BenefitFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
};

export function BenefitForm(props: BenefitFormProps) {
  const navigate = useNavigate();
  const benefitMutations = useBenefitMutations();

  const form = useForm<BenefitCreateFormData>({
    resolver: zodResolver(benefitFormSchema),
    mode: "onChange",
    defaultValues:
      props.mode === "create"
        ? {
            kind: undefined,
            name: "",
            provider: null,
            defaultValue: null,
            defaultEmployeeDiscountPercent: null,
            isActive: true,
            notes: null,
          }
        : {
            kind: props.benefit.kind,
            name: props.benefit.name,
            provider: props.benefit.provider,
            defaultValue: props.benefit.defaultValue,
            defaultEmployeeDiscountPercent: props.benefit.defaultEmployeeDiscountPercent,
            isActive: props.benefit.isActive,
            notes: props.benefit.notes,
          },
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  const watchedKind = form.watch("kind");
  const discountHelper = useMemo(() => getKindDiscountHelper(watchedKind), [watchedKind]);
  const discountCap = useMemo(() => getKindDiscountCap(watchedKind), [watchedKind]);

  const kindOptions = useMemo(
    () =>
      Object.entries(BENEFIT_KIND_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  const handleSubmit = async (data: BenefitCreateFormData) => {
    try {
      if (props.mode === "create") {
        const result = await benefitMutations.createAsync(data);
        if (result.data?.id) {
          navigate(routes.personnelDepartment.benefits.details(result.data.id));
        } else {
          navigate(routes.personnelDepartment.benefits.root);
        }
      } else {
        await benefitMutations.updateAsync({
          id: props.benefit.id,
          data: data as BenefitUpdateFormData,
        });
        navigate(routes.personnelDepartment.benefits.details(props.benefit.id));
      }
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting benefit form:", error);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form id="benefit-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        {/* Hidden submit button for external form submission */}
        <button id="benefit-form-submit" type="submit" className="hidden" disabled={isSubmitting} />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconGift className="h-5 w-5 text-muted-foreground" />
                Informações do Benefício
              </CardTitle>
              <CardDescription>Preencha as informações básicas do benefício</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormCombobox
                  name="kind"
                  label="Tipo de Benefício"
                  options={kindOptions}
                  placeholder="Selecione o tipo"
                  disabled={isSubmitting}
                  required
                  searchable
                />

                <FormInput<BenefitCreateFormData> name="name" label="Nome" placeholder="Ex: Vale Transporte Urbano" disabled={isSubmitting} required />

                <FormInput<BenefitCreateFormData> name="provider" label="Fornecedor" placeholder="Ex: Transfácil" disabled={isSubmitting} />

                <FormMoneyInput<BenefitCreateFormData> name="defaultValue" label="Custo Padrão (Empresa + Colaborador)" disabled={isSubmitting} />

                <FormInput<BenefitCreateFormData>
                  name="defaultEmployeeDiscountPercent"
                  label="Desconto Padrão do Colaborador (%)"
                  type="percentage"
                  min={0}
                  max={discountCap}
                  description={discountHelper}
                  disabled={isSubmitting}
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
                        placeholder="Observações sobre o benefício (opcional)"
                        rows={3}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormSwitch<BenefitCreateFormData>
                name="isActive"
                label="Benefício Ativo"
                description="Benefícios inativos não aparecem para novas adesões"
                icon={<IconToggleRight className="h-4 w-4" />}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>
        </div>
      </form>
    </FormProvider>
  );
}
