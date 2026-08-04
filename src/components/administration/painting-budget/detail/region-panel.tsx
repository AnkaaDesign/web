import { getPaints } from "@/api-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUpdatePaintingBoundary, useUpdatePaintingRegion } from "@/hooks";
import {
  PAINTING_BOUNDARY_KIND_LABELS,
  PAINTING_BOUNDARY_RESOLUTION_LABELS,
  PAINTING_REGION_KIND_LABELS,
  PAINTING_STRATEGY_LABELS,
} from "@/types";
import type { Paint, PaintingBoundary, PaintingBoundaryResolution, PaintingRegion, PaintingRegionKind, PaintingStrategy } from "@/types";
import { PaintSwatch, STRATEGY_FILL, SourceBadge, formatNumber } from "./common";

const KIND_OPTIONS: ComboboxOption[] = Object.entries(PAINTING_REGION_KIND_LABELS).map(([value, label]) => ({ value, label }));
const STRATEGY_OPTIONS: ComboboxOption[] = Object.entries(PAINTING_STRATEGY_LABELS).map(([value, label]) => ({ value, label }));
const RESOLUTION_OPTIONS: ComboboxOption[] = Object.entries(PAINTING_BOUNDARY_RESOLUTION_LABELS).map(([value, label]) => ({ value, label }));

interface RegionPanelProps {
  region: PaintingRegion | null;
  /** Todas as regiões da face — para nomear "com quem" cada divisa divide. */
  regions: PaintingRegion[];
  /** Divisas da face (sem WITH_BACKGROUND); o painel filtra as que tocam a região selecionada. */
  boundaries: PaintingBoundary[];
}

