import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconUser, IconExternalLink } from "@tabler/icons-react";
import type { User } from "../../../../types";
import { cn } from "@/lib/utils";

interface AddressCardProps {
  user: User;
  className?: string;
}

export function AddressCard({ user, className }: AddressCardProps) {
  const hasAddress = user.address || user.neighborhood || user.city || user.state || user.zipCode;

  const getFullAddress = () => {
    const parts = [];

    if (user.address) {
      let streetLine = user.address;
      if (user.addressNumber) {
        streetLine += `, ${user.addressNumber}`;
      }
      parts.push(streetLine);
    }

    if (user.addressComplement) {
      parts.push(user.addressComplement);
    }

    if (user.neighborhood) {
      parts.push(user.neighborhood);
    }

    if (user.city || user.state) {
      const cityState = [user.city, user.state].filter(Boolean).join(" - ");
      parts.push(cityState);
    }

    if (user.zipCode) {
      const formatted = user.zipCode.replace(/(\d{5})(\d{3})/, "$1-$2");
      parts.push(`CEP: ${formatted}`);
    }

    return parts.join("\n");
  };

  const handleOpenMaps = () => {
    const addressParts = [
      user.address,
      user.addressNumber,
      user.neighborhood,
      user.city,
      user.state,
      user.zipCode,
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
          <IconUser className="h-5 w-5 text-muted-foreground" />
          Informações Pessoais
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Address Section */}
          {hasAddress && fullAddress ? (
            <div>
              <h3 className="text-base font-semibold mb-4 text-foreground">Endereço</h3>
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
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconUser className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum endereço cadastrado</h3>
              <p className="text-sm text-muted-foreground">Este usuário não possui endereço registrado.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
