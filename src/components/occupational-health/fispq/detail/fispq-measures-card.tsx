import { IconFirstAidKit, IconFlame, IconDropletExclamation, IconBuildingWarehouse } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Fispq } from "@/types/fispq";

interface FispqMeasuresCardProps {
  fispq: Fispq;
  className?: string;
}

function MeasureBlock({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string | null }) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-2 text-foreground flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </h3>
      {value ? (
        <div className="bg-muted/50 rounded-lg px-4 py-3">
          <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Não informado.</p>
      )}
    </div>
  );
}

export function FispqMeasuresCard({ fispq, className }: FispqMeasuresCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconFirstAidKit className="h-5 w-5 text-muted-foreground" />
          Medidas de segurança
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          <MeasureBlock icon={IconFirstAidKit} label="Primeiros socorros" value={fispq.firstAidMeasures} />
          <MeasureBlock icon={IconFlame} label="Combate a incêndio" value={fispq.fireFightingMeasures} />
          <MeasureBlock icon={IconDropletExclamation} label="Derramamento acidental" value={fispq.accidentalRelease} />
          <MeasureBlock icon={IconBuildingWarehouse} label="Manuseio e armazenamento" value={fispq.handlingStorage} />
        </div>
      </CardContent>
    </Card>
  );
}
