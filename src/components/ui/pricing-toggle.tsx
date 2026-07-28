import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { usePricing } from "@/contexts/pricing-context";
import { usePrivileges } from "@/hooks/common/use-privileges";
import { Button } from "@/components/ui/button";

/**
 * The show/hide-values eye.
 *
 * Self-gating on purpose: the check lives here rather than at the two sidebar
 * mount points so a third mount can never reintroduce the bug. For a sector
 * outside the money allowlist the toggle rendered but had nothing to reveal —
 * it masked values they were never shown — so it renders nothing at all.
 */
export function PricingToggle() {
  const { pricingVisible, togglePricing } = usePricing();
  const { canViewPrices } = usePrivileges();

  if (!canViewPrices) return null;

  return (
    <Button variant="ghost" size="icon" onClick={togglePricing}>
      {pricingVisible ? (
        <IconEye className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <IconEyeOff className="h-[1.2rem] w-[1.2rem] text-muted-foreground" />
      )}
      <span className="sr-only">
        {pricingVisible ? "Ocultar valores" : "Mostrar valores"}
      </span>
    </Button>
  );
}
