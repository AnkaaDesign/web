import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  exportToCSV,
  exportToExcel,
  exportToPDFHTML,
  exportToJSON,
  type ExportConfig,
  type ChartExportData,
  type ExportFormat,
} from "./statistics/export-formatters";

// Utility function to trigger download
export const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  downloadFileFromBlob(blob, filename);
};

// Utility function to download from blob
export const downloadFileFromBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

// Bulk export with streaming for large datasets
export const exportLargeDatasetAsCSV = async (
  dataProvider: () => Promise<any[]>,
  config: ExportConfig & { batchSize?: number } = {}
): Promise<void> => {
  const { batchSize = 1000, ...baseConfig } = config;
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const filename = baseConfig.filename || `estatisticas_estoque_${timestamp}.csv`;

  try {
    const data = await dataProvider();

    if (data.length <= batchSize) {
      // Small dataset, export normally
      const csv = exportToCSV(data, baseConfig);
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      return;
    }

    // Large dataset, use streaming approach - delegate to exportToCSV
    const csv = exportToCSV(data, baseConfig);
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  } catch (error) {
    console.error('Error exporting large dataset:', error);
    throw new Error('Falha ao exportar dados. Tente novamente ou use um filtro para reduzir o volume de dados.');
  }
};

// Pre-configured export functions
export const exportChartsAsCSV = (chartData: ChartExportData[], config: ExportConfig = {}): void => {
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const filename = config.filename || `estatisticas_estoque_${timestamp}.csv`;

  // Combine all chart data into a single CSV
  let combinedData: any[] = [];
  chartData.forEach(chart => {
    if (chart.data && chart.data.length > 0) {
      const sectionData = chart.data.map(row => ({
        ...row,
        _secao: chart.chartTitle, // Add section identifier
      }));
      combinedData = combinedData.concat(sectionData);
    }
  });

  const csv = exportToCSV(combinedData, config);
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
};

export const exportChartsAsExcel = (chartData: ChartExportData[], config: ExportConfig = {}): void => {
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const filename = config.filename || `estatisticas_estoque_${timestamp}.xlsx`;

  const excelBuffer = exportToExcel(chartData, config);
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  downloadFileFromBlob(blob, filename);
};

export const exportChartsAsPDF = async (chartData: ChartExportData[], config: ExportConfig = {}): Promise<void> => {
  const html = exportToPDFHTML(chartData, config);
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const filename = config.filename || `estatisticas_estoque_${timestamp}.pdf`;

  // For modern browsers, try to use the print-to-PDF API if available
  if ('showSaveFilePicker' in window) {
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();

        // Wait for content to load
        await new Promise<void>(resolve => {
          printWindow.onload = () => resolve();
        });

        // Trigger print dialog
        printWindow.print();
      }
    } catch (error) {
      console.warn('Print-to-PDF failed, falling back to HTML download:', error);
      downloadFile(html, filename.replace('.pdf', '.html'), 'text/html;charset=utf-8;');
    }
  } else {
    // Fallback: open in new window for manual print-to-PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      // Ultimate fallback: download as HTML
      downloadFile(html, filename.replace('.pdf', '.html'), 'text/html;charset=utf-8;');
    }
  }
};

export const exportChartsAsJSON = (chartData: ChartExportData[], config: ExportConfig = {}): void => {
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const filename = config.filename || `estatisticas_estoque_${timestamp}.json`;

  const json = exportToJSON(chartData, config);
  downloadFile(json, filename, 'application/json;charset=utf-8;');
};

// Main export function that delegates to specific formatters
export const exportStatistics = async (
  chartData: ChartExportData[],
  format: ExportFormat,
  config: ExportConfig = {}
): Promise<void> => {
  try {
    switch (format) {
      case 'csv':
        exportChartsAsCSV(chartData, config);
        break;
      case 'excel':
        exportChartsAsExcel(chartData, config);
        break;
      case 'pdf':
        await exportChartsAsPDF(chartData, config);
        break;
      case 'json':
        exportChartsAsJSON(chartData, config);
        break;
      default:
        throw new Error(`Formato de exportação não suportado: ${format}`);
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};
