import React, { useState } from "react";
import { format, parseISO, isBefore, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { SecullumHolidayData } from "../../../../../schemas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HolidaysContextMenu } from "./holidays-context-menu";

// Use the proper type from schemas
type SecullumHoliday = SecullumHolidayData;

interface HolidaysTableProps {
  holidays: SecullumHoliday[];
  onEdit?: (holiday: SecullumHoliday) => void;
}

export function HolidaysTable({ holidays, onEdit }: HolidaysTableProps) {
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
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Feriado</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Dia da Semana</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holidays.map((holiday) => {
            const holidayDate = parseISO(holiday.Data);
            const daysUntil = getDaysUntil(holiday.Data);
            const isPast = isPastDate(holiday.Data);

            return (
              <TableRow key={holiday.Id} className="cursor-pointer hover:bg-muted/20" onContextMenu={(e) => handleContextMenu(e, holiday)}>
                <TableCell className="font-medium">{holiday.Descricao}</TableCell>
                <TableCell>{format(holidayDate, "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                <TableCell>
                  <span className="capitalize">{format(holidayDate, "EEEE", { locale: ptBR })}</span>
                </TableCell>
                <TableCell>
                  <span className={isPast ? "text-muted-foreground" : daysUntil === "Hoje" ? "text-destructive font-medium" : daysUntil === "Amanhã" ? "text-foreground font-medium" : ""}>
                    {daysUntil}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Context Menu */}
      <HolidaysContextMenu contextMenu={contextMenu} onClose={handleCloseContextMenu} onEdit={onEdit} />
    </>
  );
}
