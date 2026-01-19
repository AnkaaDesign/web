import { Combobox } from "@/components/ui/combobox";
import { ARTWORK_STATUS, ARTWORK_STATUS_LABELS, SECTOR_PRIVILEGES } from "@/constants/enums";
import { useAuth } from "@/hooks/useAuth";

interface ArtworkStatusSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const ARTWORK_STATUS_OPTIONS = [
  { value: ARTWORK_STATUS.DRAFT, label: ARTWORK_STATUS_LABELS[ARTWORK_STATUS.DRAFT] },
  { value: ARTWORK_STATUS.APPROVED, label: ARTWORK_STATUS_LABELS[ARTWORK_STATUS.APPROVED] },
  { value: ARTWORK_STATUS.REPROVED, label: ARTWORK_STATUS_LABELS[ARTWORK_STATUS.REPROVED] },
];

export function ArtworkStatusSelector({
  value,
  onChange,
  disabled = false,
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
        if (newValue && typeof newValue === 'string') {
          onChange(newValue);
        }
      }}
      options={ARTWORK_STATUS_OPTIONS}
      placeholder="Status"
      disabled={isDisabled}
      searchable={false}
      clearable={false}
      className="w-[140px]"
    />
  );
}
