// admission-new-user-form.tsx
// "Cadastro de colaborador" — the SOLE admission create form.
//
// The admission form IS the collaborator registration: it composes the SAME
// field components used by the administração collaborator create form
// (components/administration/user/form/*), plus:
//   - a CPF auto-detect that creates a NEW vínculo for an existing person
//     (rehire) instead of duplicating them,
//   - a "Documentos" upload section (CPF, RG, CTPS, ASO, contrato, LGPD…) wired
//     into the create payload as `documents: [{ type, fileId }]`,
//   - contract fields (employeeType / contractType / provider) bound to the
//     nested `contract` block.
// On submit it maps the flat form values to the POST /admissions payload
// `{ user? | userId, contract, documents, hireDate, notes }`.

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconInfoCircle, IconFileText, IconMapPin, IconBriefcase, IconShieldCheck, IconUserPlus, IconUserCheck } from "@tabler/icons-react";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormInput } from "@/components/ui/form-input";
import { FormAddressInput } from "@/components/ui/form-address-input";
import { FormAddressNumberInput } from "@/components/ui/form-address-number-input";
import { FormAddressComplementInput } from "@/components/ui/form-address-complement-input";
import { FormNeighborhoodInput } from "@/components/ui/form-neighborhood-input";
import { FormCityInput } from "@/components/ui/form-city-input";
import { FormStateSelector } from "@/components/ui/form-state-selector";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";

import { NameInput } from "@/components/administration/user/form/name-input";
import { BirthDateInput } from "@/components/administration/user/form/birth-date-input";
import { PayrollNumberInput } from "@/components/administration/user/form/payroll-number-input";
import { PositionSelector } from "@/components/administration/user/form/position-selector";
import { SectorSelector } from "@/components/administration/user/form/sector-selector";
import { SectorLeaderSwitch } from "@/components/administration/user/form/sector-leader-switch";
import { SecullumSyncSwitch } from "@/components/administration/user/form/secullum-sync-switch";
import { HorarioSelector } from "@/components/administration/user/form/horario-selector";
import { EmployeeTypeSelector, ContractTypeSelector, ProviderFields } from "@/components/administration/user/form/status-selector";
import { StatusDatesSection } from "@/components/administration/user/form/status-dates-section";
import { VerifiedSwitch } from "@/components/administration/user/form/verified-switch";
import { PpeSizesSection } from "@/components/administration/user/form/ppe-sizes-section";

import { admissionCollaboratorFormSchema } from "../../../../schemas/admission";
import type { AdmissionCreateFormData, AdmissionCollaboratorFormData } from "../../../../schemas/admission";
import { CONTRACT_TYPE, CONTRACT_STATUS, EMPLOYEE_TYPE, SECTOR_PRIVILEGES, ADMISSION_DOCUMENT_TYPE, ADMISSION_DOCUMENT_TYPE_LABELS, ADMISSION_DOCUMENT_STATUS } from "../../../../constants";
import { ADMISSION_CHECKLIST_DOC_TYPES } from "../utils";
import { useSector } from "../../../../hooks";
import { useAdmissionByUser } from "../../../../hooks/personnel-department/use-admissions";
import { getUsers } from "../../../../api-client";
import { uploadSingleFile } from "../../../../api-client/file";
import { useDebouncedValue } from "@/hooks/common/use-debounced-value";
import { cleanCPF } from "../../../../utils/cleaners";
import type { User } from "../../../../types";

interface AdmissionNewUserFormProps {
  onSubmit: (data: AdmissionCreateFormData) => Promise<void>;
  isSubmitting?: boolean;
}

// Documentos exibidos no cadastro da admissão (mesma fonte que o checklist do
// detalhe). Obrigatórios: CPF, CTPS e RG OU CNH; os demais são opcionais. Tudo
// que não está aqui pertence ao colaborador, não à admissão.
const DOCUMENT_CHECKLIST: ADMISSION_DOCUMENT_TYPE[] = ADMISSION_CHECKLIST_DOC_TYPES;

