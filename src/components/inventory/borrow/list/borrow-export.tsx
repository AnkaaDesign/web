import { Button } from "@/components/ui/button";
import { IconDownload } from "@tabler/icons-react";
import type { Borrow } from "../../../../types";
import type { BorrowGetManyFormData } from "../../../../schemas";
import { BORROW_STATUS_LABELS } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { toast } from "sonner";

interface BorrowExportProps {
  filters: Partial<BorrowGetManyFormData>;
  currentItems: Borrow[];
  totalRecords: number;
  visibleColumns: Set<string>;
}

export function BorrowExport({ currentItems, visibleColumns }: BorrowExportProps) {
  const handleExport = () => {
    try {
      // Prepare CSV headers based on visible columns
      const headers: string[] = [];
      const columnMapping: Record<string, string> = {
        item: "Item",
        user: "Usuário",
        quantity: "Quantidade",
        status: "Status",
        createdAt: "Data do Empréstimo",
        returnedAt: "Data de Devolução",
      };

      visibleColumns.forEach((col) => {
        if (columnMapping[col]) {
          headers.push(columnMapping[col]);
        }
      });

      // Prepare CSV rows
      const rows = currentItems.map((borrow) => {
        const row: string[] = [];

        if (visibleColumns.has("item")) {
          row.push(borrow.item?.name || "-");
        }
        if (visibleColumns.has("user")) {
          row.push(borrow.user?.name || "-");
        }
        if (visibleColumns.has("quantity")) {
          row.push(borrow.quantity.toString());
        }
        if (visibleColumns.has("status")) {
          row.push(BORROW_STATUS_LABELS[borrow.status] || borrow.status);
        }
        if (visibleColumns.has("createdAt")) {
          row.push(formatDate(borrow.createdAt));
        }
        if (visibleColumns.has("returnedAt")) {
          row.push(borrow.returnedAt ? formatDate(borrow.returnedAt) : "-");
        }

        return row;
      });

      // Convert to CSV format
      const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))].join("\n");

      // Create blob and download
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", `emprestimos_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`${currentItems.length} empréstimos exportados com sucesso`);
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error("Export error:", error);
    }
  };

  return (
    <Button variant="outline" size="default" onClick={handleExport} disabled={currentItems.length === 0} className="group">
      <IconDownload className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      <span className="text-foreground">Exportar</span>
    </Button>
  );
}
