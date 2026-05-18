import { useMemo } from "react";
import { useSectors } from "../../../hooks";
import { SECTOR_PRIVILEGES } from "../../../constants";

import { MultiSelect } from "@/components/ui/multi-select";

interface SectorMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Sector picker for skill-assessment campaigns.
 *
 * Always filters to PRODUCTION-privilege sectors — the only ones relevant
 * for skill matrices. The previous "Mostrar todos os setores" toggle was
 * removed: matrices are inherently production-bound, and showing
 * Administration/HR sectors only created noise.
 */
export function SectorMultiSelect({ value, onChange, disabled, placeholder }: SectorMultiSelectProps) {
  const { data, isLoading } = useSectors({
    limit: 100,
    orderBy: { name: "asc" },
    where: { privileges: SECTOR_PRIVILEGES.PRODUCTION },
  } as any);

  const options = useMemo(
    () =>
      (data?.data ?? []).map((s: any) => ({
        value: s.id as string,
        label: s.name as string,
      })),
    [data],
  );

  return (
    <MultiSelect
      options={options}
      selected={value}
      onChange={onChange}
      disabled={disabled || isLoading}
      placeholder={placeholder ?? "Selecione os setores"}
    />
  );
}
