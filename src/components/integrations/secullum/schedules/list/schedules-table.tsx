import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { cn } from "@/lib/utils";

export interface SecullumHorario {
  Id: number;
  Codigo: string;
  Descricao: string;
  HorarioFlexivel: boolean;
  Ativo: boolean;
  Entrada1?: string;
  Saida1?: string;
  Entrada2?: string;
  Saida2?: string;
  Entrada3?: string;
  Saida3?: string;
  ToleranciaEntrada?: number;
  ToleranciaSaida?: number;
  CargaHorariaDiaria?: string;
  CargaHorariaSemanal?: string;
  TipoHorario?: number;
  TipoHorarioDescricao?: string;
}

interface SchedulesTableProps {
  schedules: SecullumHorario[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}

function formatTime(time?: string): string {
  if (!time) return "-";
  // Time comes as "HH:mm:ss" or "HH:mm", extract just HH:mm
  const parts = time.split(":");
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return time;
}

function formatWorkload(workload?: string): string {
  if (!workload) return "-";
  // Workload comes as "HH:mm:ss", format as "HHh MMm"
  const parts = workload.split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }
  return workload;
}

export function SchedulesTable({
  schedules,
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
}: SchedulesTableProps) {
  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden h-full", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[80px] px-4 py-2">Código</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[200px] px-4 py-2">Descrição</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[90px] px-4 py-2">Entrada 1</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[90px] px-4 py-2">Saída 1</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[90px] px-4 py-2">Entrada 2</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[90px] px-4 py-2">Saída 2</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[110px] px-4 py-2">Carga Diária</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[100px] px-4 py-2">Tipo</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className="w-full table-fixed">
          <TableBody>
            {schedules.map((schedule, index) => (
              <TableRow
                key={schedule.Id}
                className={cn(
                  "transition-colors border-b border-border",
                  index % 2 === 1 && "bg-muted/10",
                  "hover:bg-muted/20"
                )}
              >
                <TableCell className="font-mono text-sm w-[80px] px-4 py-2">{schedule.Codigo || "-"}</TableCell>
                <TableCell className="font-medium w-[200px] px-4 py-2 truncate">{schedule.Descricao || "-"}</TableCell>
                <TableCell className="w-[90px] px-4 py-2">{formatTime(schedule.Entrada1)}</TableCell>
                <TableCell className="w-[90px] px-4 py-2">{formatTime(schedule.Saida1)}</TableCell>
                <TableCell className="w-[90px] px-4 py-2">{formatTime(schedule.Entrada2)}</TableCell>
                <TableCell className="w-[90px] px-4 py-2">{formatTime(schedule.Saida2)}</TableCell>
                <TableCell className="w-[110px] px-4 py-2">{formatWorkload(schedule.CargaHorariaDiaria)}</TableCell>
                <TableCell className="w-[100px] px-4 py-2">
                  <Badge variant="outline">{schedule.TipoHorarioDescricao || 'Semanal'}</Badge>
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
