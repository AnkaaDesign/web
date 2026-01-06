import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef } from "react";
import { IconUser, IconInfoCircle, IconFileText, IconMapPin, IconBriefcase, IconShieldCheck, IconShirt } from "@tabler/icons-react";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { userCreateSchema, userUpdateSchema, type UserCreateFormData, type UserUpdateFormData } from "../../../../schemas";
import { USER_STATUS } from "../../../../constants";
import { formatDateTime } from "../../../../utils/date";

// Import all form components
import { NameInput } from "./name-input";
import { FormInput } from "@/components/ui/form-input";
import { DismissalDateInput } from "./dismissal-date-input";
import { BirthDateInput } from "./birth-date-input";
import { PositionSelector } from "./position-selector";
import { SectorSelector } from "./sector-selector";
import { SectorLeaderSwitch } from "./sector-leader-switch";
import { UserStatusSelector } from "./status-selector";
import { VerifiedSwitch } from "./verified-switch";
import { ActiveSwitch } from "./active-switch";
import { StatusDatesSection } from "./status-dates-section";
import { AddressInput } from "@/components/ui/form-address-input";
import { AddressNumberInput } from "@/components/ui/form-address-number-input";
import { AddressComplementInput } from "@/components/ui/form-address-complement-input";
import { NeighborhoodInput } from "@/components/ui/form-neighborhood-input";
import { CityInput } from "@/components/ui/form-city-input";
import { StateSelector } from "@/components/ui/form-state-selector";
import { PayrollNumberInput } from "./payroll-number-input";
import { PpeSizesSection } from "./ppe-sizes-section";
import { AvatarInput } from "./avatar-input";
import { createUserFormData } from "@/utils/form-data-helper";

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
    isActive: true,
    positionId: null,
    performanceLevel: 0,
    sectorId: null,
    isSectorLeader: false, // New field: indicates if user should be set as manager of selected sector

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

    // Status tracking dates
    exp1StartAt: null,
    exp1EndAt: null,
    exp2StartAt: null,
    exp2EndAt: null,
    effectedAt: null,
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

    // Avatar
    avatarId: null,

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
      isActive: true,
      positionId: null,
      performanceLevel: 0,
      sectorId: null,
      isSectorLeader: false,
      address: null,
      addressNumber: null,
      addressComplement: null,
      neighborhood: null,
      city: null,
      state: null,
      zipCode: null,
      site: null,
      birth: null,
      exp1StartAt: null,
      exp1EndAt: null,
      exp2StartAt: null,
      exp2EndAt: null,
      effectedAt: null,
      dismissedAt: null,
      payrollNumber: null,
      avatarId: null,
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
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (mode === "update" && defaultValues) {
      // Always reset when defaultValues are provided
      // This ensures form fields are properly populated, including nested fields like ppeSize
      form.reset(defaultValues, {
        keepDefaultValues: false,
        keepDirty: false,
        keepTouched: false,
      });

      // Mark that we've completed initial mount
      isInitialMountRef.current = false;
    }
  }, [defaultValues, form, mode]);

  // Access formState properties during render for proper subscription
  const { isValid, isDirty, errors } = form.formState;

  // Auto-sync dismissal date and status to prevent validation errors
  useEffect(() => {
    if (mode === "update") {
      const subscription = form.watch((value, { name }) => {
        // If dismissal date is set and status is not DISMISSED, auto-set status to DISMISSED
        if (name === "dismissedAt" && value.dismissedAt && value.status !== USER_STATUS.DISMISSED) {
          form.setValue("status", USER_STATUS.DISMISSED, { shouldDirty: true, shouldValidate: true });
        }
        // If dismissal date is cleared and status is DISMISSED, clear status
        if (name === "dismissedAt" && !value.dismissedAt && value.status === USER_STATUS.DISMISSED) {
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

  // Debug validation errors in development - only log on user interaction
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      if (process.env.NODE_ENV === "development") {
        console.warn("[UserForm] Form state:", {
          isValid,
          isDirty,
          hasErrors: Object.keys(errors).length > 0,
          errors: Object.keys(errors).length > 0 ? errors : undefined,
          errorFields: Object.keys(errors),
          dirtyFields: Object.keys(form.formState.dirtyFields),
          touchedFields: Object.keys(form.formState.touchedFields),
        });
      }
    }
  }, [errors, isValid, isDirty, form.formState.dirtyFields, form.formState.touchedFields]);

  // One-time validation check on mount
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && mode === "update") {
      if (process.env.NODE_ENV === "development") {
        const timer = setTimeout(() => {
          form.trigger().then((result) => {
            console.warn("[UserForm] Initial validation result:", result, "errors:", form.formState.errors);
          });
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

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
      // Check if we have an avatar file to upload
      const avatarFile = (data as any).avatarFile || form.getValues('avatarFile' as any);

      // If we have a file, create FormData with proper context
      if (avatarFile && avatarFile instanceof File) {
        // Extract avatarFile from data and prepare clean data object
        const { avatarFile: _, ...dataWithoutFile } = data as any;

        // Create FormData with proper context for file organization
        const formData = createUserFormData(
          dataWithoutFile,
          avatarFile,
          {
            id: mode === "update" ? defaultValues?.id : undefined,
            name: data.name,
          }
        );

        if (mode === "create") {
          await (props as CreateUserFormProps).onSubmit(formData as any);
        } else {
          await (props as UpdateUserFormProps).onSubmit(formData as any);
        }
      } else {
        // No file, send as regular JSON (remove avatarFile field if present)
        const { avatarFile: _, ...dataWithoutFile } = data as any;

        if (mode === "create") {
          await (props as CreateUserFormProps).onSubmit(dataWithoutFile as UserCreateFormData);
        } else {
          await (props as UpdateUserFormProps).onSubmit(dataWithoutFile as UserUpdateFormData);
        }
      }
    } catch (error) {
      // Error is handled by the parent component
    }
  };

  return (
    <Form {...form}>
      <form id="user-form" onSubmit={form.handleSubmit(onSubmit)}>
        {/* Hidden submit button for programmatic form submission */}
        <button id="user-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
          Submit
        </button>

        {/* Wrapper div with space-y-4 for card spacing */}
        <div className="space-y-4">
          {/* Avatar Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconUser className="h-5 w-5 text-muted-foreground" />
                Foto de Perfil
              </CardTitle>
              <CardDescription>Foto do colaborador</CardDescription>
            </CardHeader>
            <CardContent>
              <AvatarInput
                disabled={isSubmitting}
                existingAvatarId={defaultValues?.avatarId}
              />
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                Informações Básicas
              </CardTitle>
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
                <BirthDateInput disabled={isSubmitting} required={mode === "create"} />
                <PayrollNumberInput disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconFileText className="h-5 w-5 text-muted-foreground" />
                Documentos
              </CardTitle>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconMapPin className="h-5 w-5 text-muted-foreground" />
                Endereço
              </CardTitle>
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
                <AddressInput disabled={isSubmitting} required={false} />
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBriefcase className="h-5 w-5 text-muted-foreground" />
                Informações Profissionais
              </CardTitle>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                Status do Colaborador
              </CardTitle>
              <CardDescription>Defina o status atual do colaborador e as datas relacionadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <UserStatusSelector disabled={isSubmitting} required />

              {/* Status-Specific Dates - Inline */}
              <StatusDatesSection disabled={isSubmitting} />
            </CardContent>
          </Card>

          {/* Access Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconShieldCheck className="h-5 w-5 text-muted-foreground" />
                Controle de Acesso
              </CardTitle>
              <CardDescription>Configurações de acesso e verificação do usuário</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActiveSwitch disabled={isSubmitting} />
              <VerifiedSwitch disabled={isSubmitting} />
            </CardContent>
          </Card>

          {/* PPE Sizes */}
          <PpeSizesSection disabled={isSubmitting} />
        </div>
      </form>
    </Form>
  );
}
