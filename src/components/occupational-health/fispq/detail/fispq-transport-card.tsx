import { IconTruck, IconHash, IconRoad, IconBox, IconThermometer, IconDroplet, IconFlame, IconColorSwatch, IconWind } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailRow } from "@/components/ui/detail-row";
import type { Fispq } from "@/types/fispq";

interface FispqTransportCardProps {
  fispq: Fispq;
  className?: string;
}

export function FispqTransportCard({ fispq, className }: FispqTransportCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconTruck className="h-5 w-5 text-muted-foreground" />
          Composição e Transporte
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Composição / Transporte */}
          <div className="space-y-2">
            <DetailRow icon={IconHash} label="Número CAS" value={fispq.casNumber || "-"} />
            <DetailRow icon={IconHash} label="Número ONU" value={fispq.onuNumber || "-"} />
            <DetailRow icon={IconRoad} label="Classe de risco" value={fispq.unRiskClass || "-"} />
            <DetailRow icon={IconBox} label="Grupo de embalagem" value={fispq.packingGroup || "-"} />
          </div>

          {/* Propriedades físico-químicas */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
              <IconThermometer className="h-4 w-4 text-muted-foreground" />
              Propriedades físico-químicas
            </h3>
            <div className="space-y-2">
              <DetailRow icon={IconDroplet} label="Estado físico" value={fispq.physicalState || "-"} />
              <DetailRow icon={IconColorSwatch} label="Cor" value={fispq.color || "-"} />
              <DetailRow icon={IconWind} label="Odor" value={fispq.odor || "-"} />
              <DetailRow icon={IconFlame} label="Ponto de fulgor" value={fispq.flashPoint || "-"} />
              <DetailRow icon={IconDroplet} label="pH" value={fispq.phValue || "-"} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
