import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconPrinter, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime } from "../../../../utils";
import { getThirteenthFirstDocument, getThirteenthSecondDocument } from "../../../../api-client/thirteenth";
import { thirteenthKeys } from "../../../../hooks/common/query-keys";
import type { Thirteenth } from "../../../../types/thirteenth";

interface InstallmentReciboProps {
  thirteenth: Thirteenth;
  installment: 1 | 2 | null;
  onClose: () => void;
}

function ReciboRow({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-200 last:border-0">
      <span className={cn("text-sm", strong ? "font-semibold" : "text-gray-700")}>{label}</span>
      <span className={cn("text-sm tabular-nums", strong ? "font-bold" : "font-medium")}>{value}</span>
    </div>
  );
}

export function InstallmentRecibo({ thirteenth, installment, onClose }: InstallmentReciboProps) {
  const open = installment !== null;

  const { data, isLoading, error } = useQuery({
    queryKey: thirteenthKeys.detail(thirteenth.id, { document: installment }),
    queryFn: () => (installment === 1 ? getThirteenthFirstDocument(thirteenth.id) : getThirteenthSecondDocument(thirteenth.id)),
    enabled: open,
    staleTime: 1000 * 60,
  });

  const doc = data?.data;

  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center justify-between gap-4">
            <span>Recibo — {installment === 1 ? "1ª" : "2ª"} parcela do 13º</span>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!doc}>
              <IconPrinter className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </DialogTitle>
          <DialogDescription>
            {installment === 1
              ? "Adiantamento da gratificação natalina (50%, sem descontos) — vencimento até 30/Nov."
              : "Segunda parcela com INSS e IRRF calculados sobre a base exclusiva do 13º — vencimento até 20/Dez."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <IconLoader2 className="h-6 w-6 animate-spin mr-2" />
            Gerando recibo...
          </div>
        ) : error || !doc ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-destructive">
            <IconAlertTriangle className="h-8 w-8 mb-3" />
            <div className="text-sm font-medium">Não foi possível gerar o recibo desta parcela.</div>
          </div>
        ) : (
          <div className="bg-white text-black p-2 print:p-0">
            <style>{`
              @media print {
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                @page { margin: 20mm; }
              }
            `}</style>

            <div className="mb-6 text-center border-b-2 border-gray-800 pb-3">
              <h1 className="text-xl font-bold">Recibo de Pagamento — 13º Salário</h1>
              <p className="text-sm text-gray-600 mt-1">
                {installment === 1 ? "1ª Parcela (Adiantamento)" : "2ª Parcela"} — Ano {doc.year}
              </p>
              <p className="text-xs text-gray-500 mt-1">Documento gerado em: {formatDateTime(new Date())}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">Colaborador</p>
              <p className="font-semibold">{doc.userName || thirteenth.user?.name || "-"}</p>
            </div>

            <div className="rounded-lg border border-gray-300 p-4 mb-4">
              <ReciboRow label="Avos" value={`${doc.avos}/12`} />
              <ReciboRow label="Base de cálculo (média de variáveis)" value={formatCurrency(doc.baseRemuneration)} />
              <ReciboRow label="Valor cheio do 13º (ano)" value={formatCurrency(doc.fullEntitlement)} />
            </div>

            <div className="rounded-lg border border-gray-300 p-4 mb-4">
              <ReciboRow label="Valor bruto da parcela" value={formatCurrency(doc.grossInstallment)} />
              {installment === 2 && (
                <>
                  <ReciboRow label="(-) INSS" value={`- ${formatCurrency(doc.inss)}`} />
                  <ReciboRow label="(-) IRRF" value={`- ${formatCurrency(doc.irrf)}`} />
                </>
              )}
              <ReciboRow label="Valor líquido a receber" value={formatCurrency(doc.netInstallment)} strong />
            </div>

            <div className="mb-6">
              <ReciboRow label="Vencimento" value={formatDate(new Date(doc.dueDate))} />
            </div>

            {doc.notes && <p className="text-xs text-gray-600 mb-6 whitespace-pre-wrap">Obs.: {doc.notes}</p>}

            <div className="mt-12 grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="border-t border-gray-800 pt-2 mt-12">
                  <p className="font-semibold text-sm">{doc.userName || thirteenth.user?.name || "Colaborador"}</p>
                  <p className="text-xs text-gray-600">Assinatura do Colaborador</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-800 pt-2 mt-12">
                  <p className="font-semibold text-sm">Departamento Pessoal</p>
                  <p className="text-xs text-gray-600">Assinatura e Carimbo</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-3 border-t border-gray-300 text-center text-xs text-gray-500">
              <p>Este documento foi gerado eletronicamente e é válido sem assinatura digital.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