/** Painel lateral da região selecionada: tinta, tipo, estratégia, métricas e as divisas desta região (resolução editável). */
export function RegionPanel({ region, regions, boundaries }: RegionPanelProps) {
  const updateRegionMutation = useUpdatePaintingRegion();
  const updateBoundaryMutation = useUpdatePaintingBoundary();

  const regionBoundaries = region ? boundaries.filter((boundary) => boundary.regionAId === region.id || boundary.regionBId === region.id) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Região</CardTitle>
        <CardDescription>{region ? "Ajustes manuais sobrescrevem os valores automáticos." : "Clique em uma região no viewer para editar."}</CardDescription>
      </CardHeader>
      {region && (
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <PaintSwatch hex={region.colorHex} className="h-6 w-6" />
            <span className="font-mono text-sm">{region.colorHex}</span>
            <span className="text-xs text-muted-foreground">cor detectada</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label>Tinta</Label>
              <SourceBadge source={region.paintSource} />
            </div>
            {region.paint && (
              <div className="flex items-center gap-2 text-sm">
                <PaintSwatch hex={region.paint.hex} />
                <span>{region.paint.name}</span>
              </div>
            )}
            <Combobox<Paint>
              async
              mode="single"
              value={region.paintId ?? undefined}
              onValueChange={(value) => {
                if (typeof value === "string" && value) {
                  updateRegionMutation.mutate({ regionId: region.id, data: { paintId: value } });
                }
              }}
              queryKey={["paints", "painting-budget-region-picker"]}
              queryFn={async (searchTerm) => {
                const response = await getPaints({ searchingFor: searchTerm || undefined, limit: 20 });
                return { data: response.data ?? [], total: response.meta?.totalRecords };
              }}
              initialOptions={region.paint ? [region.paint] : []}
              minSearchLength={0}
              getOptionValue={(paint) => paint.id}
              getOptionLabel={(paint) => paint.name}
              renderOption={(paint) => (
                <div className="flex items-center gap-2">
                  <PaintSwatch hex={paint.hex} />
                  <span>{paint.name}</span>
                </div>
              )}
              placeholder="Trocar tinta..."
              searchPlaceholder="Buscar tinta..."
              emptyText="Nenhuma tinta encontrada"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label>Tipo da região</Label>
              <SourceBadge source={region.kindSource} />
            </div>
            <Combobox
              options={KIND_OPTIONS}
              value={region.kind}
              onValueChange={(value) => {
                if (typeof value === "string" && value) {
                  updateRegionMutation.mutate({ regionId: region.id, data: { kind: value as PaintingRegionKind } });
                }
              }}
              clearable={false}
              searchable={false}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label>Estratégia</Label>
              <SourceBadge source={region.strategySource} />
            </div>
            <Combobox
              options={STRATEGY_OPTIONS}
              value={region.strategy}
              onValueChange={(value) => {
                if (typeof value === "string" && value) {
                  updateRegionMutation.mutate({ regionId: region.id, data: { strategy: value as PaintingStrategy } });
                }
              }}
              clearable={false}
              renderOption={(option) => (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm border border-border" style={{ backgroundColor: STRATEGY_FILL[option.value as PaintingStrategy] }} />
                  {option.label}
                </span>
              )}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Área</span>
            <span className="text-right">{formatNumber(region.areaM2)} m²</span>
            <span className="text-muted-foreground">Perímetro</span>
            <span className="text-right">{formatNumber(region.perimeterM)} m</span>
            <span className="text-muted-foreground">Ilhas</span>
            <span className="text-right">{region.islands}</span>
            <span className="text-muted-foreground">Traço mínimo</span>
            <span className="text-right">{region.minStrokeMm != null ? `${formatNumber(region.minStrokeMm, 1)} mm` : "—"}</span>
            <span className="text-muted-foreground">Caixa (L × A)</span>
            <span className="text-right">
              {region.bboxWidthCm != null && region.bboxHeightCm != null
                ? `${formatNumber(region.bboxWidthCm, 0)} × ${formatNumber(region.bboxHeightCm, 0)} cm`
                : "—"}
            </span>
          </div>

          {/* Divisas desta região — edição contextual (a antiga tabela panorâmica de fronteiras saiu da tela) */}
          {regionBoundaries.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Divisas desta região ({regionBoundaries.length})
                </span>
                {regionBoundaries.map((boundary) => {
                  const otherRegionId = boundary.regionAId === region.id ? boundary.regionBId : boundary.regionAId;
                  const otherRegion = otherRegionId ? (regions.find((candidate) => candidate.id === otherRegionId) ?? null) : null;
                  return (
                    <div key={boundary.id} className="flex flex-col gap-2 rounded-md border border-border p-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary" size="sm">
                          {PAINTING_BOUNDARY_KIND_LABELS[boundary.kind]}
                        </Badge>
                        <span className="tabular-nums">{formatNumber(boundary.lengthM)} m</span>
                        {boundary.resolution === "NENHUMA" && (
                          <Badge variant="pending" size="sm">
                            Sem resolução
                          </Badge>
                        )}
                      </div>
                      {otherRegion && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          com
                          <PaintSwatch hex={otherRegion.paint?.hex ?? otherRegion.colorHex} />
                          {otherRegion.paint?.name ?? otherRegion.colorHex}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <Combobox
                          options={RESOLUTION_OPTIONS}
                          value={boundary.resolution}
                          onValueChange={(value) => {
                            if (typeof value === "string" && value) {
                              updateBoundaryMutation.mutate({ boundaryId: boundary.id, data: { resolution: value as PaintingBoundaryResolution } });
                            }
                          }}
                          clearable={false}
                          searchable={false}
                          triggerClassName="h-8"
                        />
                        <SourceBadge source={boundary.resolutionSource} />
                      </div>
                      {(boundary.cutLengthM != null || boundary.tapeLengthM != null) && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          Corte {boundary.cutLengthM != null ? `${formatNumber(boundary.cutLengthM)} m` : "—"} · Fita{" "}
                          {boundary.tapeLengthM != null ? `${formatNumber(boundary.tapeLengthM)} m` : "—"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
