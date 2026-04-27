import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconCopy, IconCheck } from "@tabler/icons-react";
import { cmykToRgb, rgbToCmyk, rgbToHex, rgbToHsl, rgbToHsv } from "./cmyk-utils";

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

  if (!cell) return null;

  const { y, k, c, m } = cell;
  const [r, g, b] = cmykToRgb(c, m, y, k);
  const hex = rgbToHex(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);
  const hsl = rgbToHsl(r, g, b);
  const hsv = rgbToHsv(r, g, b);
  const tcsCode = `TCS-K${k}-Y${y}-C${c}-M${m}`;

  const rows = [
    { label: "HEX", value: hex },
    { label: "RGB", value: `rgb(${r}, ${g}, ${b})` },
    { label: "CMYK", value: `cmyk(${cmyk[0]}%, ${cmyk[1]}%, ${cmyk[2]}%, ${cmyk[3]}%)` },
    { label: "HSL", value: `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)` },
    { label: "HSV", value: `hsv(${hsv[0]}, ${hsv[1]}%, ${hsv[2]}%)` },
    { label: "TCS", value: tcsCode },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="h-40 w-full" style={{ backgroundColor: hex }} />
        <div className="p-5">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-base">
              K {k}% &middot; Y {y}%
            </DialogTitle>
            <DialogDescription>
              C {c}% &middot; M {m}%
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-0">
            {rows.map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0"
              >
                <span className="text-xs font-semibold text-muted-foreground w-12 tracking-wide">
                  {label}
                </span>
                <span className="flex-1 font-mono text-sm truncate px-2">{value}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
