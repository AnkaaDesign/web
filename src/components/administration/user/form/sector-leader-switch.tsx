import { FormSwitch } from "@/components/ui/form-switch";
import { IconCrown } from "@tabler/icons-react";
import { useFormContext, useWatch } from "react-hook-form";

interface SectorLeaderSwitchProps {
  disabled?: boolean;
}

/**
 * Sector Leader Switch Component
 *
 * This component displays a checkbox to mark the user as the leader (manager) of the selected sector.
 *
 * New behavior (after migration):
 * - The checkbox is only enabled when a sector is selected
 * - When checked, it indicates that the user should be set as the manager of the selected sector
 * - The actual relationship is stored in Sector.managerId (pointing to User.id)
 * - The form sends `isSectorLeader: true/false` to indicate the intent
 * - The backend will update Sector.managerId accordingly
 *
 * Note: The old managedSectorId field on User was removed.
 * Leadership is now determined by Sector.managerId pointing to the user.
 */
export function SectorLeaderSwitch({ disabled }: SectorLeaderSwitchProps) {
  const { control } = useFormContext();
  const selectedSectorId = useWatch({ control, name: "sectorId" });

  // Disable the switch if no sector is selected
  const isDisabled = disabled || !selectedSectorId;

  return (
    <FormSwitch
      name="isSectorLeader"
      label="Líder do Setor"
      description={
        selectedSectorId
          ? "Marcar este colaborador como líder/gerente do setor selecionado"
          : "Selecione um setor primeiro para poder definir o líder"
      }
      disabled={isDisabled}
      icon={<IconCrown className="h-4 w-4 text-yellow-500" />}
    />
  );
}
