import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef } from "react";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { userCreateSchema, userUpdateSchema, type UserCreateFormData, type UserUpdateFormData } from "../../../../schemas";
import { USER_STATUS } from "../../../../constants";
import { formatDateTime } from "../../../../utils/date";

// Import all form components
import { NameInput } from "./name-input";
import { FormInput } from "@/components/ui/form-input";
import { HireDateInput } from "./hire-date-input";
import { AdmissionalDateInput } from "./admissional-date-input";
import { DismissalDateInput } from "./dismissal-date-input";
import { BirthDateInput } from "./birth-date-input";
import { PositionSelector } from "./position-selector";
import { SectorSelector } from "./sector-selector";
import { SectorLeaderSwitch } from "./sector-leader-switch";
import { UserStatusSelector } from "./status-selector";
import { VerifiedSwitch } from "./verified-switch";
import { StatusDatesSection } from "./status-dates-section";
import { AddressInput } from "@/components/ui/form-address-input";
import { AddressNumberInput } from "@/components/ui/form-address-number-input";
import { AddressComplementInput } from "@/components/ui/form-address-complement-input";
import { NeighborhoodInput } from "@/components/ui/form-neighborhood-input";
import { CityInput } from "@/components/ui/form-city-input";
import { StateSelector } from "@/components/ui/form-state-selector";
import { PayrollNumberInput } from "./payroll-number-input";
import { PpeSizesSection } from "./ppe-sizes-section";

interface BaseUserFormProps {
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
}

interface CreateUserFormProps extends BaseUserFormProps {
  mode: "create";
  onSubmit: (data: UserCreateFormData) => Promise<void>;
  defaultValues?: Partial<UserCreateFormData>;
}

interface UpdateUserFormProps extends BaseUserFormProps {
  mode: "update";
  onSubmit: (data: UserUpdateFormData) => Promise<void>;
  defaultValues?: Partial<UserUpdateFormData>;
}

type UserFormProps = CreateUserFormProps | UpdateUserFormProps;

