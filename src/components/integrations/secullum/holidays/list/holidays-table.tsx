import React, { useState } from "react";
import { format, parseISO, isBefore, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { SecullumHolidayData } from "../../../../../schemas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { HolidaysContextMenu } from "./holidays-context-menu";
import { cn } from "@/lib/utils";

// Use the proper type from schemas
type SecullumHoliday = SecullumHolidayData;

interface HolidaysTableProps {
  holidays: SecullumHoliday[];
  onEdit?: (holiday: SecullumHoliday) => void;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}

export function HolidaysTable({
  holidays,
  onEdit,
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
}: HolidaysTableProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    holiday: SecullumHoliday;
  } | null>(null);

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, holiday: SecullumHoliday) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      holiday,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const getDaysUntil = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const holidayDate = parseISO(dateString);
    holidayDate.setHours(0, 0, 0, 0);

    const diffDays = differenceInDays(holidayDate, today);

    if (diffDays < 0) return "Passado";
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Amanhã";
    if (diffDays < 7) return `Em ${diffDays} dias`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? "Em 1 semana" : `Em ${weeks} semanas`;
    }
    const months = Math.floor(diffDays / 30);
    return months === 1 ? "Em 1 mês" : `Em ${months} meses`;
  };

  const isPastDate = (dateString: string) => {
    const holidayDate = parseISO(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return isBefore(holidayDate, today);
  };

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden h-full", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[40%] px-4 py-2">Feriado</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[20%] px-4 py-2">Data</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[20%] px-4 py-2">Dia da Semana</TableHead>
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-[20%] px-4 py-2">Status</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className="w-full table-fixed">
          <TableBody>
            {holidays.map((holiday, index) => {
              const holidayDate = parseISO(holiday.Data);
              const daysUntil = getDaysUntil(holiday.Data);
              const isPast = isPastDate(holiday.Data);

              return (
                <TableRow
                  key={holiday.Id}
                  className={cn(
                    "cursor-pointer transition-colors border-b border-border",
                    index % 2 === 1 && "bg-muted/10",
                    "hover:bg-muted/20"
                  )}
                  onContextMenu={(e) => handleContextMenu(e, holiday)}
                >
                  <TableCell className="font-medium w-[40%] px-4 py-2 truncate">{holiday.Descricao}</TableCell>
                  <TableCell className="w-[20%] px-4 py-2">{format(holidayDate, "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                  <TableCell className="w-[20%] px-4 py-2">
                    <span className="capitalize">{format(holidayDate, "EEEE", { locale: ptBR })}</span>
                  </TableCell>
                  <TableCell className="w-[20%] px-4 py-2">
                    <span className={isPast ? "text-muted-foreground" : daysUntil === "Hoje" ? "text-destructive font-medium" : daysUntil === "Amanhã" ? "text-foreground font-medium" : ""}>
                      {daysUntil}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
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

      {/* Context Menu */}
      <HolidaysContextMenu contextMenu={contextMenu} onClose={handleCloseContextMenu} onEdit={onEdit} />
    </div>
  );
}
