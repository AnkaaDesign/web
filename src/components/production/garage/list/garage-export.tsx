import { useState } from "react";
import { IconDownload, IconFileSpreadsheet, IconFileTypePdf } from "@tabler/icons-react";

import type { Garage, GarageGetManyFormData } from "../../../../types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface GarageExportProps {
  filters?: Partial<GarageGetManyFormData>;
  currentGarages?: Garage[];
  totalRecords?: number;
  selectedGarages?: Set<string>;
}

export function GarageExport({ filters, currentGarages = [], totalRecords = 0, selectedGarages }: GarageExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "excel" | "pdf", scope: "all" | "current" | "selected") => {
    setIsExporting(true);

    try {
      // TODO: Implement actual export functionality
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate export

      let message = "";
      if (scope === "selected" && selectedGarages) {
        message = `${selectedGarages.size} garagens selecionadas exportadas para ${format.toUpperCase()}`;
      } else if (scope === "current") {
        message = `${currentGarages.length} garagens da página atual exportadas para ${format.toUpperCase()}`;
      } else {
        message = `${totalRecords} garagens exportadas para ${format.toUpperCase()}`;
      }

      toast.success(message);
    } catch (error) {
      toast.error("Erro ao exportar garagens");
    } finally {
      setIsExporting(false);
    }
  };

  const hasSelected = selectedGarages && selectedGarages.size > 0;
  const hasCurrent = currentGarages.length > 0;
  const hasAll = totalRecords > 0;

  if (!hasAll) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          <IconDownload className="h-4 w-4 mr-2" />
          {isExporting ? "Exportando..." : "Exportar"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Formato de Exportação</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Excel Export Options */}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Excel (.xlsx)</DropdownMenuLabel>

        {hasSelected && (
          <DropdownMenuItem onClick={() => handleExport("excel", "selected")} className="cursor-pointer">
            <IconFileSpreadsheet className="h-4 w-4 mr-2" />
            Selecionadas ({selectedGarages!.size})
          </DropdownMenuItem>
        )}

        {hasCurrent && (
          <DropdownMenuItem onClick={() => handleExport("excel", "current")} className="cursor-pointer">
            <IconFileSpreadsheet className="h-4 w-4 mr-2" />
            Página Atual ({currentGarages.length})
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => handleExport("excel", "all")} className="cursor-pointer">
          <IconFileSpreadsheet className="h-4 w-4 mr-2" />
          Todas ({totalRecords})
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* PDF Export Options */}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">PDF (.pdf)</DropdownMenuLabel>

        {hasSelected && (
          <DropdownMenuItem onClick={() => handleExport("pdf", "selected")} className="cursor-pointer">
            <IconFileTypePdf className="h-4 w-4 mr-2" />
            Selecionadas ({selectedGarages!.size})
          </DropdownMenuItem>
        )}

        {hasCurrent && (
          <DropdownMenuItem onClick={() => handleExport("pdf", "current")} className="cursor-pointer">
            <IconFileTypePdf className="h-4 w-4 mr-2" />
            Página Atual ({currentGarages.length})
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => handleExport("pdf", "all")} className="cursor-pointer">
          <IconFileTypePdf className="h-4 w-4 mr-2" />
          Todas ({totalRecords})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
