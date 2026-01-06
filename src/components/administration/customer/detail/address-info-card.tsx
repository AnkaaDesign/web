import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconMapPin, IconHome, IconRoad, IconBuilding } from "@tabler/icons-react";
import type { Customer } from "../../../../types";
import { cn } from "@/lib/utils";
import { formatCEP } from "../../../../utils";

interface AddressInfoCardProps {
  customer: Customer;
  className?: string;
}

export function AddressInfoCard({ customer, className }: AddressInfoCardProps) {
  const hasAddress = customer.address || customer.city || customer.state || customer.zipCode;
  const fullAddress = [
    customer.address,
    customer.addressNumber,
    customer.addressComplement,
    customer.neighborhood,
    customer.city,
    customer.state,
    customer.zipCode ? formatCEP(customer.zipCode) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconMapPin className="h-5 w-5 text-muted-foreground" />
          Endereço
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {hasAddress ? (
            <>
              {/* Full Address Display */}
              {fullAddress && (
                <div className="bg-muted/30 rounded-lg p-4 mb-6">
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <IconMapPin className="h-4 w-4" />
                    Endereço Completo
                  </p>
                  <p className="text-base text-foreground leading-relaxed">{fullAddress}</p>
                </div>
              )}

              {/* Address Components */}
              <div className="space-y-4">
                {customer.address && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconRoad className="h-4 w-4" />
                      Street
                    </span>
                    <span className="text-sm font-semibold text-foreground">{customer.address}</span>
                  </div>
                )}

                {customer.addressNumber && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconHome className="h-4 w-4" />
                      Número
                    </span>
                    <span className="text-sm font-semibold text-foreground">{customer.addressNumber}</span>
                  </div>
                )}

                {customer.addressComplement && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconBuilding className="h-4 w-4" />
                      Complemento
                    </span>
                    <span className="text-sm font-semibold text-foreground">{customer.addressComplement}</span>
                  </div>
                )}

                {customer.neighborhood && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">Bairro</span>
                    <span className="text-sm font-semibold text-foreground">{customer.neighborhood}</span>
                  </div>
                )}

                {customer.city && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">Cidade</span>
                    <span className="text-sm font-semibold text-foreground">{customer.city}</span>
                  </div>
                )}

                {customer.state && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">Estado</span>
                    <span className="text-sm font-semibold text-foreground">{customer.state}</span>
                  </div>
                )}

                {customer.zipCode && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">CEP</span>
                    <span className="text-sm font-semibold text-foreground font-mono">{formatCEP(customer.zipCode)}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconMapPin className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum endereço cadastrado</h3>
              <p className="text-sm text-muted-foreground">Este cliente não possui endereço cadastrado.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
