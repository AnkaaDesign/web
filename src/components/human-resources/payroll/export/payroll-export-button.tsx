import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconDownload, IconFileTypeCsv, IconFileTypeXls, IconFileTypePdf } from "@tabler/icons-react";
import { toast } from "@/components/ui/sonner";
import { formatCurrency } from "../../../../utils";
import type { User } from "../../../../types";

interface PayrollExportButtonProps {
  users: User[];
  isLoading?: boolean;
  className?: string;
}

export function PayrollExportButton({ users, isLoading, className }: PayrollExportButtonProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const calculatePayrollData = (user: User) => {
    const baseRemuneration = user.position?.remuneration || 0;
    let bonusMultiplier = 0;

    // Calculate bonus based on performance level
    switch (user.performanceLevel) {
      case 4: // Excellent
        bonusMultiplier = 0.15;
        break;
      case 3: // Good
        bonusMultiplier = 0.10;
        break;
      case 2: // Fair
        bonusMultiplier = 0.05;
        break;
      case 1: // Poor
        bonusMultiplier = 0;
        break;
      default:
        bonusMultiplier = 0.05;
    }

    const bonus = baseRemuneration * bonusMultiplier;
    const total = baseRemuneration + bonus;

    return { baseRemuneration, bonus, total };
  };

  const getPerformanceLevelText = (level: number): string => {
    switch (level) {
      case 1:
        return "Ruim";
      case 2:
        return "Regular";
      case 3:
        return "Bom";
      case 4:
        return "Excelente";
      default:
        return "Regular";
    }
  };

  const exportToCsv = async () => {
    try {
      setExporting("csv");

      // Prepare CSV headers
      const headers = [
        "Matrícula",
        "Nome",
        "Cargo",
        "Setor",
        "Nível de Performance",
        "Bonificação",
        "Remuneração",
        "Total"
      ];

      // Prepare CSV data
      const csvData = users.map(user => {
        const { baseRemuneration, bonus, total } = calculatePayrollData(user);

        return [
          user.payrollNumber ? user.payrollNumber.toString().padStart(4, "0") : "-",
          user.name,
          user.position?.name || "-",
          user.sector?.name || "-",
          getPerformanceLevelText(user.performanceLevel),
          formatCurrency(bonus),
          formatCurrency(baseRemuneration),
          formatCurrency(total)
        ];
      });

      // Create CSV content
      const csvContent = [
        headers.join(","),
        ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `folha_pagamento_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Arquivo CSV exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Erro ao exportar arquivo CSV");
    } finally {
      setExporting(null);
    }
  };

  const exportToExcel = async () => {
    try {
      setExporting("excel");

      // For simplicity, we'll use the same CSV format with .xlsx extension
      // In a real application, you'd want to use a proper Excel library like xlsx
      const headers = [
        "Matrícula",
        "Nome",
        "Cargo",
        "Setor",
        "Nível de Performance",
        "Bonificação",
        "Remuneração",
        "Total"
      ];

      const csvData = users.map(user => {
        const { baseRemuneration, bonus, total } = calculatePayrollData(user);

        return [
          user.payrollNumber ? user.payrollNumber.toString().padStart(4, "0") : "-",
          user.name,
          user.position?.name || "-",
          user.sector?.name || "-",
          getPerformanceLevelText(user.performanceLevel),
          formatCurrency(bonus),
          formatCurrency(baseRemuneration),
          formatCurrency(total)
        ];
      });

      const csvContent = [
        headers.join(","),
        ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `folha_pagamento_${new Date().toISOString().split("T")[0]}.xlsx`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Arquivo Excel exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast.error("Erro ao exportar arquivo Excel");
    } finally {
      setExporting(null);
    }
  };

  const exportToPdf = async () => {
    try {
      setExporting("pdf");

      // This is a placeholder for PDF export
      // In a real application, you'd want to use a proper PDF library like jsPDF or generate on the backend
      toast.info("Export de PDF será implementado em breve");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar arquivo PDF");
    } finally {
      setExporting(null);
    }
  };

  const isDisabled = isLoading || users.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={isDisabled}
          className={className}
        >
          <IconDownload size={16} className="mr-2" />
          Exportar ({users.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCsv} disabled={exporting === "csv"}>
          <IconFileTypeCsv size={16} className="mr-2" />
          {exporting === "csv" ? "Exportando..." : "Exportar como CSV"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel} disabled={exporting === "excel"}>
          <IconFileTypeXls size={16} className="mr-2" />
          {exporting === "excel" ? "Exportando..." : "Exportar como Excel"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPdf} disabled={exporting === "pdf"}>
          <IconFileTypePdf size={16} className="mr-2" />
          {exporting === "pdf" ? "Exportando..." : "Exportar como PDF"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}