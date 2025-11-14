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
      // Check if we have an avatar file to upload
      const avatarFile = (data as any).avatarFile || form.getValues('avatarFile' as any);

      console.log('[UserForm] onSubmit - avatarFile check:', {
        hasAvatarFile: !!avatarFile,
        isFile: avatarFile instanceof File,
        avatarFileType: avatarFile?.constructor?.name,
        fileName: avatarFile?.name,
        fileSize: avatarFile?.size,
        mode: mode,
        userName: data.name,
      });

      // If we have a file, create FormData with proper context
      if (avatarFile && avatarFile instanceof File) {
        console.log('[UserForm] Creating FormData with avatarFile:', {
          fileName: avatarFile.name,
          fileSize: avatarFile.size,
          fileType: avatarFile.type,
          userId: mode === "update" ? defaultValues?.id : undefined,
          userName: data.name,
        });
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

        console.log('[UserForm] FormData submission completed successfully');
      } else {
        console.log('[UserForm] No avatar file, sending as JSON');
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
    <div className="h-full overflow-y-auto p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Avatar Upload */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Foto de Perfil</CardTitle>
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
                  <BirthDateInput disabled={isSubmitting} required={mode === "create"} />
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

          {/* Access Control */}
          <Card className="bg-transparent">
              <CardHeader>
                <CardTitle>Controle de Acesso</CardTitle>
                <CardDescription>Configurações de acesso e verificação do usuário</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ActiveSwitch disabled={isSubmitting} />
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
