import { useState } from "react";
import { IconDownload, IconFileTypeCsv, IconFileTypeXls, IconFileTypePdf } from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type ExportFormat = "csv" | "excel" | "pdf";
export type ExportScope = "current" | "all";

export interface ExportColumn<T> {
  id: string;
  label: string;
  getValue: (item: T) => string;
}

export interface BaseExportPopoverProps<T> {
  className?: string;
  currentItems: T[];
  totalRecords?: number;
  selectedItems?: Set<string>;
  visibleColumns?: Set<string>;
  exportColumns: ExportColumn<T>[];
  defaultVisibleColumns?: Set<string>;
  onExport: (format: ExportFormat, items: T[], columns: ExportColumn<T>[]) => Promise<void>;
  onFetchAllItems?: () => Promise<T[]>;
  entityName: string;
  entityNamePlural: string;
}

export function BaseExportPopover<T extends { id: string }>({
  className,
  currentItems = [],
  totalRecords = 0,
  selectedItems,
  visibleColumns,
  exportColumns,
  defaultVisibleColumns,
  onExport,
  onFetchAllItems,
  entityName,
  entityNamePlural,
}: BaseExportPopoverProps<T>) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exportScope, setExportScope] = useState<ExportScope>("current");
  const [open, setOpen] = useState(false);

  // Use provided visible columns or default
  const columnsToExport = visibleColumns || defaultVisibleColumns || new Set(exportColumns.map((col) => col.id));

  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Determine items to export
      let itemsToExport: T[] = [];

      // If there are selected items, export only those
      if (selectedItems && selectedItems.size > 0) {
        itemsToExport = currentItems.filter((item) => selectedItems.has(item.id));
      } else if (exportScope === "current") {
        // Export only current view items
        itemsToExport = currentItems;
      } else if (onFetchAllItems) {
        // Export all items based on current filters
        itemsToExport = await onFetchAllItems();
      }

      if (itemsToExport.length === 0) {
        return;
      }

      // Get only visible columns
      const visibleExportColumns = exportColumns.filter((col) => columnsToExport.has(col.id));

      // Call the provided export handler
      await onExport(exportFormat, itemsToExport, visibleExportColumns);

      // Close popover after successful export
      setOpen(false);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case "csv":
        return IconFileTypeCsv;
      case "excel":
        return IconFileTypeXls;
      case "pdf":
        return IconFileTypePdf;
    }
  };

  const FormatIcon = getFormatIcon(exportFormat);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="default" className={cn("gap-2", className)} disabled={isExporting}>
          {isExporting ? (
            <>
              <IconDownload className="h-4 w-4 animate-pulse" />
              Exportando...
            </>
          ) : (
            <>
              <IconDownload className="h-4 w-4" />
              Exportar
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium leading-none mb-3">Formato de exportação</h4>
            <RadioGroup value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormat)}>
              <div className="flex items-center space-x-2 py-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer flex-1">
                  <IconFileTypeCsv className="h-4 w-4" />
                  CSV (.csv)
                </Label>
              </div>
              <div className="flex items-center space-x-2 py-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="flex items-center gap-2 cursor-pointer flex-1">
                  <IconFileTypeXls className="h-4 w-4" />
                  Excel (.xls)
                </Label>
              </div>
              <div className="flex items-center space-x-2 py-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer flex-1">
                  <IconFileTypePdf className="h-4 w-4" />
                  PDF (.pdf)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium leading-none mb-3">Escopo da exportação</h4>
            {selectedItems && selectedItems.size > 0 ? (
              <div className="py-2">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Itens selecionados</span>
                  <span className="text-xs text-muted-foreground">
                    Exportar {selectedItems.size} {selectedItems.size === 1 ? entityName : entityNamePlural} selecionados
                  </span>
                </div>
              </div>
            ) : (
              <RadioGroup value={exportScope} onValueChange={(value) => setExportScope(value as ExportScope)}>
                <div className="flex items-start space-x-2 py-2">
                  <RadioGroupItem value="current" id="current" className="mt-1" />
                  <Label htmlFor="current" className="cursor-pointer">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">Visualização atual</span>
                      <span className="text-xs text-muted-foreground">
                        Exportar {currentItems.length} {currentItems.length === 1 ? entityName : entityNamePlural} visíveis
                      </span>
                    </div>
                  </Label>
                </div>
                {onFetchAllItems && (
                  <div className="flex items-start space-x-2 py-2">
                    <RadioGroupItem value="all" id="all" className="mt-1" />
                    <Label htmlFor="all" className="cursor-pointer">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">Todos os dados</span>
                        <span className="text-xs text-muted-foreground">
                          Exportar {totalRecords || "todos os"} {totalRecords === 1 ? entityName : entityNamePlural} com filtros atuais
                        </span>
                      </div>
                    </Label>
                  </div>
                )}
              </RadioGroup>
            )}
          </div>

          <Separator />

          <Button onClick={handleExport} disabled={isExporting || (currentItems.length === 0 && (!selectedItems || selectedItems.size === 0))} className="w-full gap-2">
            <FormatIcon className="h-4 w-4" />
            Exportar como {exportFormat.toUpperCase()}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
