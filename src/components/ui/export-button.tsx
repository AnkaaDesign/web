import { useState } from "react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Badge } from "./badge";
import { Separator } from "./separator";
import {
  IconDownload,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconFileTypePdf,
  IconJson,
  IconChevronDown,
  IconLoader2
} from "@tabler/icons-react";
import type {
  ExportFormat,
  ChartExportData,
  ExportConfig
} from "../../utils";
import { exportStatistics } from "@/utils/statistics-export";
import { toast } from "sonner";

interface ExportButtonProps {
  /**
   * Data to be exported
   */
  data: ChartExportData[];

  /**
   * Configuration for the export
   */
  config?: ExportConfig;

  /**
   * Button variant
   */
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";

  /**
   * Button size
   */
  size?: "default" | "sm" | "lg" | "icon";

  /**
   * Show data count badge
   */
  showDataCount?: boolean;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Available export formats
   */
  availableFormats?: ExportFormat[];

  /**
   * Callback when export starts
   */
  onExportStart?: (format: ExportFormat) => void;

  /**
   * Callback when export completes
   */
  onExportComplete?: (format: ExportFormat) => void;

  /**
   * Callback when export fails
   */
  onExportError?: (format: ExportFormat, error: Error) => void;
}

const formatOptions: Record<ExportFormat, {
  label: string;
  description: string;
  icon: React.ElementType;
  mimeType: string;
}> = {
  csv: {
    label: "CSV",
    description: "Planilha simples (valores separados por vírgula)",
    icon: IconFileTypeCsv,
    mimeType: "text/csv",
  },
  excel: {
    label: "Excel",
    description: "Planilha completa com formatação",
    icon: IconFileTypeXls,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  pdf: {
    label: "PDF",
    description: "Documento formatado para impressão",
    icon: IconFileTypePdf,
    mimeType: "application/pdf",
  },
  json: {
    label: "JSON",
    description: "Dados estruturados para desenvolvedores",
    icon: IconJson,
    mimeType: "application/json",
  },
};

export const ExportButton = ({
  data,
  config = {},
  variant = "default",
  size = "default",
  showDataCount = true,
  disabled = false,
  className,
  availableFormats = ["csv", "excel", "pdf", "json"],
  onExportStart,
  onExportComplete,
  onExportError,
}: ExportButtonProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  const totalRecords = data.reduce((sum, chart) => sum + (chart.data?.length || 0), 0);
  const hasData = totalRecords > 0;

  const handleExport = async (format: ExportFormat) => {
    if (!hasData) {
      toast.error("Não há dados para exportar");
      return;
    }

    setIsExporting(true);
    setExportingFormat(format);

    try {
      onExportStart?.(format);

      await exportStatistics(data, format, {
        includeTimestamp: true,
        includeFilters: true,
        ...config,
      });

      toast.success(`Dados exportados em formato ${formatOptions[format].label} com sucesso!`);
      onExportComplete?.(format);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Falha ao exportar: ${errorMessage}`);
      onExportError?.(format, error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  // Quick export to CSV for single button mode
  const handleQuickExport = () => {
    if (availableFormats.length === 1) {
      handleExport(availableFormats[0]);
    } else {
      handleExport("csv"); // Default to CSV for quick export
    }
  };

  // Single format button
  if (availableFormats.length === 1) {
    const format = availableFormats[0];
    const formatConfig = formatOptions[format];
    const Icon = formatConfig.icon;

    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || !hasData || isExporting}
        onClick={handleQuickExport}
      >
        {isExporting ? (
          <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Icon className="h-4 w-4 mr-2" />
        )}
        Exportar {formatConfig.label}
        {showDataCount && hasData && (
          <Badge variant="secondary" className="ml-2">
            {totalRecords.toLocaleString('pt-BR')}
          </Badge>
        )}
      </Button>
    );
  }

  // Multiple formats dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={disabled || !hasData || isExporting}
        >
          {isExporting ? (
            <>
              <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
              Exportando {exportingFormat && formatOptions[exportingFormat].label}...
            </>
          ) : (
            <>
              <IconDownload className="h-4 w-4 mr-2" />
              Exportar
              <IconChevronDown className="h-4 w-4 ml-1" />
            </>
          )}
          {showDataCount && hasData && !isExporting && (
            <Badge variant="secondary" className="ml-2">
              {totalRecords.toLocaleString('pt-BR')}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          Escolha o formato
          {showDataCount && hasData && (
            <Badge variant="outline" className="text-xs">
              {totalRecords.toLocaleString('pt-BR')} registros
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {!hasData ? (
          <DropdownMenuItem disabled>
            <div className="flex flex-col items-start">
              <span className="text-sm text-muted-foreground">Nenhum dado disponível</span>
              <span className="text-xs text-muted-foreground">
                Ajuste os filtros para visualizar dados
              </span>
            </div>
          </DropdownMenuItem>
        ) : (
          availableFormats.map((format) => {
            const formatConfig = formatOptions[format];
            const Icon = formatConfig.icon;

            return (
              <DropdownMenuItem
                key={format}
                onClick={() => handleExport(format)}
                disabled={isExporting}
                className="flex flex-col items-start space-y-1 p-3"
              >
                <div className="flex items-center w-full">
                  <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium">{formatConfig.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatConfig.description}
                    </div>
                  </div>
                  {isExporting && exportingFormat === format && (
                    <IconLoader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  )}
                </div>
              </DropdownMenuItem>
            );
          })
        )}

        {hasData && totalRecords > 5000 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border">
                ⚠️ Volume alto de dados ({totalRecords.toLocaleString('pt-BR')} registros).
                A exportação pode demorar alguns segundos.
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportButton;