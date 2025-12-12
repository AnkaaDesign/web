import { IconX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FilterIndicatorProps {
  label: string;
  value: string;
  onRemove: () => void;
}

export function FilterIndicator({ label, value, onRemove }: FilterIndicatorProps) {
  return (
    <Badge variant="secondary" className="pl-2 pr-1 py-1 gap-1">
      <span className="text-xs font-normal">
        {label}: <span className="font-medium">{value}</span>
      </span>
      <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-transparent" onClick={onRemove}>
        <IconX className="h-3 w-3" />
      </Button>
    </Badge>
  );
}
