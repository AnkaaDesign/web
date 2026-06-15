import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef } from "react";
import { IconUser, IconInfoCircle, IconFileText, IconMapPin, IconBriefcase, IconShieldCheck, IconReceipt2, IconUsersGroup, IconKey } from "@tabler/icons-react";
import { Form, FormField } from "@/components/ui/form";
import { FormSwitch } from "@/components/ui/form-switch";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { userCreateSchema, userUpdateSchema, type UserCreateFormData, type UserUpdateFormData } from "../../../../schemas";
import { CONTRACT_TYPE, EMPLOYEE_TYPE, CONTRACT_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import { useSector } from "../../../../hooks";
// Import all form components
import { NameInput } from "./name-input";
import { FormInput } from "@/components/ui/form-input";
import { BirthDateInput } from "./birth-date-input";
import { PositionSelector } from "./position-selector";
import { SectorSelector } from "./sector-selector";
import { SectorLeaderSwitch } from "./sector-leader-switch";
import { SecullumSyncSwitch } from "./secullum-sync-switch";
import { HorarioSelector } from "./horario-selector";
import { EmployeeTypeSelector, ContractTypeSelector, ContractStatusDisplay, ProviderFields } from "./status-selector";
import { VerifiedSwitch } from "./verified-switch";
import { ActiveSwitch } from "./active-switch";
import { StatusDatesSection } from "./status-dates-section";
import { FormAddressInput } from "@/components/ui/form-address-input";
import { FormAddressNumberInput } from "@/components/ui/form-address-number-input";
import { FormAddressComplementInput } from "@/components/ui/form-address-complement-input";
import { FormNeighborhoodInput } from "@/components/ui/form-neighborhood-input";
import { FormCityInput } from "@/components/ui/form-city-input";
import { FormStateSelector } from "@/components/ui/form-state-selector";
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
    phone: null,
    cpf: null as any,
    pis: null,
    verified: false,
    isActive: true,
    positionId: null as any, // required in schema; empty until the user selects
    performanceLevel: 0,
    sectorId: null as any, // required in schema; empty until the user selects
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
    birth: null as any, // Will be validated by schema when submitted

    // Current vínculo (EmploymentContract). The collaborator-create flow nests
    // these into `contract` on submit; the flat date fields below drive the
    // shared StatusDatesSection + admission date.
    // New CLT hires start in experiência: a FIXED_TERM modality in EXPERIENCE
    // status (efetivação later converts it to INDETERMINATE + ACTIVE).
    employeeType: EMPLOYEE_TYPE.CLT as any,
    contractType: CONTRACT_TYPE.FIXED_TERM as any,
    contractStatus: CONTRACT_STATUS.EXPERIENCE as any,
    unionMember: false,
    unionAuthorizationDate: null,
    dependentsCount: 0,
    hasSimplifiedDeduction: true,
    admissionDate: null as any,
    exp1StartAt: null as any,
    exp1EndAt: null,
    exp2StartAt: null,
    exp2EndAt: null,
    effectedAt: null,

    // Payroll info
    payrollNumber: null as any,

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

    // Default the "Criar no Secullum" switch ON so new collaborators sync to
    // Secullum on create. The operator can still uncheck it. Note: when enabled,
    // creation is blocked unless the chosen setor/cargo are mapped to a Secullum
    // departamento/função (validated server-side in validateSecullumPrerequisites).
    secullumSyncEnabled: true,

    ...defaultValues,
  };

  // Create a unified form that works for both modes
  const form = useForm({
    resolver: customResolver,
    defaultValues: mode === "create" ? createDefaults : (defaultValues || {} as any),
    mode: "onTouched", // Validate only after field is touched to avoid premature validation
    reValidateMode: "onChange", // After first validation, check on every change
    shouldFocusError: true, // Focus on first error field when validation fails
    criteriaMode: "all", // Show all errors for better UX
  });

  // Watch the worker category to drive the contract-type vs provider fields.
  const employeeType = useWatch({ control: form.control, name: "employeeType" as any }) as EMPLOYEE_TYPE | undefined;
  const isClt = !employeeType || employeeType === EMPLOYEE_TYPE.CLT;
  const isProvider = employeeType === EMPLOYEE_TYPE.TERCEIRIZADO || employeeType === EMPLOYEE_TYPE.PJ;

  // Union membership gates the authorization-date picker.
  const unionMember = useWatch({ control: form.control, name: "unionMember" as any }) as boolean | undefined;

  // Watch the selected sector to determine its privilege
  const selectedSectorId = useWatch({ control: form.control, name: "sectorId" });
  const { data: sectorResponse } = useSector(selectedSectorId || "", {
    enabled: !!selectedSectorId,
  });
  const sectorPrivilege = sectorResponse?.data?.privileges ?? null;

  // When sector changes and the new sector is NOT production, reset isSectorLeader to false
  const prevSectorIdRef = useRef(selectedSectorId);
  useEffect(() => {
    if (prevSectorIdRef.current !== selectedSectorId) {
      prevSectorIdRef.current = selectedSectorId;
      if (sectorPrivilege !== SECTOR_PRIVILEGES.PRODUCTION) {
        form.setValue("isSectorLeader", false, { shouldDirty: true });
      }
    }
  }, [selectedSectorId, sectorPrivilege, form]);

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

  // Dismissal is no longer set inline — the contract STATUS (ACTIVE/DISMISSED)
  // is driven by the termination flow and shown read-only. No sync effect needed.

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

  // Build the nested `contract` block for the collaborator-create payload from
  // the flat form fields, and route the admission date. The current vínculo is
  // created together with the user (server applies CLT/experiência defaults).
  const buildCreatePayload = (data: any): UserCreateFormData => {
    const { contractType, employeeType, contractStatus, exp1StartAt, providerName, providerCnpj, ...rest } = data;
    const admissionDate = exp1StartAt ?? data.admissionDate ?? null;
    const isOffPayroll = !!employeeType && employeeType !== EMPLOYEE_TYPE.CLT;
    return {
      ...rest,
      admissionDate,
      contract: {
        employeeType: employeeType ?? EMPLOYEE_TYPE.CLT,
        // Off-folha categories (TERCEIRIZADO/PJ/AUTÔNOMO) carry no legal modality.
        contractType: isOffPayroll ? null : (contractType ?? CONTRACT_TYPE.FIXED_TERM),
        contractStatus: contractStatus ?? CONTRACT_STATUS.EXPERIENCE,
        admissionDate,
        positionId: data.positionId ?? null,
        sectorId: data.sectorId ?? null,
        payrollNumber: data.payrollNumber ?? null,
        providerName: providerName ?? null,
        providerCnpj: providerCnpj ?? null,
      },
    } as UserCreateFormData;
  };

  const onSubmit = async (rawData: UserCreateFormData | UserUpdateFormData) => {
    try {
      const data = mode === "create" ? buildCreatePayload(rawData) : rawData;
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
            id: mode === "update" ? (defaultValues as any)?.id : undefined,
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
      <form id="user-form" onSubmit={form.handleSubmit(onSubmit)} className="container mx-auto max-w-4xl">
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
                <FormInput<UserCreateFormData | UserUpdateFormData> type="cpf" name="cpf" label="CPF" placeholder="Digite o CPF do colaborador" disabled={isSubmitting} required={mode === "create"} />
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
                <FormAddressInput<UserCreateFormData | UserUpdateFormData> name="address" disabled={isSubmitting} required={false} />
                <FormAddressNumberInput<UserCreateFormData | UserUpdateFormData> name="addressNumber" disabled={isSubmitting} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormAddressComplementInput<UserCreateFormData | UserUpdateFormData> name="addressComplement" disabled={isSubmitting} />
                <FormNeighborhoodInput<UserCreateFormData | UserUpdateFormData> name="neighborhood" disabled={isSubmitting} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormCityInput<UserCreateFormData | UserUpdateFormData> name="city" disabled={isSubmitting} required={false} />
                <FormStateSelector<UserCreateFormData | UserUpdateFormData> name="state" disabled={isSubmitting} />
              </div>
              <div className="grid grid-cols-1 gap-6">
                <FormInput<UserCreateFormData | UserUpdateFormData>
                  name="site"
                  type="text"
                  label="Site / Link"
                  placeholder="https://"
                  disabled={isSubmitting}
                  required={false}
                />
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
                <PositionSelector control={form.control} disabled={isSubmitting} required={mode === "create"} />
                <SectorSelector disabled={isSubmitting} required={mode === "create"} />
              </div>

              <SectorLeaderSwitch disabled={isSubmitting} sectorPrivilege={sectorPrivilege} />

              {/* Secullum integration toggle — provisions/syncs the funcionário */}
              <SecullumSyncSwitch
                disabled={isSubmitting}
                alreadyLinkedSecullumId={
                  (form.getValues() as { secullumEmployeeId?: number | null })
                    .secullumEmployeeId ?? null
                }
              />

              {/* Secullum Horário picker — only shows when sync switch is ON */}
              <HorarioSelector disabled={isSubmitting} />
            </CardContent>
          </Card>

          {/* Employment Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                Tipo de Contrato do Colaborador
              </CardTitle>
              <CardDescription>Defina a categoria, o vínculo atual do colaborador e as datas relacionadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EmployeeTypeSelector disabled={isSubmitting} required />
                {/* Tipo de contrato só se aplica a CLT */}
                {isClt && <ContractTypeSelector disabled={isSubmitting} required />}
              </div>

              {/* Prestador (terceirizado/PJ) */}
              {isProvider && <ProviderFields disabled={isSubmitting} namePath="providerName" cnpjPath="providerCnpj" />}

              {/* Situação do vínculo (somente leitura — definida pelo desligamento) */}
              {mode === "update" && <ContractStatusDisplay />}

              {/* Datas do período de experiência (apenas CLT) */}
              {isClt && <StatusDatesSection disabled={isSubmitting} />}

              {/* Data de admissão (não-CLT: sem período de experiência) */}
              {!isClt && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name={"exp1StartAt" as any}
                    render={({ field }) => (
                      <DateTimeInput
                        field={{
                          onChange: (d: any) => {
                            const date = d instanceof Date ? d : null;
                            field.onChange(date);
                            form.setValue("admissionDate" as any, date, { shouldValidate: true, shouldDirty: true });
                          },
                          onBlur: field.onBlur,
                          value: (field.value as Date | null) ?? null,
                          name: field.name,
                        }}
                        label={
                          <span className="flex items-center gap-1.5">
                            Data de Admissão
                            <span className="text-destructive ml-0.5">*</span>
                          </span>
                        }
                        disabled={isSubmitting}
                        mode="date"
                        required
                      />
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Folha de Pagamento / Encargos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconReceipt2 className="h-5 w-5 text-muted-foreground" />
                Folha e Encargos
              </CardTitle>
              <CardDescription>Configurações de sindicato e tributação para a folha de pagamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormSwitch<UserCreateFormData | UserUpdateFormData>
                name="unionMember"
                label="Sindicalizado"
                description="Colaborador é membro do sindicato (contribuição sindical em folha)"
                icon={<IconUsersGroup className="h-4 w-4 text-muted-foreground" />}
                disabled={isSubmitting}
              />

              {unionMember && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name={"unionAuthorizationDate" as any}
                    render={({ field }) => (
                      <DateTimeInput
                        field={{ onChange: field.onChange, onBlur: field.onBlur, value: (field.value as Date | null) ?? null, name: field.name }}
                        label="Data de Autorização Sindical"
                        disabled={isSubmitting}
                        mode="date"
                      />
                    )}
                  />
                </div>
              )}

              <FormSwitch<UserCreateFormData | UserUpdateFormData>
                name="hasSimplifiedDeduction"
                label="Desconto Simplificado (IRRF)"
                description="Aplica o desconto simplificado do IRRF em vez das deduções legais detalhadas"
                icon={<IconReceipt2 className="h-4 w-4 text-muted-foreground" />}
                disabled={isSubmitting}
              />
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
              {mode === "update" && (
                <FormSwitch<UserUpdateFormData>
                  name="requirePasswordChange"
                  label="Exigir Troca de Senha"
                  description="O colaborador deverá definir uma nova senha no próximo acesso"
                  icon={<IconKey className="h-4 w-4 text-muted-foreground" />}
                  disabled={isSubmitting}
                />
              )}
            </CardContent>
          </Card>

          {/* PPE Sizes */}
          <PpeSizesSection disabled={isSubmitting} />
        </div>
      </form>
    </Form>
  );
}
