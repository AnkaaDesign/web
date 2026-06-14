import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IconSparkles, IconLoader2, IconCircleCheck, IconAlertTriangle } from "@tabler/icons-react";
import { useThirteenthGenerate } from "../../../../hooks/personnel-department/use-thirteenths";
import type { ThirteenthGenerateResult } from "../../../../types/thirteenth";

interface ThirteenthGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThirteenthGenerateDialog({ open, onOpenChange }: ThirteenthGenerateDialogProps) {
  const generate = useThirteenthGenerate();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState<number>(currentYear);
  const [recompute, setRecompute] = useState(false);
  const [result, setResult] = useState<ThirteenthGenerateResult | null>(null);

  const handleClose = (next: boolean) => {
    if (!next) {
      // Reset for the next open
      setResult(null);
      setRecompute(false);
      setYear(currentYear);
    }
    onOpenChange(next);
  };

  const handleGenerate = async () => {
    try {
      const response = await generate.mutateAsync({ year, recompute });
      setResult(response.data ?? null);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error generating thirteenths:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconSparkles className="h-5 w-5 text-muted-foreground" />
            Gerar 13º do ano
          </DialogTitle>
          <DialogDescription>
            Gera os registros de 13º salário para todos os colaboradores CLT ativos elegíveis no ano informado. Os avos são calculados pela data de admissão do vínculo atual
            (≥ 15 dias = 1 avo).
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <Alert variant="success">
              <IconCircleCheck className="h-4 w-4" />
              <AlertTitle>Geração concluída — {result.year}</AlertTitle>
              <AlertDescription>
                {result.created} registro(s) criado(s), {result.updated} atualizado(s).
              </AlertDescription>
            </Alert>

            {result.skipped.length > 0 && (
              <div className="rounded-lg border border-border">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-sm font-medium">
                  <IconAlertTriangle className="h-4 w-4 text-muted-foreground" />
                  Ignorados ({result.skipped.length})
                </div>
                <ul className="max-h-48 overflow-y-auto divide-y divide-border text-sm">
                  {result.skipped.map((s, i) => (
                    <li key={`${s.userId}-${i}`} className="px-3 py-2 flex items-center justify-between gap-3">
                      <span className="truncate">{s.userName || s.userId}</span>
                      <span className="text-xs text-muted-foreground text-right">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Ano</Label>
              <Input type="number" min={2000} max={2100} value={year} onChange={(value) => setYear(Number(value) || currentYear)} />
            </div>

            <div className="flex items-start gap-2">
              <Checkbox id="thirteenth-recompute" checked={recompute} onCheckedChange={(v) => setRecompute(v === true)} />
              <div className="grid gap-1 leading-none">
                <Label htmlFor="thirteenth-recompute" className="cursor-pointer">
                  Recalcular registros existentes
                </Label>
                <p className="text-xs text-muted-foreground">Mantém o status e as datas de pagamento já lançadas; apenas recalcula avos, base e parcelas.</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={generate.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={generate.isPending}>
                {generate.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconSparkles className="h-4 w-4 mr-2" />}
                Gerar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
