import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface BooleanFilterProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
}

export function BooleanFilter({
  value,
  onChange,
  label,
  description,
  className,
}: BooleanFilterProps) {
  return (
    <div className={cn("flex items-center justify-between space-x-2", className)}>
      <div className="flex-1 space-y-1">
        {label && <Label htmlFor="boolean-filter">{label}</Label>}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <Switch
        id="boolean-filter"
        checked={value}
        onCheckedChange={onChange}
      />
    </div>
  );
}
