import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { routes } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { cn } from "@/lib/utils";

export interface SecullumAssinatura {
  Id: number;
  Descricao: string;
  DataInicio: string;
  DataFim: string;
  DataInclusao: string;
  NumeroCartoes: number;
  Aprovados: number;
  Rejeitados: number;
  Compactada: boolean;
}

interface AssinaturaTableProps {
  apuracoes: SecullumAssinatura[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}

export function AssinaturaTable({
  apuracoes,
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
}: AssinaturaTableProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden h-full", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[90px] px-4 py-2">Número</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2">Descrição</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[120px] px-4 py-2">Início</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[120px] px-4 py-2">Fim</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[110px] px-4 py-2 text-right">Cartões</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[120px] px-4 py-2 text-right">Aprovados</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[120px] px-4 py-2 text-right">Rejeitados</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className="w-full table-fixed">
          <TableBody>
            {apuracoes.map((apuracao, index) => (
              <TableRow
                key={apuracao.Id}
                className={cn(
                  "transition-colors border-b border-border cursor-pointer",
                  index % 2 === 1 && "bg-muted/10",
                  "hover:bg-muted/30",
                )}
                onClick={() => navigate(routes.humanResources.timeClock.assinaturaDigital.details(apuracao.Id))}
              >
                <TableCell className="font-mono text-sm w-[90px] px-4 py-2">{apuracao.Id}</TableCell>
                <TableCell className="font-medium px-4 py-2 truncate">{apuracao.Descricao || "-"}</TableCell>
                <TableCell className="w-[120px] px-4 py-2">{formatDate(apuracao.DataInicio)}</TableCell>
                <TableCell className="w-[120px] px-4 py-2">{formatDate(apuracao.DataFim)}</TableCell>
                <TableCell className="w-[110px] px-4 py-2 text-right tabular-nums">{apuracao.NumeroCartoes}</TableCell>
                <TableCell className="w-[120px] px-4 py-2 text-right">
                  {apuracao.Aprovados > 0 ? (
                    <Badge variant="success" className="tabular-nums">{apuracao.Aprovados}</Badge>
                  ) : (
                    <span className="text-muted-foreground tabular-nums">0</span>
                  )}
                </TableCell>
                <TableCell className="w-[120px] px-4 py-2 text-right">
                  {apuracao.Rejeitados > 0 ? (
                    <Badge variant="destructive" className="tabular-nums">{apuracao.Rejeitados}</Badge>
                  ) : (
                    <span className="text-muted-foreground tabular-nums">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <SimplePaginationAdvanced
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={[10, 20, 50, 100]}
          showPageSizeSelector={true}
          showGoToPage={totalPages > 5}
          showPageInfo={true}
        />
      </div>
    </div>
  );
}
