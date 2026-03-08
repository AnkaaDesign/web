import { FormSwitch } from "@/components/ui/form-switch";
import { IconCrown } from "@tabler/icons-react";
import { useFormContext, useWatch } from "react-hook-form";
import { SECTOR_PRIVILEGES } from "../../../../constants";

interface SectorLeaderSwitchProps {
  disabled?: boolean;
  sectorPrivilege?: string | null;
}

/**
 * Sector Leader Switch Component
 *
 * This component displays a checkbox to mark the user as the leader of the selected sector.
 * Leadership is restricted to PRODUCTION sectors only.
 *
 * Behavior:
 * - Only renders when the selected sector has PRODUCTION privilege
 * - When checked, it indicates that the user should be set as the leader of the selected sector
 * - The actual relationship is stored in Sector.leaderId (pointing to User.id)
 * - The form sends `isSectorLeader: true/false` to indicate the intent
 * - The backend will update Sector.leaderId accordingly
 */
export function SectorLeaderSwitch({ disabled, sectorPrivilege }: SectorLeaderSwitchProps) {
  const { control } = useFormContext();
  const selectedSectorId = useWatch({ control, name: "sectorId" });

  // Only show for PRODUCTION sectors
  const isProductionSector = sectorPrivilege === SECTOR_PRIVILEGES.PRODUCTION;

  // Disable if no sector selected or not production
  const isDisabled = disabled || !selectedSectorId || !isProductionSector;

  // If not a production sector, don't render at all
  if (!isProductionSector || !selectedSectorId) {
    return null;
  }

  return (
    <FormSwitch
      name="isSectorLeader"
      label="Líder do Setor"
      description="Marcar este colaborador como líder do setor de produção selecionado"
      disabled={isDisabled}
      icon={<IconCrown className="h-4 w-4 text-yellow-500" />}
    />
  );
}
