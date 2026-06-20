import { IconAlertTriangle, IconHexagons } from "@tabler/icons-react";

import { GHS_PICTOGRAM_LABELS, GHS_SIGNAL_WORD_LABELS } from "../../../../constants";
import type { GHS_PICTOGRAM, GHS_SIGNAL_WORD } from "../../../../constants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import { GhsPictogramList } from "../ghs-pictogram";
import type { Fispq } from "@/types/fispq";

interface FispqHazardsCardProps {
  fispq: Fispq;
  className?: string;
}

export function FispqHazardsCard({ fispq, className }: FispqHazardsCardProps) {
  const pictograms = fispq.ghsPictograms ?? [];
  const hazardStatements = fispq.hazardStatements ?? [];
  const precautionStatements = fispq.precautionStatements ?? [];
  const isDanger = fispq.signalWord === "DANGER";

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconAlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
          Perigos (GHS)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          <div className="space-y-2">
            <DetailRow
              icon={IconAlertTriangle}
              label="Palavra de advertência"
              value={
                fispq.signalWord ? (
                  <span className={cn("flex items-center gap-1.5", isDanger && "text-destructive font-semibold")}>
                    {isDanger && <IconAlertTriangle className="h-3.5 w-3.5" />}
                    {GHS_SIGNAL_WORD_LABELS[fispq.signalWord as GHS_SIGNAL_WORD]}
                  </span>
                ) : (
                  "-"
                )
              }
            />
          </div>

          {/* Pictogramas */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
              <IconHexagons className="h-4 w-4 text-muted-foreground" />
              Pictogramas
            </h3>
            {pictograms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pictograma informado.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <GhsPictogramList codes={pictograms} size={64} className="gap-3" />
                <div className="flex flex-wrap gap-2">
                  {pictograms.map((p) => (
                    <Badge key={p} variant="outline" className="text-xs font-normal">
                      {GHS_PICTOGRAM_LABELS[p as GHS_PICTOGRAM] ?? p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Frases H */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Frases de perigo (H)</h3>
            {hazardStatements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma frase de perigo informada.</p>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
                {hazardStatements.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Frases P */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Frases de precaução (P)</h3>
            {precautionStatements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma frase de precaução informada.</p>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
                {precautionStatements.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
