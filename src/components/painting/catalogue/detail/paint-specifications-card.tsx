import { useState } from "react";
import { toast } from "sonner";
import { IconInfoCircle, IconCopy, IconPalette } from "@tabler/icons-react";

import type { Paint } from "../../../../types";
import { PAINT_BRAND_LABELS, PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS, COLOR_PALETTE_LABELS, PAINT_FINISH } from "../../../../constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CanvasNormalMapRenderer } from "@/components/paint/effects/canvas-normal-map-renderer";
import { cn } from "@/lib/utils";

interface PaintSpecificationsCardProps {
  paint: Paint;
  className?: string;
}

export function PaintSpecificationsCard({ paint, className }: PaintSpecificationsCardProps) {
  const [_copiedText, setCopiedText] = useState<string | null>(null);

  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  const rgbToLab = (r: number, g: number, b: number): { l: number; a: number; b: number } => {
    // Convert RGB to XYZ
    let varR = r / 255;
    let varG = g / 255;
    let varB = b / 255;

    if (varR > 0.04045) varR = Math.pow((varR + 0.055) / 1.055, 2.4);
    else varR = varR / 12.92;
    if (varG > 0.04045) varG = Math.pow((varG + 0.055) / 1.055, 2.4);
    else varG = varG / 12.92;
    if (varB > 0.04045) varB = Math.pow((varB + 0.055) / 1.055, 2.4);
    else varB = varB / 12.92;

    varR = varR * 100;
    varG = varG * 100;
    varB = varB * 100;

    // Observer. = 2°, Illuminant = D65
    const X = varR * 0.4124 + varG * 0.3576 + varB * 0.1805;
    const Y = varR * 0.2126 + varG * 0.7152 + varB * 0.0722;
    const Z = varR * 0.0193 + varG * 0.1192 + varB * 0.9505;

    // Convert XYZ to LAB
    let varX = X / 95.047;
    let varY = Y / 100.0;
    let varZ = Z / 108.883;

    if (varX > 0.008856) varX = Math.pow(varX, 1 / 3);
    else varX = 7.787 * varX + 16 / 116;
    if (varY > 0.008856) varY = Math.pow(varY, 1 / 3);
    else varY = 7.787 * varY + 16 / 116;
    if (varZ > 0.008856) varZ = Math.pow(varZ, 1 / 3);
    else varZ = 7.787 * varZ + 16 / 116;

    const L = 116 * varY - 16;
    const A = 500 * (varX - varY);
    const B = 200 * (varY - varZ);

    return { l: Math.round(L), a: Math.round(A), b: Math.round(B) };
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (error) {
      toast.error("Erro ao copiar");
    }
  };

  const rgb = hexToRgb(paint.hex);
  const lab = rgb ? rgbToLab(rgb.r, rgb.g, rgb.b) : null;

  return (
    <Card className={cn("shadow-sm border border-border", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconInfoCircle className="h-5 w-5 text-primary" />
          </div>
          Especificações
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 space-y-6">
        {/* Color Information */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <IconPalette className="h-4 w-4" />
            Cor
          </h3>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-6">
              {/* Color Preview - Increased size with effects based on finish */}
              <div className="w-32 h-32 rounded-lg shadow-inner border-2 border-muted flex-shrink-0 relative overflow-hidden">
                {paint.finish ? (
                  <CanvasNormalMapRenderer baseColor={paint.hex} finish={paint.finish as PAINT_FINISH} width={128} height={128} className="w-full h-full" quality="high" />
                ) : (
                  <div className="w-full h-full" style={{ backgroundColor: paint.hex }} />
                )}
              </div>

              {/* Color Codes - Better aligned */}
              <div className="flex-1 space-y-3 pt-2">
                <div className="grid grid-cols-[60px_1fr_auto] items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">HEX</span>
                  <code className="px-2 py-1 bg-muted rounded text-sm font-mono">{paint.hex.toUpperCase()}</code>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(paint.hex.toUpperCase(), "HEX")}>
                    <IconCopy className="h-4 w-4" />
                  </Button>
                </div>

                {rgb && (
                  <div className="grid grid-cols-[60px_1fr_auto] items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">RGB</span>
                    <code className="px-2 py-1 bg-muted rounded text-sm font-mono">{`${rgb.r}, ${rgb.g}, ${rgb.b}`}</code>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(`${rgb.r}, ${rgb.g}, ${rgb.b}`, "RGB")}>
                      <IconCopy className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {lab && (
                  <div className="grid grid-cols-[60px_1fr_auto] items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">LAB</span>
                    <code className="px-2 py-1 bg-muted rounded text-sm font-mono">{`L:${lab.l} a:${lab.a} b:${lab.b}`}</code>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(`L:${lab.l} a:${lab.a} b:${lab.b}`, "LAB")}>
                      <IconCopy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Basic Information */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Informações Básicas</h3>
          <div className="space-y-2">
            {paint.code && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Código</span>
                <span className="text-sm font-medium">{paint.code}</span>
              </div>
            )}
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Marca</span>
              <span className="text-sm font-medium">{paint.paintBrand?.name || "N/A"}</span>
            </div>
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Acabamento</span>
              <span className="text-sm font-medium">{PAINT_FINISH_LABELS[paint.finish]}</span>
            </div>
            {paint.manufacturer && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Fabricante</span>
                <span className="text-sm font-medium">{TRUCK_MANUFACTURER_LABELS[paint.manufacturer]}</span>
              </div>
            )}
            {paint.palette && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Paleta de Cor</span>
                <span className="text-sm font-medium">{COLOR_PALETTE_LABELS[paint.palette]}</span>
              </div>
            )}
            {paint.paintType && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Tipo de Tinta</span>
                <span className="text-sm font-medium">{paint.paintType.name}</span>
              </div>
            )}
            {paint.tags && paint.tags.length > 0 && (
              <div className="flex justify-between items-start bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Tags</span>
                <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                  {paint.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
