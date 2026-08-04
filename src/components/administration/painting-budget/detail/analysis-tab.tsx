import { useEffect, useState } from "react";
import { IconPhotoScan } from "@tabler/icons-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { EmptyState } from "@/components/ui/empty-state";
import { PAINTING_FACE_VIEW_LABELS, PAINTING_STRATEGY_LABELS } from "@/types";
import type { PaintingAnalysis, PaintingAnalysisFace } from "@/types";
import { AlertsCard } from "./alerts-card";
import { STRATEGY_FILL, serveFileUrl } from "./common";
import { RegionPanel } from "./region-panel";

/** Exterior + holes as one evenodd path so letter counters (vazados) stay unpainted in the overlay. */
function regionPathD(geometry: { contour: Array<[number, number]>; holes?: Array<Array<[number, number]>> }): string {
  const rings = [geometry.contour, ...(geometry.holes ?? [])];
  return rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => `M${ring.map(([x, y]) => `${x},${y}`).join("L")}Z`)
    .join(" ");
}

interface AnalysisTabProps {
  analysis: PaintingAnalysis;
  face: PaintingAnalysisFace | undefined;
  onSelectFace: (faceId: string) => void;
}

/**
 * Revisão enxuta: "a leitura automática da arte está certa?" — viewer com overlay + painel da região
 * clicada (com as divisas dela) + alertas. Fundo da face mora na tela Artes; recálculo manual no menu "⋯" da página.
 */
export function AnalysisTab({ analysis, face, onSelectFace }: AnalysisTabProps) {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRegionId(null);
    setHoveredRegionId(null);
  }, [face?.id]);

  const faces = analysis.faces ?? [];
  const hasProcessedFace = faces.some((analysisFace) => analysisFace.processedAt);
  const regions = face?.regions ?? [];
  const selectedRegion = regions.find((region) => region.id === selectedRegionId) ?? null;
  const artifact = face?.engineArtifact;
  const workWidth = artifact?.image?.workWidthPx ?? 0;
  const workHeight = artifact?.image?.workHeightPx ?? 0;
  const boundaries = (face?.boundaries ?? []).filter((boundary) => boundary.kind !== "WITH_BACKGROUND");
  const unresolvedAlerts = (analysis.alerts ?? []).filter((alert) => !alert.resolvedAt);
  const usedStrategies = Array.from(new Set(regions.filter((region) => !region.geometry?.isBackground).map((region) => region.strategy)));

  const faceOptions: ComboboxOption[] = faces.map((analysisFace) => ({
    value: analysisFace.id,
    label: `${PAINTING_FACE_VIEW_LABELS[analysisFace.view]}${analysisFace.processedAt ? "" : " (não processada)"}`,
  }));

  if (!hasProcessedFace) {
    return (
      <Card>
        <CardContent className="py-6">
          <EmptyState
            icon={<IconPhotoScan className="h-10 w-10" />}
            title="Nenhuma arte processada"
            description={'Adicione as artes no passo "Artes do Implemento" e use "Processar análise" para gerar as regiões, as fronteiras e o plano de produção.'}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="self-start">
        <CardHeader>
          <CardTitle>Análise da Arte</CardTitle>
          <CardDescription>Clique em uma região no viewer para revisar tinta, tipo, estratégia e as divisas dela.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {faces.length > 1 && (
            <div className="w-64">
              <Combobox
                options={faceOptions}
                value={face?.id}
                onValueChange={(value) => {
                  if (typeof value === "string" && value) onSelectFace(value);
                }}
                clearable={false}
                searchable={false}
                placeholder="Selecionar face"
              />
            </div>
          )}

          {!face ? (
            <p className="py-10 text-center text-muted-foreground">Nenhuma face cadastrada.</p>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-md border border-border bg-muted/20">
                <img src={serveFileUrl(face.fileId)} alt={PAINTING_FACE_VIEW_LABELS[face.view]} className="block w-full select-none" draggable={false} />
                {workWidth > 0 && workHeight > 0 && (
                  <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${workWidth} ${workHeight}`} preserveAspectRatio="none">
                    {regions
                      .filter((region) => region.geometry && !region.geometry.isBackground)
                      .map((region) => {
                        const isSelected = region.id === selectedRegionId;
                        const isHovered = region.id === hoveredRegionId;
                        return (
                          <path
                            key={region.id}
                            d={regionPathD(region.geometry!)}
                            fillRule="evenodd"
                            fill={STRATEGY_FILL[region.strategy]}
                            fillOpacity={region.strategy === "NENHUMA" ? 0 : isSelected || isHovered ? 0.55 : 0.3}
                            stroke={isSelected ? "#ffffff" : "rgba(17, 24, 39, 0.7)"}
                            strokeWidth={isSelected ? 4 : 1.5}
                            vectorEffect="non-scaling-stroke"
                            className="cursor-pointer transition-[fill-opacity]"
                            onMouseEnter={() => setHoveredRegionId(region.id)}
                            onMouseLeave={() => setHoveredRegionId(null)}
                            onClick={() => setSelectedRegionId(region.id)}
                          />
                        );
                      })}
                  </svg>
                )}
              </div>
              {!face.processedAt && (
                <p className="text-sm text-muted-foreground">Face ainda não processada — use "Reprocessar imagem" para gerar as regiões.</p>
              )}
              {usedStrategies.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  {usedStrategies.map((strategy) => (
                    <span key={strategy} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-3 w-3 rounded-sm border border-border" style={{ backgroundColor: STRATEGY_FILL[strategy] }} />
                      {PAINTING_STRATEGY_LABELS[strategy]}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <RegionPanel region={selectedRegion} regions={regions} boundaries={boundaries} />
        {unresolvedAlerts.length > 0 && <AlertsCard alerts={unresolvedAlerts} />}
      </div>
    </div>
  );
}
