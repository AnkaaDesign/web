import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { usePricing } from "@/contexts/pricing-context";
import { Button } from "@/components/ui/button";

export function PricingToggle() {
  const { pricingVisible, togglePricing } = usePricing();

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
