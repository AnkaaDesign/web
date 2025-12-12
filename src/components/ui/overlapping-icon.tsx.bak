import { IconPlus } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface OverlappingIconProps {
  mainIcon: Icon;
  mainIconSize?: number;
  plusIconSize?: number;
  className?: string;
  showPlus?: boolean;
  color?: string;
}

export function OverlappingIcon({ mainIcon: MainIcon, mainIconSize = 24, plusIconSize = 12, className, showPlus = false, color }: OverlappingIconProps) {
  return (
    <div className={cn("relative inline-block", className)}>
      <MainIcon size={mainIconSize} className={cn("text-current", color)} />
      {showPlus && (
        <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
          <IconPlus size={plusIconSize} className="text-green-600" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}
