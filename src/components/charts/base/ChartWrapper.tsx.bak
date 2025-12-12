/**
 * ChartWrapper Component
 * Universal wrapper for all chart components with built-in features:
 * - Loading states
 * - Error states
 * - Empty states
 * - Responsive container
 * - Export buttons (PNG, SVG, CSV, Excel)
 * - Refresh button
 * - Full-screen mode
 * - Settings menu
 */

import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Download,
  RefreshCw,
  Maximize2,
  Minimize2,
  Settings,
  FileDown,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { ChartHeader } from './ChartHeader';

export interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  filename?: string;
}

export interface ChartWrapperProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;

  // Header props
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;

  // State props
  isLoading?: boolean;
  error?: Error | string | null;
  isEmpty?: boolean;
  emptyMessage?: string;

  // Feature toggles
  showExport?: boolean;
  showRefresh?: boolean;
  showFullscreen?: boolean;
  showSettings?: boolean;

  // Dimensions
  height?: number | string;
  minHeight?: number;
  responsive?: boolean;

  // Callbacks
  onRefresh?: () => void;
  onExport?: (format: 'png' | 'pdf' | 'csv' | 'excel') => void;
  onSettingsChange?: (settings: Record<string, any>) => void;

  // Export data
  exportData?: ExportData;
  exportFilename?: string;

  // Settings
  settings?: {
    showGrid?: boolean;
    showLegend?: boolean;
    showTooltip?: boolean;
    showAnimation?: boolean;
    [key: string]: any;
  };

  // Container ID for export
  containerId?: string;
}

