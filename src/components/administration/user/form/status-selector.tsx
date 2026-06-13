import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { IconBriefcase, IconUsers, IconCircleCheck } from "@tabler/icons-react";
import { FormCombobox } from "@/components/ui/form-combobox";
import { FormInput } from "@/components/ui/form-input";
import {
  CONTRACT_TYPE,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS,
  CONTRACT_STATUS_LABELS,
  EMPLOYEE_TYPE,
  EMPLOYEE_TYPE_LABELS,
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
 * CLT collaborators — callers should hide it for TERCEIRIZADO / PJ / etc.
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
 * Provider (prestador) fields shown for TERCEIRIZADO / PJ contracts.
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormInput name={namePath as any} label="Empresa / Prestador" placeholder="Nome da empresa prestadora" disabled={disabled} />
      <FormInput name={cnpjPath as any} label="CNPJ do Prestador" placeholder="CNPJ" disabled={disabled} />
    </div>
  );
}

/**
 * Current contract STATUS (Ativo / Desligado). Read-only — driven by the
 * termination flow, not directly editable here.
 */
export function ContractStatusDisplay() {
  const { control } = useFormContext();
  const status = (useWatch({ control, name: "contractStatus" }) as CONTRACT_STATUS | undefined) ?? CONTRACT_STATUS.ACTIVE;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <IconCircleCheck className="h-4 w-4" />
        Situação do Vínculo
      </div>
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">{CONTRACT_STATUS_LABELS[status] || status}</div>
      <p className="text-xs text-muted-foreground">A situação é definida pelo processo de desligamento.</p>
    </div>
  );
}
