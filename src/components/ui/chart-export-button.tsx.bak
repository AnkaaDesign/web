import { useState, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "./dropdown-menu";
import { Button } from "./button";
import { toast } from "sonner";
import { Download, Image, FileText, Loader2, FileCode } from "lucide-react";

export type ChartExportFormat = "png" | "jpeg" | "pdf" | "pdf-multi" | "html";

interface ChartExportButtonProps {
  chartElementId?: string;
  infoElementId?: string;
  filename?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  availableChartTypes?: string[];
  currentChartType?: string;
  onChartTypeChange?: (type: string) => void;
}

export const ChartExportButton = ({
  chartElementId = "chart-container",
  infoElementId = "info-cards",
  filename = "grafico-consumo",
  variant = "outline",
  size = "sm",
  className,
  availableChartTypes = ["bar", "line", "pie", "donut", "area", "radar", "treemap", "horizontal-bar"],
  currentChartType = "bar",
  onChartTypeChange,
}: ChartExportButtonProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [includeInfo, setIncludeInfo] = useState(false);
  const [exportFormat, setExportFormat] = useState<"single" | "multi" | "interactive">("single");

  // Helper function to hide chart icons during export
  const hideChartIcons = () => {
    const header = document.querySelector("#consumption-chart .p-3") as HTMLElement;
    if (header) {
      header.style.display = "none";
    }
  };

  // Helper function to show chart icons after export
  const showChartIcons = () => {
    const header = document.querySelector("#consumption-chart .p-3") as HTMLElement;
    if (header) {
      header.style.display = "";
    }
  };

  // Export multi-page PDF with all chart types
  const exportMultiPagePDF = async () => {
    if (!onChartTypeChange) {
      toast.error("Função de mudança de gráfico não disponível");
      return;
    }

    toast.info("Gerando PDF com todos os tipos de gráfico...");

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const originalChartType = currentChartType;

    // Hide chart icons
    hideChartIcons();

    for (let i = 0; i < availableChartTypes.length; i++) {
      const chartType = availableChartTypes[i];

      // Change chart type
      onChartTypeChange(chartType);

      // Wait for chart to re-render
      await new Promise(resolve => setTimeout(resolve, 800));

      // Get the chart element
      const chartElement = document.getElementById(chartElementId);
      if (!chartElement) continue;

      // Generate canvas with high quality
      const canvas = await html2canvas(chartElement, {
        backgroundColor: "#ffffff",
        scale: 3, // Increased for better quality
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      if (i > 0) {
        pdf.addPage();
      }

      // Add chart image without title, using full page
      const imgData = canvas.toDataURL("image/png", 1.0);
      const pageWidth = 297; // A4 width in mm
      const pageHeight = 210; // A4 height in mm
      const margin = 10;
      const imgWidth = pageWidth - (2 * margin);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Center vertically if image is smaller than page
      const yPosition = imgHeight < (pageHeight - 2 * margin)
        ? (pageHeight - imgHeight) / 2
        : margin;

      pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, Math.min(imgHeight, pageHeight - 2 * margin));

      // Add small page number at bottom
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`${i + 1}/${availableChartTypes.length}`, pageWidth - margin, pageHeight - 5, { align: "right" });
    }

    // Restore original chart type
    onChartTypeChange(originalChartType);

    // Show chart icons again
    showChartIcons();

    pdf.save(`${filename}-todos-graficos-${new Date().getTime()}.pdf`);
    toast.success("PDF com todos os gráficos exportado!");
  };

  // Export as interactive HTML
  const exportInteractiveHTML = async () => {
    if (!onChartTypeChange) {
      toast.error("Função de mudança de gráfico não disponível");
      return;
    }

    toast.info("Gerando HTML com todos os gráficos...");

    const originalChartType = currentChartType;
    const chartImages: Record<string, string> = {};

    // Hide chart icons
    hideChartIcons();

    // Capture all chart types as images
    for (const chartType of availableChartTypes) {
      onChartTypeChange(chartType);
      await new Promise(resolve => setTimeout(resolve, 800));

      const chartElement = document.getElementById(chartElementId);
      if (chartElement) {
        const canvas = await html2canvas(chartElement, {
          backgroundColor: "#ffffff",
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
        });
        chartImages[chartType] = canvas.toDataURL("image/png");
      }
    }

    // Restore original chart type
    onChartTypeChange(originalChartType);
    showChartIcons();

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gráficos - ${filename}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .chart-selector { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
        .chart-btn {
            padding: 10px 20px;
            background: white;
            border: 2px solid #ddd;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 14px;
        }
        .chart-btn:hover { background: #f0f0f0; }
        .chart-btn.active { background: #4CAF50; color: white; border-color: #4CAF50; }
        .chart-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .chart-image { width: 100%; height: auto; display: none; }
        .chart-image.active { display: block; }
        .info { margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Visualização de Gráficos</h1>
            <p style="margin-top: 10px; color: #666;">Clique nos botões abaixo para alternar entre diferentes tipos de visualização</p>
        </div>

        <div class="chart-selector" id="chartButtons"></div>

        <div class="chart-container" id="chartContainer">
            ${availableChartTypes.map(type =>
              `<img class="chart-image${type === currentChartType ? ' active' : ''}"
                    id="chart-${type}"
                    src="${chartImages[type]}"
                    alt="${getChartTypeName(type)}">`
            ).join('\n            ')}
        </div>

        <div class="info">
            <strong>Instruções:</strong>
            <ul style="margin-top: 10px; margin-left: 20px;">
                <li>Clique em qualquer botão acima para mudar o tipo de gráfico</li>
                <li>Use Ctrl+P para imprimir ou salvar como PDF</li>
                <li>Este arquivo pode ser compartilhado e aberto em qualquer navegador</li>
            </ul>
        </div>
    </div>

    <script>
        const chartTypes = ${JSON.stringify(availableChartTypes.map(type => ({
          id: type,
          name: getChartTypeName(type)
        })))};

        let currentChart = '${currentChartType}';

        // Create buttons
        const buttonsContainer = document.getElementById('chartButtons');
        chartTypes.forEach(type => {
            const button = document.createElement('button');
            button.className = 'chart-btn' + (type.id === currentChart ? ' active' : '');
            button.textContent = type.name;
            button.onclick = () => selectChart(type.id);
            buttonsContainer.appendChild(button);
        });

        function selectChart(chartId) {
            // Update active button
            document.querySelectorAll('.chart-btn').forEach((btn, index) => {
                btn.classList.toggle('active', chartTypes[index].id === chartId);
            });

            // Update active chart image
            document.querySelectorAll('.chart-image').forEach(img => {
                img.classList.toggle('active', img.id === 'chart-' + chartId);
            });

            currentChart = chartId;
        }
    </script>
</body>
</html>`;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-interativo-${new Date().getTime()}.html`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("HTML exportado! Abra o arquivo em qualquer navegador.");
  };

  // Helper function to get chart type names in Portuguese
  const getChartTypeName = (type: string): string => {
    const names: Record<string, string> = {
      "bar": "Gráfico de Barras",
      "line": "Gráfico de Linha",
      "pie": "Gráfico de Pizza",
      "donut": "Gráfico de Rosquinha",
      "area": "Gráfico de Área",
      "radar": "Gráfico de Radar",
      "treemap": "Mapa de Árvore",
      "horizontal-bar": "Barras Horizontais",
    };
    return names[type] || type;
  };

  const exportChart = async (format: ChartExportFormat) => {
    setIsExporting(true);

    try {
      // Hide chart icons for clean export
      hideChartIcons();

      // Get the chart element
      const chartElement = document.getElementById(chartElementId);
      if (!chartElement) {
        toast.error("Elemento do gráfico não encontrado");
        showChartIcons();
        return;
      }

      let elementToExport = chartElement;

      // If includeInfo is true, create a temporary container with both elements
      if (includeInfo) {
        const infoElement = document.getElementById(infoElementId);
        if (infoElement) {
          // Create temporary container
          const tempContainer = document.createElement("div");
          tempContainer.style.backgroundColor = "white";
          tempContainer.style.padding = "20px";
          tempContainer.style.display = "flex";
          tempContainer.style.flexDirection = "column";
          tempContainer.style.gap = "20px";

          // Clone elements to avoid affecting the original
          const infoClone = infoElement.cloneNode(true) as HTMLElement;
          const chartClone = chartElement.cloneNode(true) as HTMLElement;

          // Append to temporary container
          tempContainer.appendChild(infoClone);
          tempContainer.appendChild(chartClone);

          // Append to body temporarily
          document.body.appendChild(tempContainer);
          elementToExport = tempContainer;
        }
      }

      // Generate canvas from the element
      const canvas = await html2canvas(elementToExport, {
        backgroundColor: "#ffffff",
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      // Clean up temporary container if it was created
      if (includeInfo && elementToExport !== chartElement) {
        document.body.removeChild(elementToExport);
      }

      // Export based on format
      switch (format) {
        case "png":
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `${filename}-${new Date().getTime()}.png`;
              link.click();
              URL.revokeObjectURL(url);
              toast.success("Gráfico exportado como PNG");
            }
          }, "image/png");
          break;

        case "jpeg":
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `${filename}-${new Date().getTime()}.jpeg`;
              link.click();
              URL.revokeObjectURL(url);
              toast.success("Gráfico exportado como JPEG");
            }
          }, "image/jpeg", 0.95);
          break;

        case "pdf":
          const imgData = canvas.toDataURL("image/png");
          const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? "landscape" : "portrait",
            unit: "px",
            format: [canvas.width, canvas.height],
          });

          pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
          pdf.save(`${filename}-${new Date().getTime()}.pdf`);
          toast.success("Gráfico exportado como PDF");
          break;

        case "pdf-multi":
          await exportMultiPagePDF();
          break;

        case "html":
          await exportInteractiveHTML();
          break;
      }
    } catch (error) {
      console.error("Error exporting chart:", error);
      toast.error("Erro ao exportar o gráfico");
    } finally {
      showChartIcons();
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isExporting}
          className={className}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Opções de Exportação</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={includeInfo}
          onCheckedChange={setIncludeInfo}
        >
          Incluir cards de informações
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => exportChart("png")}
          disabled={isExporting}
          className="flex items-center"
        >
          <Image className="h-4 w-4 mr-2" />
          <span>Exportar como PNG</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => exportChart("jpeg")}
          disabled={isExporting}
          className="flex items-center"
        >
          <Image className="h-4 w-4 mr-2" />
          <span>Exportar como JPEG</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => exportChart("pdf")}
          disabled={isExporting}
          className="flex items-center"
        >
          <FileText className="h-4 w-4 mr-2" />
          <span>Exportar como PDF</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">Exportação Avançada</DropdownMenuLabel>

        <DropdownMenuItem
          onClick={() => exportChart("pdf-multi")}
          disabled={isExporting || !onChartTypeChange}
          className="flex items-center"
        >
          <FileText className="h-4 w-4 mr-2" />
          <div>
            <div>PDF Multi-página</div>
            <div className="text-xs text-muted-foreground">Todos os tipos de gráfico</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => exportChart("html")}
          disabled={isExporting || !onChartTypeChange}
          className="flex items-center"
        >
          <FileCode className="h-4 w-4 mr-2" />
          <div>
            <div>HTML</div>
            <div className="text-xs text-muted-foreground">Interativo no navegador</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};