import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ARTWORK_STATUS, ARTWORK_STATUS_LABELS, SECTOR_PRIVILEGES } from "@/constants/enums";
import { useAuth } from "@/hooks/useAuth";

interface ArtworkStatusSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

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
    <Select value={value} onValueChange={onChange} disabled={isDisabled}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ARTWORK_STATUS.DRAFT}>
          {ARTWORK_STATUS_LABELS[ARTWORK_STATUS.DRAFT]}
        </SelectItem>
        <SelectItem value={ARTWORK_STATUS.APPROVED}>
          {ARTWORK_STATUS_LABELS[ARTWORK_STATUS.APPROVED]}
        </SelectItem>
        <SelectItem value={ARTWORK_STATUS.REPROVED}>
          {ARTWORK_STATUS_LABELS[ARTWORK_STATUS.REPROVED]}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
