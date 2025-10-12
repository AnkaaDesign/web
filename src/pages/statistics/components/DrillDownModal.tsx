/**
 * Drill-Down Modal Component
 *
 * Modal for detailed data exploration with:
 * - Detailed charts
 * - Raw data tables
 * - Additional context
 * - Export functionality
 */

import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconDownload, IconX } from "@tabler/icons-react";

export interface DrillDownModalProps {
  /**
   * Is modal open?
   */
  open: boolean;

  /**
   * Callback when modal should close
   */
  onClose: () => void;

  /**
   * Modal title
   */
  title: string;

  /**
   * Modal description
   */
  description?: string;

  /**
   * Chart/visualization content
   */
  chartContent?: ReactNode;

  /**
   * Table/data content
   */
  tableContent?: ReactNode;

  /**
   * Additional details content
   */
  detailsContent?: ReactNode;

  /**
   * Export handler
   */
  onExport?: () => void;

  /**
   * Show export button
   */
  exportable?: boolean;

  /**
   * Loading state
   */
  loading?: boolean;
}

/**
 * Drill-Down Modal
 *
 * Provides detailed view of statistics data with tabs for different
 * perspectives (charts, tables, details).
 */
export function DrillDownModal({
  open,
  onClose,
  title,
  description,
  chartContent,
  tableContent,
  detailsContent,
  onExport,
  exportable = true,
  loading = false,
}: DrillDownModalProps) {
  // Determine which tabs to show
  const showChartTab = !!chartContent;
  const showTableTab = !!tableContent;
  const showDetailsTab = !!detailsContent;

  // Default to first available tab
  const defaultTab = showChartTab
    ? "chart"
    : showTableTab
    ? "table"
    : "details";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-1">
                  {description}
                </DialogDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              {exportable && onExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExport}
                  disabled={loading}
                >
                  <IconDownload className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">
              Carregando dados...
            </div>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-3">
              {showChartTab && <TabsTrigger value="chart">Gráfico</TabsTrigger>}
              {showTableTab && <TabsTrigger value="table">Tabela</TabsTrigger>}
              {showDetailsTab && <TabsTrigger value="details">Detalhes</TabsTrigger>}
            </TabsList>

            <ScrollArea className="h-[60vh] mt-4">
              {showChartTab && (
                <TabsContent value="chart" className="space-y-4">
                  {chartContent}
                </TabsContent>
              )}

              {showTableTab && (
                <TabsContent value="table" className="space-y-4">
                  {tableContent}
                </TabsContent>
              )}

              {showDetailsTab && (
                <TabsContent value="details" className="space-y-4">
                  {detailsContent}
                </TabsContent>
              )}
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