export const ChartWrapper = React.memo<ChartWrapperProps>(({
  children,
  className,
  contentClassName,
  title,
  description,
  icon,
  badge,
  actions,
  isLoading = false,
  error = null,
  isEmpty = false,
  emptyMessage = 'Nenhum dado disponível',
  showExport = true,
  showRefresh = false,
  showFullscreen = true,
  showSettings = false,
  height = 400,
  minHeight = 300,
  responsive = true,
  onRefresh,
  onExport,
  onSettingsChange,
  exportData,
  exportFilename = 'chart',
  settings = {},
  containerId,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const chartRef = useRef<HTMLDivElement>(null);

  // Generate container ID
  const elementId = containerId || `chart-${React.useId()}`;

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
      toast.success('Gráfico atualizado com sucesso');
    } catch (err) {
      toast.error('Erro ao atualizar gráfico');
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  // Export as PNG
  const exportAsPNG = useCallback(async () => {
    const element = document.getElementById(elementId);
    if (!element) {
      toast.error('Elemento não encontrado');
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${exportFilename}-${Date.now()}.png`;
          link.click();
          URL.revokeObjectURL(url);
          toast.success('Imagem exportada com sucesso');
        }
      }, 'image/png');
    } catch (err) {
      toast.error('Erro ao exportar imagem');
      console.error(err);
    }
  }, [elementId, exportFilename]);

  // Export as PDF
  const exportAsPDF = useCallback(async () => {
    const element = document.getElementById(elementId);
    if (!element) {
      toast.error('Elemento não encontrado');
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${exportFilename}-${Date.now()}.pdf`);
      toast.success('PDF exportado com sucesso');
    } catch (err) {
      toast.error('Erro ao exportar PDF');
      console.error(err);
    }
  }, [elementId, exportFilename]);

  // Export as CSV
  const exportAsCSV = useCallback(() => {
    if (!exportData) {
      toast.error('Dados de exportação não disponíveis');
      return;
    }

    try {
      const { headers, rows } = exportData;
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${exportFilename}-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exportado com sucesso');
    } catch (err) {
      toast.error('Erro ao exportar CSV');
      console.error(err);
    }
  }, [exportData, exportFilename]);

  // Export as Excel
  const exportAsExcel = useCallback(() => {
    if (!exportData) {
      toast.error('Dados de exportação não disponíveis');
      return;
    }

    try {
      const { headers, rows } = exportData;
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
      XLSX.writeFile(workbook, `${exportFilename}-${Date.now()}.xlsx`);
      toast.success('Excel exportado com sucesso');
    } catch (err) {
      toast.error('Erro ao exportar Excel');
      console.error(err);
    }
  }, [exportData, exportFilename]);

  // Handle export
  const handleExport = useCallback(async (format: 'png' | 'pdf' | 'csv' | 'excel') => {
    if (onExport) {
      onExport(format);
      return;
    }

    setIsExporting(true);

    try {
      switch (format) {
        case 'png':
          await exportAsPNG();
          break;
        case 'pdf':
          await exportAsPDF();
          break;
        case 'csv':
          exportAsCSV();
          break;
        case 'excel':
          exportAsExcel();
          break;
      }
    } finally {
      setIsExporting(false);
    }
  }, [onExport, exportAsPNG, exportAsPDF, exportAsCSV, exportAsExcel]);

  // Handle settings change
  const handleSettingChange = useCallback((key: string, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange?.(newSettings);
  }, [localSettings, onSettingsChange]);

  // Render loading state
  if (isLoading) {
    return (
      <Card className={cn('w-full', className)}>
        {title && (
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                {description && <Skeleton className="h-4 w-64" />}
              </div>
            </div>
          </CardHeader>
        )}
        <CardContent className={cn('pt-6', contentClassName)}>
          <div
            className="flex items-center justify-center bg-muted/30 rounded-lg"
            style={{ height: typeof height === 'number' ? `${height}px` : height, minHeight }}
          >
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    const errorMessage = typeof error === 'string' ? error : error.message;

    return (
      <Card className={cn('w-full', className)}>
        {title && (
          <CardHeader>
            <ChartHeader
              title={title}
              description={description}
              icon={icon}
              badge={badge}
              actions={actions}
            />
          </CardHeader>
        )}
        <CardContent className={cn('pt-6', contentClassName)}>
          <div
            className="flex items-center justify-center bg-destructive/10 rounded-lg border border-destructive/20"
            style={{ height: typeof height === 'number' ? `${height}px` : height, minHeight }}
          >
            <div className="flex flex-col items-center gap-4 max-w-md text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Erro ao carregar gráfico</p>
                <p className="text-xs text-muted-foreground">{errorMessage}</p>
              </div>
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render empty state
  if (isEmpty) {
    return (
      <Card className={cn('w-full', className)}>
        {title && (
          <CardHeader>
            <ChartHeader
              title={title}
              description={description}
              icon={icon}
              badge={badge}
              actions={actions}
            />
          </CardHeader>
        )}
        <CardContent className={cn('pt-6', contentClassName)}>
          <div
            className="flex items-center justify-center bg-muted/20 rounded-lg border border-dashed border-muted-foreground/30"
            style={{ height: typeof height === 'number' ? `${height}px` : height, minHeight }}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render chart
  const chartContent = (
    <Card className={cn('w-full', className)} ref={chartRef}>
      {title && (
        <CardHeader>
          <ChartHeader
            title={title}
            description={description}
            icon={icon}
            badge={badge}
          >
            <div className="flex items-center gap-2">
              {actions}

              {showRefresh && onRefresh && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-8 w-8"
                >
                  <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                </Button>
              )}

              {showExport && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isExporting}
                      className="h-8 w-8"
                    >
                      {isExporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Exportar como</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExport('png')}>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('pdf')}>
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </DropdownMenuItem>
                    {exportData && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleExport('csv')}>
                          <FileDown className="h-4 w-4 mr-2" />
                          CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('excel')}>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Excel
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {showFullscreen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="h-8 w-8"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              )}

              {showSettings && onSettingsChange && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Configurações</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={localSettings.showGrid ?? true}
                      onCheckedChange={(checked) => handleSettingChange('showGrid', checked)}
                    >
                      Mostrar grade
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={localSettings.showLegend ?? true}
                      onCheckedChange={(checked) => handleSettingChange('showLegend', checked)}
                    >
                      Mostrar legenda
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={localSettings.showTooltip ?? true}
                      onCheckedChange={(checked) => handleSettingChange('showTooltip', checked)}
                    >
                      Mostrar tooltip
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={localSettings.showAnimation ?? true}
                      onCheckedChange={(checked) => handleSettingChange('showAnimation', checked)}
                    >
                      Animações
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </ChartHeader>
        </CardHeader>
      )}

      <CardContent className={cn('pt-6', contentClassName)} id={elementId}>
        <div
          className={cn('w-full', responsive && 'min-w-0')}
          style={{
            height: typeof height === 'number' ? `${height}px` : height,
            minHeight,
          }}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );

  // Render with fullscreen dialog if needed
  if (isFullscreen) {
    return (
      <>
        {chartContent}
        <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-6">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="w-full h-[80vh] overflow-auto">
              {children}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return chartContent;
});

ChartWrapper.displayName = 'ChartWrapper';
