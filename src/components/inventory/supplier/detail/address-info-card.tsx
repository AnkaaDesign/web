import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconMapPin, IconHome, IconRoad, IconBuilding } from "@tabler/icons-react";
import type { Supplier } from "../../../../types";
import { cn } from "@/lib/utils";
import { formatCEP } from "../../../../utils";

interface AddressInfoCardProps {
  supplier: Supplier;
  className?: string;
}

export function AddressInfoCard({ supplier, className }: AddressInfoCardProps) {
  const hasAddress = supplier.address || supplier.city || supplier.state || supplier.zipCode;
  const fullAddress = [
    supplier.address,
    supplier.addressNumber,
    supplier.addressComplement,
    supplier.neighborhood,
    supplier.city,
    supplier.state,
    supplier.zipCode ? formatCEP(supplier.zipCode) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
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
                {supplier.address && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconRoad className="h-4 w-4" />
                      Logradouro
                    </span>
                    <span className="text-sm font-semibold text-foreground">{supplier.address}</span>
                  </div>
                )}

                {supplier.addressNumber && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconHome className="h-4 w-4" />
                      Número
                    </span>
                    <span className="text-sm font-semibold text-foreground">{supplier.addressNumber}</span>
                  </div>
                )}

                {supplier.addressComplement && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconBuilding className="h-4 w-4" />
                      Complemento
                    </span>
                    <span className="text-sm font-semibold text-foreground">{supplier.addressComplement}</span>
                  </div>
                )}

                {supplier.neighborhood && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">Bairro</span>
                    <span className="text-sm font-semibold text-foreground">{supplier.neighborhood}</span>
                  </div>
                )}

                {supplier.city && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">Cidade</span>
                    <span className="text-sm font-semibold text-foreground">{supplier.city}</span>
                  </div>
                )}

                {supplier.state && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">Estado</span>
                    <span className="text-sm font-semibold text-foreground">{supplier.state}</span>
                  </div>
                )}

                {supplier.zipCode && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">CEP</span>
                    <span className="text-sm font-semibold text-foreground font-mono">{formatCEP(supplier.zipCode)}</span>
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
              <p className="text-sm text-muted-foreground">Este fornecedor não possui endereço cadastrado.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
