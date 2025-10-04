import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { IconPrinter } from "@tabler/icons-react";
import type { Borrow } from "../../../../types";
import { BORROW_STATUS, BORROW_STATUS_LABELS } from "../../../../constants";
import { formatDateTime } from "../../../../utils";
import { cn } from "@/lib/utils";

interface BorrowPrintViewProps {
  borrow: Borrow;
  className?: string;
  showPrintButton?: boolean;
}

export function BorrowPrintView({ borrow, className, showPrintButton = true }: BorrowPrintViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const isReturned = borrow.status === BORROW_STATUS.RETURNED;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {showPrintButton && (
        <div className="mb-4 print:hidden">
          <Button onClick={handlePrint} variant="outline" size="sm">
            <IconPrinter className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      )}

      <div ref={printRef} className={cn("bg-white text-black print:text-black", "print:block print:m-0 print:p-0", "@media print { @page { margin: 20mm; } }", className)}>
        {/* Print Styles */}
        <style>{`
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        `}</style>

        {/* Header */}
        <div className="mb-8 text-center border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold mb-2">Comprovante de Empréstimo</h1>
          <p className="text-sm text-gray-600">Documento gerado em: {formatDateTime(new Date())}</p>
        </div>

        {/* Company Info (you can customize this) */}
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold">Nome da Empresa</h2>
          <p className="text-sm text-gray-600">CNPJ: XX.XXX.XXX/XXXX-XX</p>
          <p className="text-sm text-gray-600">Endereço da empresa</p>
          <p className="text-sm text-gray-600">Telefone: (XX) XXXX-XXXX</p>
        </div>

        {/* Borrow ID and Status */}
        <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-gray-50">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-600">Código do Empréstimo</p>
              <p className="text-lg font-mono font-bold">#{borrow.id.slice(-8).toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p className={cn("text-lg font-bold", isReturned ? "text-green-600" : "text-blue-600")}>{BORROW_STATUS_LABELS[borrow.status]}</p>
            </div>
          </div>
        </div>

        {/* Item Information */}
        {borrow.item && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-2">Informações do Item</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Nome do Item</p>
                <p className="font-semibold">{borrow.item.name}</p>
              </div>
              {borrow.item.uniCode && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Código</p>
                  <p className="font-mono font-semibold">{borrow.item.uniCode}</p>
                </div>
              )}
              {borrow.item.category && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Categoria</p>
                  <p className="font-semibold">{borrow.item.category.name}</p>
                </div>
              )}
              {borrow.item.brand && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Marca</p>
                  <p className="font-semibold">{borrow.item.brand.name}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Information */}
        {borrow.user && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-2">Informações do Responsável</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Nome</p>
                <p className="font-semibold">{borrow.user.name}</p>
              </div>
              {borrow.user.cpf && (
                <div>
                  <p className="text-sm font-medium text-gray-600">CPF</p>
                  <p className="font-semibold">{borrow.user.cpf}</p>
                </div>
              )}
              {borrow.user.position && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Cargo</p>
                  <p className="font-semibold">{borrow.user.position.name}</p>
                </div>
              )}
              {borrow.user.sector && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Setor</p>
                  <p className="font-semibold">{borrow.user.sector.name}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Borrow Details */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-2">Detalhes do Empréstimo</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Quantidade</p>
              <p className="text-lg font-bold">{borrow.quantity}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Data do Empréstimo</p>
              <p className="font-semibold">{formatDateTime(borrow.createdAt)}</p>
            </div>
            {isReturned && borrow.returnedAt && (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-600">Data de Devolução</p>
                  <p className="font-semibold">{formatDateTime(borrow.returnedAt)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Duração do Empréstimo</p>
                  <p className="font-semibold">{Math.ceil((new Date(borrow.returnedAt).getTime() - new Date(borrow.createdAt).getTime()) / (1000 * 60 * 60 * 24))} dias</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="mb-8 p-4 bg-gray-50 border border-gray-300 rounded-lg">
          <h4 className="font-semibold mb-2">Termos e Condições</h4>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
            <li>O responsável se compromete a devolver o item em perfeitas condições</li>
            <li>Em caso de dano ou perda, o responsável deverá arcar com os custos de reposição</li>
            <li>O prazo de devolução deve ser respeitado conforme acordado</li>
            <li>Este documento serve como comprovante oficial do empréstimo</li>
          </ul>
        </div>

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="border-t border-gray-800 pt-2 mt-16">
              <p className="font-semibold">{borrow.user?.name || "Responsável pelo Empréstimo"}</p>
              <p className="text-sm text-gray-600">Assinatura do Responsável</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-800 pt-2 mt-16">
              <p className="font-semibold">Responsável pelo Estoque</p>
              <p className="text-sm text-gray-600">Assinatura e Carimbo</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-600">
          <p>Este documento foi gerado eletronicamente e é válido sem assinatura digital</p>
          <p>Para verificar a autenticidade, consulte o código: {borrow.id}</p>
        </div>
      </div>
    </>
  );
}
