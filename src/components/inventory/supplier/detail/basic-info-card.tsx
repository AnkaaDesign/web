import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBuilding, IconCertificate } from "@tabler/icons-react";
import type { Supplier } from "../../../../types";
import { cn } from "@/lib/utils";
import { maskCNPJ } from "../../../../utils";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";

interface BasicInfoCardProps {
  supplier: Supplier;
  className?: string;
}

export function BasicInfoCard({ supplier, className }: BasicInfoCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconBuilding className="h-5 w-5 text-muted-foreground" />
          Informações Básicas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Logo Section */}
          <div className="flex justify-center mb-6">
            <SupplierLogoDisplay
              logo={supplier.logo}
              supplierName={supplier.fantasyName}
              size="2xl"
              shape="rounded"
            />
          </div>

          {/* Basic Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Identificação</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Nome Fantasia</span>
                <span className="text-sm font-semibold text-foreground">{supplier.fantasyName}</span>
              </div>

              {supplier.corporateName && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">Razão Social</span>
                  <span className="text-sm font-semibold text-foreground">{supplier.corporateName}</span>
                </div>
              )}

              {supplier.cnpj && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCertificate className="h-4 w-4" />
                    CNPJ
                  </span>
                  <span className="text-sm font-semibold text-foreground">{maskCNPJ(supplier.cnpj)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
