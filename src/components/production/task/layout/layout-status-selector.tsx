import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { LAYOUT_STATUS, SECTOR_PRIVILEGES } from "@/constants/enums";
import { LAYOUT_STATUS_LABELS } from "@/constants/enum-labels";
import { useAuth } from "@/hooks/common/use-auth";

interface LayoutStatusSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

const LAYOUT_STATUS_OPTIONS = [
  { value: LAYOUT_STATUS.DRAFT, label: LAYOUT_STATUS_LABELS[LAYOUT_STATUS.DRAFT] },
  { value: LAYOUT_STATUS.APPROVED, label: LAYOUT_STATUS_LABELS[LAYOUT_STATUS.APPROVED] },
  { value: LAYOUT_STATUS.REPROVED, label: LAYOUT_STATUS_LABELS[LAYOUT_STATUS.REPROVED] },
];

// Filled, color-coded TRIGGER per status — same look as the service-order status
// selector (colored background + white text). gray / green / red.
const LAYOUT_STATUS_TRIGGER: Record<string, string> = {
  [LAYOUT_STATUS.DRAFT]:
    "bg-neutral-500 text-white hover:bg-neutral-600 border-neutral-600",
  [LAYOUT_STATUS.APPROVED]:
    "bg-green-700 text-white hover:bg-green-800 border-green-800",
  [LAYOUT_STATUS.REPROVED]:
    "bg-red-700 text-white hover:bg-red-800 border-red-800",
};

export function LayoutStatusSelector({
  value,
  onChange,
  disabled = false,
  className = "w-auto min-w-[150px]",
  triggerClassName,
}: LayoutStatusSelectorProps) {
  const { user } = useAuth();

  // Only COMMERCIAL and ADMIN can approve/reprove layouts
  const canApprove =
    user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL ||
    user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  // If user cannot approve, disable the selector
  const isDisabled = disabled || !canApprove;

  return (
    <Combobox
      value={value}
      onValueChange={(newValue) => {
        if (newValue && typeof newValue === "string") {
          onChange(newValue);
        }
      }}
      options={LAYOUT_STATUS_OPTIONS}
      placeholder="Status"
      disabled={isDisabled}
      searchable={false}
      clearable={false}
      className={className}
      triggerClassName={cn(
        "font-medium",
        LAYOUT_STATUS_TRIGGER[value] ?? LAYOUT_STATUS_TRIGGER[LAYOUT_STATUS.DRAFT],
        triggerClassName,
      )}
    />
  );
}
