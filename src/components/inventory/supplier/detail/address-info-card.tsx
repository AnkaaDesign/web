import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconMapPin, IconExternalLink } from "@tabler/icons-react";
import type { Supplier } from "../../../../types";
import { cn } from "@/lib/utils";
import { formatCEP } from "../../../../utils";

interface AddressInfoCardProps {
  supplier: Supplier;
  className?: string;
}

export function AddressInfoCard({ supplier, className }: AddressInfoCardProps) {
  const hasAddress = supplier.address || supplier.city || supplier.state || supplier.zipCode;

  const getFullAddress = () => {
    const parts = [];

    if (supplier.address) {
      let streetLine = supplier.address;
      if (supplier.addressNumber) {
        streetLine += `, ${supplier.addressNumber}`;
      }
      parts.push(streetLine);
    }

    if (supplier.addressComplement) {
      parts.push(supplier.addressComplement);
    }

    if (supplier.neighborhood) {
      parts.push(supplier.neighborhood);
    }

    if (supplier.city || supplier.state) {
      const cityState = [supplier.city, supplier.state].filter(Boolean).join(" - ");
      parts.push(cityState);
    }

    if (supplier.zipCode) {
      parts.push(`CEP: ${formatCEP(supplier.zipCode)}`);
    }

    return parts.join("\n");
  };

  const handleOpenMaps = () => {
    const addressParts = [
      supplier.address,
      supplier.addressNumber,
      supplier.neighborhood,
      supplier.city,
      supplier.state,
      supplier.zipCode,
    ].filter(Boolean);

    const fullAddress = addressParts.join(", ");
    if (!fullAddress) return;

    const encodedAddress = encodeURIComponent(fullAddress);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank");
  };

  const fullAddress = getFullAddress();

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconMapPin className="h-5 w-5 text-muted-foreground" />
          Endereço
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {hasAddress && fullAddress ? (
          <button
            onClick={handleOpenMaps}
            className="w-full text-left bg-muted/30 hover:bg-muted/50 transition-colors rounded-lg p-4 cursor-pointer border border-border"
          >
            <p className="text-sm font-semibold text-foreground leading-relaxed whitespace-pre-line">
              {fullAddress}
            </p>
            <div className="flex items-center gap-1.5 mt-3">
              <span className="text-sm font-medium text-primary">Abrir no Google Maps</span>
              <IconExternalLink className="h-3.5 w-3.5 text-primary" />
            </div>
          </button>
        ) : (
          <div className="text-center py-8">
            <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <IconMapPin className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum endereço cadastrado</h3>
            <p className="text-sm text-muted-foreground">Este fornecedor não possui endereço cadastrado.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
