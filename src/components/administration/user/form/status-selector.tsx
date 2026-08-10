import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { IconBriefcase, IconUsers, IconCircleCheck, IconGavel } from "@tabler/icons-react";
import { FormCombobox } from "@/components/ui/form-combobox";
import { FormInput } from "@/components/ui/form-input";
import { FormCNPJInput } from "@/components/ui/form-cnpj-input";
import { useCnpjLookup } from "@/hooks/common/use-cnpj-lookup";
import {
  CONTRACT_TYPE,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS,
  CONTRACT_STATUS_LABELS,
  EMPLOYEE_TYPE,
  EMPLOYEE_TYPE_LABELS,
  TERMINATION_TYPE,
  TERMINATION_TYPE_LABELS,
} from "../../../../constants";

interface SelectorProps {
  disabled?: boolean;
  required?: boolean;
}

/**
 * Worker CATEGORY selector (CLT / Estágio / Terceirizado / PJ / Autônomo).
 * Drives whether the contract-type and provider fields are shown.
 */
export function EmployeeTypeSelector({ disabled = false, required = true }: SelectorProps) {
  const options = useMemo(
    () =>
      Object.values(EMPLOYEE_TYPE).map((value) => ({
        value,
        label: EMPLOYEE_TYPE_LABELS[value] || value,
      })),
    [],
  );

  return (
    <FormCombobox
      name="employeeType"
      label="Categoria do Colaborador"
      icon={<IconUsers className="h-4 w-4" />}
      options={options}
      disabled={disabled}
      required={required}
      placeholder="Selecione a categoria"
    />
  );
}

/**
 * Contract-TYPE selector (Experiência / Efetivado / ...). Only meaningful for
 * CLT collaborators — callers should hide it for PJ / etc.
 */
export function ContractTypeSelector({ disabled = false, required = true }: SelectorProps) {
  const options = useMemo(
    () =>
      Object.values(CONTRACT_TYPE).map((value) => ({
        value,
        label: CONTRACT_TYPE_LABELS[value] || value,
      })),
    [],
  );

  return (
    <FormCombobox
      name="contractType"
      label="Tipo de Contrato"
      icon={<IconBriefcase className="h-4 w-4" />}
      options={options}
      disabled={disabled}
      required={required}
      placeholder="Selecione o tipo de contrato"
    />
  );
}

/**
 * Provider (prestador) fields shown for PJ contracts.
 * Bound to the nested `contract.providerName` / `contract.providerCnpj`.
 */
export function ProviderFields({
  disabled = false,
  namePath = "contract.providerName",
  cnpjPath = "contract.providerCnpj",
}: {
  disabled?: boolean;
  namePath?: string;
  cnpjPath?: string;
}) {
  const form = useFormContext();
  // Autocomplete: a complete CNPJ looks up the company and fills the Razão Social
  // (same Brasil API lookup the supplier/customer forms use).
  const { lookupCnpj } = useCnpjLookup({
    onSuccess: (data) => {
      form.setValue(namePath as any, data.corporateName, { shouldDirty: true, shouldValidate: true });
    },
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormCNPJInput name={cnpjPath as any} label="CNPJ" onComplete={lookupCnpj} disabled={disabled} />
      <FormInput name={namePath as any} label="Razão Social" placeholder="Razão social da empresa" disabled={disabled} />
    </div>
  );
}

/**
 * Current contract STATUS (Ativo / Desligado).
 *
 * ACTIVE → TERMINATED is the ONLY transition the lifecycle machine allows
 * (`CONTRACT_STATUS_TRANSITIONS` on the API: TERMINATED is terminal). So the
 * field is a picker only while the vínculo is still active; once desligado it
 * renders read-only, because offering "Ativo" there would just buy the operator
 * a 400 ("Transição de situação inválida"). Re-hiring is a NEW vínculo, not a
 * revival of this one.
 *
 * Selecting "Desligado" reveals the Data de Demissão + Tipo de Demissão fields
 * (see <DismissalDateInput /> and <TerminationTypeSelector />), both required by
 * userUpdateSchema before the save is allowed.
 */
export function ContractStatusField({ disabled = false }: { disabled?: boolean }) {
  const { control } = useFormContext();
  const status = (useWatch({ control, name: "contractStatus" }) as CONTRACT_STATUS | undefined) ?? CONTRACT_STATUS.ACTIVE;
  // The status the vínculo had when the form was loaded — an already-desligado
  // vínculo is terminal and must not be editable back to Ativo.
  const persistedStatus = useWatch({ control, name: "currentContractStatus" }) as CONTRACT_STATUS | undefined;
  const alreadyTerminated = persistedStatus === CONTRACT_STATUS.TERMINATED;

  const options = useMemo(
    () =>
      Object.values(CONTRACT_STATUS).map((value) => ({
        value,
        label: CONTRACT_STATUS_LABELS[value] || value,
      })),
    [],
  );

  if (alreadyTerminated) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCircleCheck className="h-4 w-4" />
          Situação do Vínculo
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">{CONTRACT_STATUS_LABELS[status] || status}</div>
        <p className="text-xs text-muted-foreground">Vínculo encerrado. Para recontratar, registre um novo vínculo — a data e o tipo da demissão abaixo ainda podem ser corrigidos.</p>
      </div>
    );
  }

  return (
    <FormCombobox
      name="contractStatus"
      label="Situação do Vínculo"
      icon={<IconCircleCheck className="h-4 w-4" />}
      options={options}
      disabled={disabled}
      required
      searchable={false}
      placeholder="Selecione a situação"
      description="Marcar como Desligado encerra o vínculo, revoga o acesso e sincroniza a demissão com o Secullum."
    />
  );
}

/**
 * Termination TYPE of the current vínculo (EmploymentContract.terminationType).
 * Required when the desligamento is being registered here — it is the legal
 * nature of the rescisão and drives the verbas na rescisão.
 */
export function TerminationTypeSelector({ disabled = false, required = true }: SelectorProps) {
  const options = useMemo(
    () =>
      Object.values(TERMINATION_TYPE).map((value) => ({
        value,
        label: TERMINATION_TYPE_LABELS[value] || value,
      })),
    [],
  );

  return (
    <FormCombobox
      name="terminationType"
      label="Tipo de Demissão"
      icon={<IconGavel className="h-4 w-4" />}
      options={options}
      disabled={disabled}
      required={required}
      placeholder="Selecione o tipo de demissão"
    />
  );
}