export function UserForm(props: UserFormProps) {
  const { isSubmitting, defaultValues, mode, onDirtyChange, onFormStateChange } = props;

  // Create a custom resolver based on mode
  const customResolver = useMemo(() => {
    if (mode === "create") {
      return zodResolver(userCreateSchema);
    }
    return zodResolver(userUpdateSchema);
  }, [mode]);

  // Default values for create mode - use null for optional fields to match schema expectations
  const createDefaults: UserCreateFormData = {
    name: "",
    email: null,
    status: USER_STATUS.EXPERIENCE_PERIOD_1,
    phone: null,
    cpf: null,
    pis: null,
    verified: false,
    positionId: null,
    performanceLevel: 0,
    sectorId: null,
    managedSectorId: null,

    // Address fields
    address: null,
    addressNumber: null,
    addressComplement: null,
    neighborhood: null,
    city: null,
    state: null,
    zipCode: null,
    site: null,

    // Additional dates
    birth: null,
    admissional: new Date(), // Required field - default to today
    dismissal: null,

    // Status tracking dates
    exp1StartAt: null,
    exp1EndAt: null,
    exp2StartAt: null,
    exp2EndAt: null,
    contractedAt: null,
    dismissedAt: null,

    // Payroll info
    payrollNumber: null,

    // PPE Sizes
    ppeSize: {
      shirts: null,
      boots: null,
      pants: null,
      sleeves: null,
      mask: null,
      gloves: null,
      rainBoots: null,
    },

    ...defaultValues,
  };

  // Create a unified form that works for both modes
  const form = useForm({
    resolver: customResolver,
    defaultValues: mode === "create" ? createDefaults : (defaultValues || {
      name: "",
      email: null,
      status: USER_STATUS.EXPERIENCE_PERIOD_1,
      currentStatus: USER_STATUS.EXPERIENCE_PERIOD_1, // Required for validation
      phone: null,
      cpf: null,
      pis: null,
      verified: false,
      positionId: null,
      performanceLevel: 0,
      sectorId: null,
      managedSectorId: null,
      address: null,
      addressNumber: null,
      addressComplement: null,
      neighborhood: null,
      city: null,
      state: null,
      zipCode: null,
      site: null,
      birth: null,
      admissional: null,
      dismissal: null,
      exp1StartAt: null,
      exp1EndAt: null,
      exp2StartAt: null,
      exp2EndAt: null,
      contractedAt: null,
      dismissedAt: null,
      payrollNumber: null,
      ppeSize: {
        shirts: null,
        boots: null,
        pants: null,
        sleeves: null,
        mask: null,
        gloves: null,
        rainBoots: null,
      },
    }),
    mode: "onTouched", // Validate only after field is touched to avoid premature validation
    reValidateMode: "onChange", // After first validation, check on every change
    shouldFocusError: true, // Focus on first error field when validation fails
    criteriaMode: "all", // Show all errors for better UX
  });

  // Reset form when defaultValues change in update mode (e.g., new user data loaded)
  const defaultValuesRef = useRef(defaultValues);
  useEffect(() => {
    if (mode === "update" && defaultValues && defaultValues !== defaultValuesRef.current) {
      // Reset form with new defaults and mark form as untouched/pristine
      form.reset(defaultValues, {
        keepDefaultValues: false,
        keepDirty: false,
        keepTouched: false,
      });
      defaultValuesRef.current = defaultValues;
    }
  }, [defaultValues, form, mode]);

  // Access formState properties during render for proper subscription
  const { isValid, isDirty, errors } = form.formState;

  // Auto-sync dismissal date and status to prevent validation errors
  useEffect(() => {
    if (mode === "update") {
      const subscription = form.watch((value, { name }) => {
        // If dismissal date is set and status is not DISMISSED, auto-set status to DISMISSED
        if (name === "dismissal" && value.dismissal && value.status !== USER_STATUS.DISMISSED) {
          form.setValue("status", USER_STATUS.DISMISSED, { shouldDirty: true, shouldValidate: true });
        }
        // If dismissal date is cleared and status is DISMISSED, clear status
        if (name === "dismissal" && !value.dismissal && value.status === USER_STATUS.DISMISSED) {
          // Revert to currentStatus
          const currentStatus = form.getValues("currentStatus");
          if (currentStatus && currentStatus !== USER_STATUS.DISMISSED) {
            form.setValue("status", currentStatus, { shouldDirty: true, shouldValidate: true });
          }
        }
        // If status is set to DISMISSED and no dismissal date, don't auto-set (user might want to set it manually)
      });
      return () => subscription.unsubscribe();
    }
  }, [form, mode]);

  // Debug validation errors in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && Object.keys(errors).length > 0) {
      console.log("User form validation errors:", {
        errors,
        currentValues: form.getValues(),
      });
    }
  }, [errors, form]);

  // Track dirty state without triggering validation
  useEffect(() => {
    if (onDirtyChange && mode === "update") {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange, mode]);

  // Track form state changes for submit button
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        isValid,
        isDirty,
      });
    }
  }, [isValid, isDirty, onFormStateChange]);

  const onSubmit = async (data: UserCreateFormData | UserUpdateFormData) => {
    try {
      if (mode === "create") {
        await (props as CreateUserFormProps).onSubmit(data as UserCreateFormData);
      } else {
        await (props as UpdateUserFormProps).onSubmit(data as UserUpdateFormData);
      }
    } catch (error) {
      // Error is handled by the parent component
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card className="bg-transparent">
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>Dados fundamentais do colaborador</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <NameInput disabled={isSubmitting} />
                  <FormInput<UserCreateFormData | UserUpdateFormData>
                    name="email"
                    type="email"
                    label="E-mail"
                    placeholder="Digite o e-mail do colaborador"
                    disabled={isSubmitting}
                    required={!form.watch("phone")}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormInput<UserCreateFormData | UserUpdateFormData>
                    name="phone"
                    type="phone"
                    label="Telefone"
                    placeholder="Digite o telefone do colaborador"
                    disabled={isSubmitting}
                    required={false}
                  />
                  <BirthDateInput disabled={isSubmitting} />
                  <PayrollNumberInput disabled={isSubmitting} />
                </div>
              </CardContent>
            </Card>

          {/* Documents */}
          <Card className="bg-transparent">
              <CardHeader>
                <CardTitle>Documentos</CardTitle>
                <CardDescription>Documentação do colaborador</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormInput<UserCreateFormData | UserUpdateFormData> type="cpf" name="cpf" label="CPF" placeholder="Digite o CPF do colaborador" disabled={isSubmitting} />
                  <FormInput<UserCreateFormData | UserUpdateFormData> type="pis" name="pis" label="PIS" disabled={isSubmitting} />
                </div>
              </CardContent>
            </Card>

          {/* Address Information */}
          <Card className="bg-transparent">
              <CardHeader>
                <CardTitle>Endereço</CardTitle>
                <CardDescription>Informações de endereço do colaborador</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormInput<UserCreateFormData | UserUpdateFormData>
                    type="cep"
                    name="zipCode"
                    label="CEP"
                    disabled={isSubmitting}
                    addressFieldName="address"
                    neighborhoodFieldName="neighborhood"
                    cityFieldName="city"
                    stateFieldName="state"
                  />
                  <AddressInput disabled={isSubmitting} useGooglePlaces={!!(import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY} required={false} />
                  <AddressNumberInput disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <AddressComplementInput disabled={isSubmitting} />
                  <NeighborhoodInput disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <CityInput disabled={isSubmitting} required={false} />
                  <StateSelector disabled={isSubmitting} />
                </div>
              </CardContent>
            </Card>

          {/* Professional Information */}
          <Card className="bg-transparent">
              <CardHeader>
                <CardTitle>Informações Profissionais</CardTitle>
                <CardDescription>Dados relacionados ao trabalho</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <PositionSelector control={form.control} disabled={isSubmitting} />
                  <SectorSelector disabled={isSubmitting} required={false} />
                </div>

                <SectorLeaderSwitch disabled={isSubmitting} />
              </CardContent>
            </Card>

          {/* Employment Status */}
          <Card className="bg-transparent">
              <CardHeader>
                <CardTitle>Status do Colaborador</CardTitle>
                <CardDescription>Defina o status atual do colaborador e as datas relacionadas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <UserStatusSelector disabled={isSubmitting} required />

                {/* Status-Specific Dates - Inline */}
                <StatusDatesSection disabled={isSubmitting} />
              </CardContent>
            </Card>

          {/* Manual Verification */}
          <Card className="bg-transparent">
              <CardHeader>
                <CardTitle>Verificação Manual</CardTitle>
                <CardDescription>Controle de verificação manual do usuário</CardDescription>
              </CardHeader>
              <CardContent>
                <VerifiedSwitch disabled={isSubmitting} />
              </CardContent>
            </Card>

          {/* PPE Sizes */}
          <PpeSizesSection disabled={isSubmitting} />

          {/* Hidden submit button that can be triggered by the header button */}
          <button id="user-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
            Submit
          </button>
        </form>
      </Form>
    </div>
  );
}
