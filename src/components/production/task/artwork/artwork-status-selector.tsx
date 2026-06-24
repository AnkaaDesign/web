import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { ARTWORK_STATUS, SECTOR_PRIVILEGES } from "@/constants/enums";
import { ARTWORK_STATUS_LABELS } from "@/constants/enum-labels";
import { useAuth } from "@/hooks/common/use-auth";

interface ArtworkStatusSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

const ARTWORK_STATUS_OPTIONS = [
  { value: ARTWORK_STATUS.DRAFT, label: ARTWORK_STATUS_LABELS[ARTWORK_STATUS.DRAFT] },
  { value: ARTWORK_STATUS.APPROVED, label: ARTWORK_STATUS_LABELS[ARTWORK_STATUS.APPROVED] },
  { value: ARTWORK_STATUS.REPROVED, label: ARTWORK_STATUS_LABELS[ARTWORK_STATUS.REPROVED] },
];

// Filled, color-coded TRIGGER per status — same look as the service-order status
// selector (colored background + white text). gray / green / red.
const ARTWORK_STATUS_TRIGGER: Record<string, string> = {
  [ARTWORK_STATUS.DRAFT]:
    "bg-neutral-500 text-white hover:bg-neutral-600 border-neutral-600",
  [ARTWORK_STATUS.APPROVED]:
    "bg-green-700 text-white hover:bg-green-800 border-green-800",
  [ARTWORK_STATUS.REPROVED]:
    "bg-red-700 text-white hover:bg-red-800 border-red-800",
};

export function ArtworkStatusSelector({
  value,
  onChange,
  disabled = false,
  className = "w-auto min-w-[150px]",
  triggerClassName,
}: ArtworkStatusSelectorProps) {
  const { user } = useAuth();

  // Only COMMERCIAL and ADMIN can approve/reprove artworks
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
      options={ARTWORK_STATUS_OPTIONS}
      placeholder="Status"
      disabled={isDisabled}
      searchable={false}
      clearable={false}
      className={className}
      triggerClassName={cn(
        "font-medium",
        ARTWORK_STATUS_TRIGGER[value] ?? ARTWORK_STATUS_TRIGGER[ARTWORK_STATUS.DRAFT],
        triggerClassName,
      )}
    />
  );
}
