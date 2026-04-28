import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconCopy, IconCheck } from "@tabler/icons-react";
import { cmykToRgb, rgbToCmyk, rgbToHex, rgbToHsl, rgbToHsv, rgbToCmykCap55 } from "./cmyk-utils";
import { usePaints } from "@/hooks";

interface ColorDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cell: { y: number; k: number; c: number; m: number } | null;
}

export function ColorDetailDialog({ open, onOpenChange, cell }: ColorDetailDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = useCallback((key: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    });
  }, []);

  const { y, k, c, m } = cell ?? { y: 0, k: 0, c: 0, m: 0 };
  const [r, g, b] = cmykToRgb(c, m, y, k);
  const hex = rgbToHex(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);
  const cmyk55 = rgbToCmykCap55(r, g, b);
  const hsl = rgbToHsl(r, g, b);
  const hsv = rgbToHsv(r, g, b);

  const rows = [
    { label: "HEX", value: hex },
    { label: "RGB", value: `rgb(${r}, ${g}, ${b})` },
    { label: "CMYK", value: `cmyk(${cmyk[0]}%, ${cmyk[1]}%, ${cmyk[2]}%, ${cmyk[3]}%)` },
    { label: "CMYK 55K", value: `cmyk(${cmyk55[0]}%, ${cmyk55[1]}%, ${cmyk55[2]}%, ${cmyk55[3]}%)` },
    { label: "HSL", value: `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)` },
    { label: "HSV", value: `hsv(${hsv[0]}, ${hsv[1]}%, ${hsv[2]}%)` },
  ];

  const isPureBlack = hex === "#000000";
  const { data: similarData, isLoading: similarLoading } = usePaints(
    { similarColor: hex, similarColorThreshold: 50, limit: 1, include: { paintBrand: true } as never },
    { enabled: open && !!cell && !isPureBlack },
  );
  const closestPaint = similarData?.data?.[0] ?? null;

  if (!cell) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogTitle className="sr-only">{hex}</DialogTitle>

        {/* Color preview */}
        <div className="h-36 w-full" style={{ backgroundColor: hex }} />

        <div className="p-5">
          {/* Color format rows */}
          <div className="space-y-0">
            {rows.map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0"
              >
                <span className="text-xs font-semibold text-muted-foreground w-16 tracking-wide shrink-0">
                  {label}
                </span>
                <span className="flex-1 font-mono text-sm truncate px-2">{value}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs shrink-0"
                  onClick={() => handleCopy(label, value)}
                >
                  {copiedKey === label ? (
                    <>
                      <IconCheck className="h-3.5 w-3.5 text-green-600" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <IconCopy className="h-3.5 w-3.5" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>

          {/* Closest catalogue paint */}
          {!isPureBlack && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-3">
                CATÁLOGO
              </p>
              {similarLoading ? (
                <div className="flex items-center gap-2.5 animate-pulse">
                  <div className="w-7 h-7 rounded-sm bg-muted shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="h-2.5 bg-muted rounded w-1/3" />
                  </div>
                </div>
              ) : !closestPaint ? (
                <p className="text-xs text-muted-foreground">Nenhuma cor similar no catálogo.</p>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-sm border border-border shrink-0"
                    style={{ backgroundColor: closestPaint.hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">{closestPaint.name}</p>
                    {closestPaint.paintBrand && (
                      <p className="text-xs text-muted-foreground truncate">{closestPaint.paintBrand.name}</p>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground shrink-0">
                    {closestPaint.hex.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