export function AdmissionNewUserForm({ onSubmit, isSubmitting }: AdmissionNewUserFormProps) {
  // Pending document uploads keyed by document type. Files are uploaded to get
  // a fileId only at submit time, then sent inline as documents[].
  const [docFiles, setDocFiles] = useState<Partial<Record<ADMISSION_DOCUMENT_TYPE, File>>>({});
  // The existing person detected by CPF (rehire path). When set, the form
  // submits `userId` instead of a full `user` payload.
  const [matchedUser, setMatchedUser] = useState<User | null>(null);

  const form = useForm<AdmissionCollaboratorFormData>({
    resolver: zodResolver(admissionCollaboratorFormSchema),
    defaultValues: {
      name: "",
      email: null,
      employeeType: EMPLOYEE_TYPE.CLT,
      // Default: novo colaborador inicia em experiência (EXPERIENCE_PERIOD_1) com
      // status ACTIVE — a efetivação posterior converte a modalidade em INDETERMINATE.
      contractType: CONTRACT_TYPE.EXPERIENCE_PERIOD_1,
      contractStatus: CONTRACT_STATUS.ACTIVE,
      phone: null,
      cpf: null as any,
      pis: null,
      verified: false,
      positionId: null as any,
      performanceLevel: 0,
      sectorId: null as any,
      isSectorLeader: false,

      address: null,
      addressNumber: null,
      addressComplement: null,
      neighborhood: null,
      city: null,
      state: null,
      zipCode: null,
      site: null,

      birth: null as any,

      admissionDate: null as any,
      exp1StartAt: null as any,
      exp1EndAt: null,
      exp2StartAt: null,
      exp2EndAt: null,
      effectedAt: null,
      providerName: null,
      providerCnpj: null,

      payrollNumber: null as any,

      ppeSize: {
        shirts: null,
        boots: null,
        pants: null,
        sleeves: null,
        mask: null,
        gloves: null,
        rainBoots: null,
      },

      avatarId: null,
      secullumSyncEnabled: true,

      notes: null,
    } as any,
    mode: "onTouched",
    reValidateMode: "onChange",
    shouldFocusError: true,
    criteriaMode: "all",
  });

  // Sector privilege drives the leader switch (PRODUCTION only).
  const selectedSectorId = useWatch({ control: form.control, name: "sectorId" });
  const { data: sectorResponse } = useSector(selectedSectorId || "", { enabled: !!selectedSectorId });
  const sectorPrivilege = sectorResponse?.data?.privileges ?? null;

  const prevSectorIdRef = useRef(selectedSectorId);
  useEffect(() => {
    if (prevSectorIdRef.current !== selectedSectorId) {
      prevSectorIdRef.current = selectedSectorId;
      if (sectorPrivilege !== SECTOR_PRIVILEGES.PRODUCTION) {
        form.setValue("isSectorLeader", false, { shouldDirty: true });
      }
    }
  }, [selectedSectorId, sectorPrivilege, form]);

  // Worker category drives the contract-type / provider fields.
  const employeeType = useWatch({ control: form.control, name: "employeeType" as any }) as EMPLOYEE_TYPE | undefined;
  const isClt = !employeeType || employeeType === EMPLOYEE_TYPE.CLT;
  const isProvider = employeeType === EMPLOYEE_TYPE.TERCEIRIZADO || employeeType === EMPLOYEE_TYPE.PJ;

  // ----- CPF auto-detect (rehire path) -----
  const cpfValue = useWatch({ control: form.control, name: "cpf" as any }) as string | null | undefined;
  const debouncedCpf = useDebouncedValue(cpfValue ?? "", 500);

  useEffect(() => {
    let cancelled = false;
    const cleaned = cleanCPF(debouncedCpf || "");
    if (cleaned.length !== 11) {
      setMatchedUser(null);
      return;
    }
    (async () => {
      try {
        const response = await getUsers({
          where: { cpf: cleaned } as any,
          take: 1,
          include: { position: true, sector: true },
        } as any);
        if (cancelled) return;
        const found = (response.data || [])[0] as User | undefined;
        setMatchedUser(found ?? null);
      } catch {
        if (!cancelled) setMatchedUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedCpf]);

  // Personal fields prefilled from a matched person (and cleared when the match
  // goes away). Identity fields default to "" (text inputs), the rest to null.
  const prevMatchedIdRef = useRef<string | null>(null);

  // Prefill ALL editable fields when an existing person is detected, and CLEAR
  // them when the CPF stops matching (so a different person doesn't keep stale
  // data). Fields stay EDITABLE — corrections are detected via dirtyFields and
  // sent back as a `userUpdate` patch. Prefill is non-dirty so untouched values
  // are NOT re-sent.
  useEffect(() => {
    const apply = (values: Record<string, unknown>) => {
      for (const [field, value] of Object.entries(values)) {
        form.setValue(field as any, value as any, { shouldValidate: false, shouldDirty: false });
      }
    };

    if (matchedUser) {
      const m = matchedUser as any;
      // Always set EVERY field (including empty), so switching between two
      // existing people replaces the previous person's data cleanly.
      apply({
        name: m.name ?? "",
        email: m.email ?? null,
        phone: m.phone ?? null,
        pis: m.pis ?? null,
        birth: m.birth ? new Date(m.birth) : null,
        address: m.address ?? null,
        addressNumber: m.addressNumber ?? null,
        addressComplement: m.addressComplement ?? null,
        neighborhood: m.neighborhood ?? null,
        city: m.city ?? null,
        state: m.state ?? null,
        zipCode: m.zipCode ?? null,
        site: m.site ?? null,
        positionId: m.positionId ?? null,
        sectorId: m.sectorId ?? null,
      });
      prevMatchedIdRef.current = m.id;
    } else if (prevMatchedIdRef.current) {
      // The CPF no longer matches a previously-detected person → clear the
      // prefilled data so the form is blank for a NEW person. (Untouched fresh
      // input is preserved because this only fires after a real match cleared.)
      apply({
        name: "",
        email: null,
        phone: null,
        pis: null,
        birth: null,
        address: null,
        addressNumber: null,
        addressComplement: null,
        neighborhood: null,
        city: null,
        state: null,
        zipCode: null,
        site: null,
        positionId: null,
        sectorId: null,
      });
      prevMatchedIdRef.current = null;
    }
  }, [matchedUser, form]);

  const submitting = isSubmitting || form.formState.isSubmitting;

  const matchedUserMeta = useMemo(() => {
    if (!matchedUser) return null;
    return [matchedUser.position?.name, matchedUser.sector?.name].filter(Boolean).join(" · ");
  }, [matchedUser]);

  // Re-engajamento (CPF já existente, não-prestador): mostra os documentos que a
  // pessoa JÁ tem na admissão anterior — eles são reaproveitados no servidor, então
  // não precisam ser reenviados.
  const { data: matchedAdmissionResp } = useAdmissionByUser(
    matchedUser?.id,
    { include: { documents: true } },
    { enabled: !!matchedUser && !isProvider },
  );
  const alreadyReceivedDocLabels = useMemo(() => {
    const docs = (matchedAdmissionResp?.data?.documents ?? []) as Array<{ type: string; status: string; fileId?: string | null }>;
    return docs
      .filter((d) => d.fileId && (d.status === ADMISSION_DOCUMENT_STATUS.RECEIVED || d.status === ADMISSION_DOCUMENT_STATUS.SIGNED))
      .map((d) => ADMISSION_DOCUMENT_TYPE_LABELS[d.type as ADMISSION_DOCUMENT_TYPE] || d.type);
  }, [matchedAdmissionResp]);

  const handleSubmit = async (data: AdmissionCollaboratorFormData) => {
    try {
      const { notes, employeeType: et, contractType: ct, exp1StartAt, providerName, providerCnpj, ...userData } =
        data as AdmissionCollaboratorFormData & Record<string, any>;

      const admissionDate = (exp1StartAt as Date | null) ?? (userData.admissionDate as Date | null) ?? null;

      // Upload pending document files → fileIds. Providers (terceirizado/PJ)
      // skip the document checklist entirely, so don't send any attachments.
      const documents: Array<{ type: ADMISSION_DOCUMENT_TYPE; fileId: string }> = [];
      for (const type of isProvider ? [] : (Object.keys(docFiles) as ADMISSION_DOCUMENT_TYPE[])) {
        const file = docFiles[type];
        if (!file) continue;
        const res = await uploadSingleFile(file, { fileContext: "admissionDocument" } as any);
        if (res?.data?.id) {
          documents.push({ type, fileId: res.data.id });
        }
      }

      const contract = {
        employeeType: et ?? EMPLOYEE_TYPE.CLT,
        contractType: et && et !== EMPLOYEE_TYPE.CLT ? null : ((ct as CONTRACT_TYPE) ?? CONTRACT_TYPE.EXPERIENCE_PERIOD_1),
        admissionDate,
        positionId: (userData.positionId as string) ?? null,
        sectorId: (userData.sectorId as string) ?? null,
        payrollNumber: (userData.payrollNumber as number) ?? null,
        providerName: (providerName as string) ?? null,
        providerCnpj: (providerCnpj as string) ?? null,
      };

      // Recontratação: além de anexar um NOVO vínculo à pessoa existente, envia
      // as CORREÇÕES de cadastro (campos pessoais que o usuário editou no
      // formulário) como `userUpdate` — o servidor atualiza a pessoa, sem
      // duplicá-la. Apenas campos sujos (dirty) são enviados.
      const PERSONAL_FIELDS = [
        "name", "email", "phone", "pis", "birth",
        "address", "addressNumber", "addressComplement", "neighborhood", "city", "state", "zipCode", "site",
      ] as const;
      let userUpdate: Record<string, unknown> | undefined;
      if (matchedUser) {
        const dirty = form.formState.dirtyFields as Record<string, unknown>;
        const patch: Record<string, unknown> = {};
        for (const field of PERSONAL_FIELDS) {
          if (dirty[field]) patch[field] = (data as any)[field] ?? null;
        }
        if (Object.keys(patch).length > 0) userUpdate = patch;
      }

      const payload: AdmissionCreateFormData = matchedUser
        ? ({
            // Rehire: attach a NEW vínculo to the existing person (+ optional
            // personal-data corrections via userUpdate).
            userId: matchedUser.id,
            ...(userUpdate ? { userUpdate } : {}),
            contract,
            documents: documents.length ? documents : undefined,
            hireDate: admissionDate,
            notes: notes ?? null,
          } as AdmissionCreateFormData)
        : ({
            // New person: create user + vínculo + admissão in one transaction.
            user: { ...userData, admissionDate, contract } as any,
            contract,
            documents: documents.length ? documents : undefined,
            hireDate: admissionDate,
            notes: notes ?? null,
          } as AdmissionCreateFormData);

      await onSubmit(payload);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting admission (collaborator) form:", error);
      }
    }
  };

  return (
    <Form {...form}>
      <form id="admission-form" onSubmit={form.handleSubmit(handleSubmit)} className="w-full">
        <button id="admission-form-submit" type="submit" className="hidden" disabled={submitting} />

        <div className="space-y-4">
          {/* Documents / Identity (CPF first so auto-detect can fire early) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconFileText className="h-5 w-5 text-muted-foreground" />
                Identificação
              </CardTitle>
              <CardDescription>Informe o CPF — se a pessoa já estiver cadastrada, um novo vínculo será criado para ela.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput<AdmissionCollaboratorFormData> type="cpf" name="cpf" label="CPF" placeholder="Digite o CPF do colaborador" disabled={submitting} required />
                <FormInput<AdmissionCollaboratorFormData> type="pis" name="pis" label="PIS" disabled={submitting} />
              </div>

              {matchedUser && (
                <div className="flex items-center justify-between gap-4 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <IconUserCheck className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">Pessoa já cadastrada — {matchedUser.name}. Os dados foram preenchidos; ajuste o que precisar (as alterações atualizam o cadastro) e um novo vínculo será criado.</p>
                      {matchedUserMeta && <p className="text-xs text-muted-foreground truncate">{matchedUserMeta}</p>}
                      {alreadyReceivedDocLabels.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Documentos já recebidos (não é necessário reenviar): {alreadyReceivedDocLabels.join(", ")}.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                <NameInput disabled={submitting} />
                <FormInput<AdmissionCollaboratorFormData>
                  name="email"
                  type="email"
                  label="E-mail"
                  placeholder="Digite o e-mail do colaborador"
                  disabled={submitting}
                  required={!form.watch("phone") && !matchedUser}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormInput<AdmissionCollaboratorFormData>
                  name="phone"
                  type="phone"
                  label="Telefone"
                  placeholder="Digite o telefone do colaborador"
                  disabled={submitting}
                  required={false}
                />
                <BirthDateInput disabled={submitting} required={!matchedUser} />
                <PayrollNumberInput disabled={submitting} />
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
                <FormInput<AdmissionCollaboratorFormData>
                  type="cep"
                  name="zipCode"
                  label="CEP"
                  disabled={submitting}
                  addressFieldName="address"
                  neighborhoodFieldName="neighborhood"
                  cityFieldName="city"
                  stateFieldName="state"
                />
                <FormAddressInput<AdmissionCollaboratorFormData> name="address" disabled={submitting} required={false} />
                <FormAddressNumberInput<AdmissionCollaboratorFormData> name="addressNumber" disabled={submitting} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormAddressComplementInput<AdmissionCollaboratorFormData> name="addressComplement" disabled={submitting} />
                <FormNeighborhoodInput<AdmissionCollaboratorFormData> name="neighborhood" disabled={submitting} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormCityInput<AdmissionCollaboratorFormData> name="city" disabled={submitting} required={false} />
                <FormStateSelector<AdmissionCollaboratorFormData> name="state" disabled={submitting} />
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
                <PositionSelector control={form.control} disabled={submitting} required={!isProvider} />
                <SectorSelector disabled={submitting} required />
              </div>

              <SectorLeaderSwitch disabled={submitting} sectorPrivilege={sectorPrivilege} />
              <SecullumSyncSwitch disabled={submitting} alreadyLinkedSecullumId={null} />
              <HorarioSelector disabled={submitting} />
            </CardContent>
          </Card>

          {/* Vínculo (contract) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                Vínculo do Colaborador
              </CardTitle>
              <CardDescription>Categoria, tipo de contrato e data de admissão</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isClt ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <EmployeeTypeSelector disabled={submitting} required />
                    <ContractTypeSelector disabled={submitting} required />
                  </div>
                  <StatusDatesSection disabled={submitting} />
                </>
              ) : (
                <>
                  {/* Off-payroll: Categoria + Data de Admissão lado a lado. */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <EmployeeTypeSelector disabled={submitting} required />
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
                          disabled={submitting}
                          mode="date"
                          required
                        />
                      )}
                    />
                  </div>
                  {isProvider && <ProviderFields disabled={submitting} namePath="providerName" cnpjPath="providerCnpj" />}
                </>
              )}
            </CardContent>
          </Card>

          {/* Documentos — skipped for off-payroll providers (terceirizado/PJ),
              who don't submit the standard CLT admission document checklist. */}
          {!isProvider && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconFileText className="h-5 w-5 text-muted-foreground" />
                  Documentos
                </CardTitle>
                <CardDescription>Anexe os documentos do colaborador. Os arquivos serão vinculados à admissão ao salvar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {DOCUMENT_CHECKLIST.map((type) => (
                    <div key={type} className="space-y-1.5">
                      <div className="text-sm font-medium">{ADMISSION_DOCUMENT_TYPE_LABELS[type]}</div>
                      <FileUploadField
                        variant="compact"
                        maxFiles={1}
                        disabled={submitting}
                        placeholder={`Anexar ${ADMISSION_DOCUMENT_TYPE_LABELS[type]}`}
                        onFilesChange={(files: FileWithPreview[]) => {
                          const file = (files[0] as unknown as File) ?? null;
                          setDocFiles((prev) => {
                            const next = { ...prev };
                            if (file) next[type] = file;
                            else delete next[type];
                            return next;
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
              <VerifiedSwitch disabled={submitting} />
            </CardContent>
          </Card>

          {/* PPE Sizes */}
          <PpeSizesSection disabled={submitting} />

          {/* Admission process */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconUserPlus className="h-5 w-5 text-muted-foreground" />
                Processo de Admissão
              </CardTitle>
              <CardDescription>O checklist completo de documentos é gerado automaticamente; os arquivos anexados acima são vinculados ao processo.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <IconFileText className="h-4 w-4" />
                        Observações
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        value={(field.value as string | null) ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                        disabled={submitting}
                        placeholder="Observações sobre o processo de admissão (opcional)"
                        rows={4}
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
    </Form>
  );
}
