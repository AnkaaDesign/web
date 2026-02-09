import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconArrowRight, IconCheck, IconLoader2, IconPalette, IconInfoCircle } from "@tabler/icons-react";
import type { Paint } from "../../../../types";
import { PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS } from "../../../../constants";

interface ConflictField {
  field: string;
  label: string;
  values: Array<{ paintId: string; paintName: string; value: any; formatted?: string }>;
  type: "single" | "array" | "boolean" | "color";
}

interface MergeResolution {
  field: string;
  action: "select" | "custom" | "combine";
  selectedPaintId?: string;
  customValue?: any;
  selectedIds?: string[];
}

interface PaintMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paints: Paint[];
  onMerge: (targetPaintId: string, resolutions: Record<string, any>) => Promise<void>;
}

export function PaintMergeDialog({ open, onOpenChange, paints, onMerge }: PaintMergeDialogProps) {
  const [targetPaintId, setTargetPaintId] = useState<string>("");
  const [resolutions, setResolutions] = useState<Map<string, MergeResolution>>(new Map());
  const [customValues, setCustomValues] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Detect conflicts between paints
  const conflicts = useMemo((): ConflictField[] => {
    if (paints.length < 2) return [];

    const conflictFields: ConflictField[] = [];
    const fieldsToCheck = [
      { field: "name", label: "Nome", type: "single" as const },
      { field: "code", label: "Código", type: "single" as const },
      { field: "hex", label: "Cor Hexadecimal", type: "color" as const },
      { field: "finish", label: "Acabamento", type: "single" as const },
      { field: "manufacturer", label: "Fabricante", type: "single" as const },
      { field: "tags", label: "Tags", type: "array" as const },
      { field: "paintTypeId", label: "Tipo de Tinta", type: "single" as const },
      { field: "paintBrandId", label: "Marca", type: "single" as const },
    ];

    for (const { field, label, type } of fieldsToCheck) {
      const values = paints
        .map((paint) => {
          const value = (paint as any)[field];
          let formatted: string | undefined;

          if (value === null || value === undefined) return null;

          // Format value for display
          if (field === "finish" && PAINT_FINISH_LABELS[value]) {
            formatted = PAINT_FINISH_LABELS[value];
          } else if (field === "manufacturer" && TRUCK_MANUFACTURER_LABELS[value]) {
            formatted = TRUCK_MANUFACTURER_LABELS[value];
          } else if (field === "paintTypeId" && paint.paintType) {
            formatted = paint.paintType.name;
          } else if (field === "paintBrandId" && paint.paintBrand) {
            formatted = paint.paintBrand.name;
          } else if (type === "array" && Array.isArray(value)) {
            formatted = value.length > 0 ? value.join(", ") : "Nenhum";
          } else if (type === "boolean") {
            formatted = value ? "Sim" : "Não";
          } else if (type === "color") {
            formatted = value; // Hex color
          } else {
            formatted = String(value);
          }

          return {
            paintId: paint.id,
            paintName: paint.name,
            value,
            formatted,
          };
        })
        .filter((v) => v !== null) as Array<{ paintId: string; paintName: string; value: any; formatted?: string }>;

      // Check if there's a conflict (different values)
      if (values.length > 1) {
        const hasConflict =
          type === "array"
            ? !values.every((v) => JSON.stringify(v.value) === JSON.stringify(values[0].value))
            : !values.every((v) => v.value === values[0].value);

        if (hasConflict) {
          conflictFields.push({
            field,
            label,
            values,
            type,
          });
        }
      }
    }

    return conflictFields;
  }, [paints]);

  // Auto-select first paint as target if not set
  useMemo(() => {
    if (paints.length > 0 && !targetPaintId) {
      setTargetPaintId(paints[0].id);
    }
  }, [paints, targetPaintId]);

  // Get preview of merged result
  const mergedPreview = useMemo(() => {
    if (!targetPaintId) return null;

    const target = paints.find((p) => p.id === targetPaintId);
    if (!target) return null;

    const preview: Record<string, any> = { ...target };

    // Apply resolutions
    resolutions.forEach((resolution, field) => {
      switch (resolution.action) {
        case "select":
          if (resolution.selectedPaintId) {
            const selectedPaint = paints.find((p) => p.id === resolution.selectedPaintId);
            if (selectedPaint) {
              preview[field] = (selectedPaint as any)[field];
            }
          }
          break;
        case "custom":
          preview[field] = resolution.customValue;
          break;
        case "combine":
          if (resolution.selectedIds) {
            const arrays = paints
              .filter((paint) => resolution.selectedIds!.includes(paint.id))
              .map((paint) => (paint as any)[field] || [])
              .flat();
            preview[field] = [...new Set(arrays)]; // Remove duplicates
          }
          break;
      }
    });

    return preview;
  }, [targetPaintId, paints, resolutions]);

  const handleResolutionChange = (field: string, resolution: MergeResolution) => {
    setResolutions(new Map(resolutions.set(field, resolution)));
  };

  const handleCustomValueChange = (field: string, value: string) => {
    setCustomValues(new Map(customValues.set(field, value)));
  };

  const handleMerge = async () => {
    if (!targetPaintId || isLoading) return;

    setIsLoading(true);
    try {
      // Build resolution object
      const resolvedData: Record<string, any> = {};

      resolutions.forEach((resolution, field) => {
        switch (resolution.action) {
          case "select":
            if (resolution.selectedPaintId) {
              const selectedPaint = paints.find((p) => p.id === resolution.selectedPaintId);
              if (selectedPaint) {
                resolvedData[field] = (selectedPaint as any)[field];
              }
            }
            break;
          case "custom":
            resolvedData[field] = resolution.customValue;
            break;
          case "combine":
            if (resolution.selectedIds) {
              const arrays = paints
                .filter((paint) => resolution.selectedIds!.includes(paint.id))
                .map((paint) => (paint as any)[field] || [])
                .flat();
              resolvedData[field] = [...new Set(arrays)];
            }
            break;
        }
      });

      await onMerge(targetPaintId, resolvedData);
      onOpenChange(false);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Merge failed:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const hasUnresolvedConflicts = conflicts.some((conflict) => !resolutions.has(conflict.field));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPalette className="h-5 w-5" />
            Mesclar Tintas
          </DialogTitle>
          <DialogDescription>
            Consolide {paints.length} tintas em uma única. A tinta principal receberá todas as fórmulas, tarefas e histórico das demais.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Info Alert */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 p-4">
              <div className="flex gap-3">
                <IconInfoCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">Como funciona a mesclagem:</p>
                  <ul className="text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>A tinta principal será mantida e receberá todos os dados</li>
                    <li>As outras tintas serão removidas após transferir seus dados</li>
                    <li>Todas as fórmulas, tarefas, histórico e relações serão preservados</li>
                    <li>Você pode resolver conflitos entre campos diferentes</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Target Paint Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Tinta Principal</Label>
              <p className="text-sm text-muted-foreground">
                Selecione a tinta que será mantida. As demais tintas serão consolidadas nela e depois removidas.
              </p>
              <RadioGroup value={targetPaintId} onValueChange={setTargetPaintId}>
                {paints.map((paint) => (
                  <div
                    key={paint.id}
                    className="flex items-center space-x-2 rounded-md border border-border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <RadioGroupItem value={paint.id} id={`target-${paint.id}`} />
                    <Label htmlFor={`target-${paint.id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded border border-border shadow-sm"
                            style={{ backgroundColor: paint.hex }}
                            title={paint.hex}
                          />
                          <div>
                            <p className="font-medium">{paint.name}</p>
                            {paint.code && <p className="text-sm text-muted-foreground">{paint.code}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {paint.finish && <Badge variant="secondary">{PAINT_FINISH_LABELS[paint.finish]}</Badge>}
                          {paint.manufacturer && <Badge variant="outline">{TRUCK_MANUFACTURER_LABELS[paint.manufacturer]}</Badge>}
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Conflicts Section */}
            {conflicts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <IconAlertTriangle className="h-5 w-5 text-warning" />
                  <h3 className="text-lg font-semibold">Conflitos Detectados</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Os seguintes campos possuem valores diferentes. Escolha como resolver cada conflito:
                </p>

                {conflicts.map((conflict) => (
                  <div key={conflict.field} className="space-y-3 rounded-lg border border-border p-4 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">{conflict.label}</Label>
                      {resolutions.has(conflict.field) && <IconCheck className="h-5 w-5 text-success" />}
                    </div>

                    {conflict.type === "color" && (
                      <div className="space-y-2">
                        <RadioGroup
                          value={resolutions.get(conflict.field)?.action === "custom" ? "custom" : resolutions.get(conflict.field)?.selectedPaintId}
                          onValueChange={(value) => {
                            if (value === "custom") {
                              handleResolutionChange(conflict.field, {
                                field: conflict.field,
                                action: "custom",
                              });
                            } else {
                              handleResolutionChange(conflict.field, {
                                field: conflict.field,
                                action: "select",
                                selectedPaintId: value,
                              });
                            }
                          }}
                        >
                          {conflict.values.map((value) => (
                            <div key={value.paintId} className="flex items-center space-x-2">
                              <RadioGroupItem value={value.paintId} id={`${conflict.field}-${value.paintId}`} />
                              <Label htmlFor={`${conflict.field}-${value.paintId}`} className="cursor-pointer flex items-center gap-3">
                                <div
                                  className="h-6 w-6 rounded border border-border shadow-sm"
                                  style={{ backgroundColor: value.value }}
                                />
                                <span>{value.paintName}:</span>
                                <Badge variant="outline">{value.formatted}</Badge>
                              </Label>
                            </div>
                          ))}
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="custom" id={`${conflict.field}-custom`} />
                            <Label htmlFor={`${conflict.field}-custom`} className="cursor-pointer">
                              Cor personalizada
                            </Label>
                          </div>
                        </RadioGroup>
                        {resolutions.get(conflict.field)?.action === "custom" && (
                          <Input
                            type="text"
                            placeholder="#000000"
                            value={customValues.get(conflict.field) || ""}
                            onChange={(e) => {
                              handleCustomValueChange(conflict.field, e.target.value);
                              handleResolutionChange(conflict.field, {
                                field: conflict.field,
                                action: "custom",
                                customValue: e.target.value,
                              });
                            }}
                            className="max-w-xs"
                          />
                        )}
                      </div>
                    )}

                    {conflict.type === "single" && (
                      <RadioGroup
                        value={resolutions.get(conflict.field)?.selectedPaintId}
                        onValueChange={(paintId) =>
                          handleResolutionChange(conflict.field, {
                            field: conflict.field,
                            action: "select",
                            selectedPaintId: paintId,
                          })
                        }
                      >
                        {conflict.values.map((value) => (
                          <div key={value.paintId} className="flex items-center space-x-2">
                            <RadioGroupItem value={value.paintId} id={`${conflict.field}-${value.paintId}`} />
                            <Label htmlFor={`${conflict.field}-${value.paintId}`} className="cursor-pointer flex items-center gap-2">
                              <span>{value.paintName}:</span>
                              <Badge variant="outline">{value.formatted}</Badge>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {conflict.type === "array" && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Selecione quais valores manter:</p>
                        {conflict.values.map((value) => (
                          <div key={value.paintId} className="flex items-start space-x-2">
                            <Checkbox
                              id={`${conflict.field}-${value.paintId}`}
                              checked={resolutions.get(conflict.field)?.selectedIds?.includes(value.paintId)}
                              onCheckedChange={(checked) => {
                                const currentIds = resolutions.get(conflict.field)?.selectedIds || [];
                                const newIds = checked
                                  ? [...currentIds, value.paintId]
                                  : currentIds.filter((id) => id !== value.paintId);

                                handleResolutionChange(conflict.field, {
                                  field: conflict.field,
                                  action: "combine",
                                  selectedIds: newIds,
                                });
                              }}
                            />
                            <Label htmlFor={`${conflict.field}-${value.paintId}`} className="cursor-pointer">
                              <div>
                                <span className="font-medium">{value.paintName}</span>
                                <p className="text-sm text-muted-foreground">{value.formatted}</p>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Preview Section */}
            {mergedPreview && (
              <div className="space-y-3 rounded-lg border border-border p-4 bg-primary/5">
                <div className="flex items-center gap-2">
                  <IconArrowRight className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Pré-visualização do Resultado</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Nome</Label>
                    <p className="font-medium">{mergedPreview.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Código</Label>
                    <p className="font-medium">{mergedPreview.code || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cor</Label>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 rounded border border-border shadow-sm"
                        style={{ backgroundColor: mergedPreview.hex }}
                      />
                      <p className="font-medium">{mergedPreview.hex}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Acabamento</Label>
                    <p className="font-medium">
                      {mergedPreview.finish ? PAINT_FINISH_LABELS[mergedPreview.finish] : "N/A"}
                    </p>
                  </div>
                  {mergedPreview.manufacturer && (
                    <div>
                      <Label className="text-muted-foreground">Fabricante</Label>
                      <p className="font-medium">{TRUCK_MANUFACTURER_LABELS[mergedPreview.manufacturer]}</p>
                    </div>
                  )}
                  {mergedPreview.tags && mergedPreview.tags.length > 0 && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Tags</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {mergedPreview.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleMerge} disabled={isLoading || hasUnresolvedConflicts || !targetPaintId}>
            {isLoading ? (
              <>
                <IconLoader2 className="h-4 w-4 animate-spin" />
                Mesclando...
              </>
            ) : (
              <>
                <IconCheck className="h-4 w-4" />
                Mesclar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
