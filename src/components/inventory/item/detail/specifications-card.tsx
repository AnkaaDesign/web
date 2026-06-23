import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconInfoCircle } from "@tabler/icons-react";
import type { Item, Measure } from "../../../../types";
import { cn } from "@/lib/utils";
import { measureUtils, formatItemLocation } from "../../../../utils";
import { MEASURE_TYPE_LABELS, MEASURE_TYPE_ORDER, MEASURE_UNIT_LABELS } from "../../../../constants";

interface SpecificationsCardProps {
  item: Item;
  className?: string;
}

// Single row layout shared by every specification so the whole card reads as one
// consistent list (label on the left, value on the right).
function SpecRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
      <span className="text-sm font-medium text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right min-w-0">{value}</span>
    </div>
  );
}

const NotDefined = () => <span className="text-muted-foreground italic font-normal">Não definida</span>;

// Format a single measure into a "value unit" string (e.g. "900 ml"), with
// graceful fallbacks for PPE letter-sizes (unit only) and numeric-only sizes.
function formatMeasureValue(measure: Measure): string {
  if (measure.value != null && measure.unit != null) {
    return measureUtils.formatMeasure({ value: measure.value, unit: measure.unit }, true, 2, measure.measureType);
  }
  if (measure.unit != null) return MEASURE_UNIT_LABELS[measure.unit] || measure.unit;
  if (measure.value != null) return String(measure.value);
  return "—";
}

export function SpecificationsCard({ item, className }: SpecificationsCardProps) {
  // Measures sorted by their canonical type order (Peso → Volume → …).
  const measures = [...(item.measures || [])].sort(
    (a, b) => (MEASURE_TYPE_ORDER[a.measureType] ?? 999) - (MEASURE_TYPE_ORDER[b.measureType] ?? 999),
  );

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
          Especificações Técnicas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Product Information */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações do Produto</h3>
            <div className="space-y-4">
              <SpecRow label="Marcas" value={item.brands?.length ? item.brands.map((b) => b.name).join(", ") : <NotDefined />} />
              <SpecRow label="Categoria" value={item.category ? item.category.name : <NotDefined />} />
              {item.supplier && <SpecRow label="Fornecedor" value={item.supplier.fantasyName} />}
              {item.warehouseLocation && (
                <SpecRow
                  label="Localização"
                  value={formatItemLocation(item)}
                />
              )}
            </div>
          </div>

          {/* Identification */}
          {(item.uniCode || item.ppeCA || (item.barcodes && item.barcodes.length > 0)) && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground">Identificação</h3>
              <div className="space-y-4">
                {item.uniCode && <SpecRow label="Código Universal" value={<span className="font-mono">{item.uniCode}</span>} />}
                {item.ppeCA && <SpecRow label="Certificado de Aprovação (CA)" value={<span className="font-mono">{item.ppeCA}</span>} />}
                {item.barcodes && item.barcodes.length > 0 && (
                  <SpecRow
                    label="Códigos de Barras"
                    value={
                      <span className="flex flex-wrap gap-2 justify-end">
                        {item.barcodes.map((barcode, index) => (
                          <span key={index} className="font-mono bg-background/60 rounded px-2 py-0.5">
                            {barcode}
                          </span>
                        ))}
                      </span>
                    }
                  />
                )}
              </div>
            </div>
          )}

          {/* Measures — one row per measure, labelled by its type (Peso, Volume, …) */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Medidas</h3>
            <div className="space-y-4">
              {measures.length > 0 ? (
                measures.map((measure) => (
                  <SpecRow
                    key={measure.id}
                    label={MEASURE_TYPE_LABELS[measure.measureType] ?? measure.measureType}
                    value={formatMeasureValue(measure)}
                  />
                ))
              ) : (
                <SpecRow label="Medidas" value={<NotDefined />} />
              )}
            </div>
          </div>

          {/* Packaging & Logistics */}
          {(item.boxQuantity != null || item.estimatedLeadTime != null) && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground">Embalagem e Logística</h3>
              <div className="space-y-4">
                {item.boxQuantity != null && <SpecRow label="Unidades por Caixa" value={item.boxQuantity} />}
                {item.estimatedLeadTime != null && <SpecRow label="Prazo de Entrega Estimado" value={`${item.estimatedLeadTime} dias`} />}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
