import { IconFlask, IconBuildingFactory2, IconTruck, IconPhone, IconClipboardText, IconProgressCheck, IconBox } from "@tabler/icons-react";

import { FISPQ_STATUS_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import type { Fispq } from "@/types/fispq";
import { FISPQ_STATUS_BADGE_VARIANTS } from "../list/fispq-table-columns";

interface FispqIdentificationCardProps {
  fispq: Fispq;
  className?: string;
}

export function FispqIdentificationCard({ fispq, className }: FispqIdentificationCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconFlask className="h-5 w-5 text-muted-foreground" />
          Identificação
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Produto */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Produto</h3>
            <div className="space-y-2">
              <DetailRow icon={IconFlask} label="Produto" value={fispq.item?.name || fispq.productName || "-"} />
              <DetailRow
                icon={IconProgressCheck}
                label="Status"
                value={
                  <Badge variant={FISPQ_STATUS_BADGE_VARIANTS[fispq.status] || "secondary"} className="font-normal">
                    {FISPQ_STATUS_LABELS[fispq.status] || fispq.status}
                  </Badge>
                }
              />
              <DetailRow icon={IconClipboardText} label="Uso recomendado" value={fispq.recommendedUse || "-"} />
            </div>
          </div>

          {/* Fornecimento */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Fabricante / Fornecedor</h3>
            <div className="space-y-2">
              <DetailRow icon={IconBuildingFactory2} label="Fabricante" value={fispq.manufacturer || "-"} />
              <DetailRow icon={IconTruck} label="Fornecedor" value={fispq.supplierName || "-"} />
              <DetailRow icon={IconPhone} label="Telefone de emergência" value={fispq.emergencyPhone || "-"} />
            </div>
          </div>

          {/* Observações */}
          {fispq.notes && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                <IconBox className="h-4 w-4 text-muted-foreground" />
                Observações
              </h3>
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{fispq.notes}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
