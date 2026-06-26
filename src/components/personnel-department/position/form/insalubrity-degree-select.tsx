import { useMemo } from "react";

import { INSALUBRITY_DEGREE, INSALUBRITY_DEGREE_LABELS } from "../../../../constants";

import { FormCombobox } from "@/components/ui/form-combobox";

interface InsalubrityDegreeSelectProps {
  disabled?: boolean;
}

/**
 * Insalubridade (NR-15): grau que define o adicional (% sobre salário-mínimo).
 * Default NONE. Mutuamente exclusivo com periculosidade (validado no service).
 */
export function InsalubrityDegreeSelect({ disabled }: InsalubrityDegreeSelectProps) {
  const options = useMemo(
    () =>
      Object.values(INSALUBRITY_DEGREE).map((value) => ({
        value,
        label: INSALUBRITY_DEGREE_LABELS[value],
      })),
    [],
  );

  return (
    <FormCombobox
      name="insalubrityDegree"
      label="Insalubridade (NR-15)"
      options={options}
      disabled={disabled}
      searchable={false}
      placeholder="Selecione o grau de insalubridade"
    />
  );
}
