import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { userService } from "../../../../api-client";
import { formatCPF, formatBrazilianPhone, formatDate, formatDateTime } from "../../../../utils";
import { getUserStatusBadgeText } from "../../../../utils/user";
import type { User } from "../../../../types";
import type { UserGetManyFormData } from "../../../../schemas";

interface UserExportProps {
  className?: string;
  filters?: Partial<UserGetManyFormData>;
  currentUsers?: User[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedUsers?: Set<string>;
}

// Column configuration for export - matches table columns exactly
const EXPORT_COLUMNS: ExportColumn<User>[] = [
  { id: "payrollNumber", label: "Nº Folha", getValue: (user: User) => user.payrollNumber?.toString() || "" },
  { id: "name", label: "Nome", getValue: (user: User) => user.name },
  { id: "email", label: "Email", getValue: (user: User) => user.email || "" },
  { id: "phone", label: "Telefone", getValue: (user: User) => (user.phone ? formatBrazilianPhone(user.phone) : "") },
  { id: "cpf", label: "CPF", getValue: (user: User) => (user.cpf ? formatCPF(user.cpf) : "") },
  { id: "pis", label: "PIS", getValue: (user: User) => user.pis || "" },
  { id: "position.hierarchy", label: "Cargo", getValue: (user: User) => user.position?.name || "" },
  { id: "sector.name", label: "Setor", getValue: (user: User) => user.sector?.name || "" },
  { id: "tasksCount", label: "Tarefas", getValue: (user: User) => user._count?.createdTasks?.toString() || "0" },
  { id: "vacationsCount", label: "Férias", getValue: (user: User) => user._count?.vacations?.toString() || "0" },
  { id: "birth", label: "Data de Nascimento", getValue: (user: User) => (user.birth ? formatDate(new Date(user.birth)) : "") },
  { id: "dismissal", label: "Data de Demissão", getValue: (user: User) => (user.dismissal ? formatDate(new Date(user.dismissal)) : "") },
  { id: "status", label: "Status", getValue: (user: User) => getUserStatusBadgeText(user) },
  { id: "performanceLevel", label: "Nível de Performance", getValue: (user: User) => user.performanceLevel?.toString() || "0" },
  { id: "verified", label: "Verificado", getValue: (user: User) => (user.verified ? "Sim" : "Não") },
  { id: "lastLoginAt", label: "Último Login", getValue: (user: User) => (user.lastLoginAt ? formatDateTime(new Date(user.lastLoginAt)) : "") },
  { id: "managedSector.name", label: "Setor Gerenciado", getValue: (user: User) => user.managedSector?.name || "" },
  { id: "city", label: "Cidade", getValue: (user: User) => user.city || "" },
  { id: "state", label: "Estado", getValue: (user: User) => user.state || "" },
  { id: "zipCode", label: "CEP", getValue: (user: User) => user.zipCode || "" },
  {
    id: "address",
    label: "Endereço",
    getValue: (user: User) => {
      if (!user.address) return "";
      let fullAddress = user.address;
      if (user.addressNumber) fullAddress += `, ${user.addressNumber}`;
      if (user.addressComplement) fullAddress += ` - ${user.addressComplement}`;
      return fullAddress;
    }
  },
  { id: "neighborhood", label: "Bairro", getValue: (user: User) => user.neighborhood || "" },
  { id: "requirePasswordChange", label: "Requer Alteração de Senha", getValue: (user: User) => (user.requirePasswordChange ? "Sim" : "Não") },
  { id: "createdAt", label: "Data de Criação", getValue: (user: User) => (user.createdAt ? formatDateTime(new Date(user.createdAt)) : "") },
  { id: "updatedAt", label: "Última Atualização", getValue: (user: User) => (user.updatedAt ? formatDateTime(new Date(user.updatedAt)) : "") },
];

// Default visible columns if none specified - matches table default
const DEFAULT_VISIBLE_COLUMNS = new Set(["payrollNumber", "name", "position.hierarchy", "sector.name", "status"]);

export function UserExport({ className, filters, currentUsers = [], totalRecords = 0, visibleColumns, selectedUsers }: UserExportProps) {
  const fetchAllUsers = async (): Promise<User[]> => {
    try {
      const allUsers: User[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await userService.getUsers({
          ...filters,
          page,
          limit: 100,
          include: {
            position: true,
            sector: true,
            managedSector: true,
            _count: {
              select: {
                createdTasks: true,
                vacations: true,
              },
            },
          },
        });

        if (response.data) {
          allUsers.push(...response.data);
        }

        hasMore = response.meta?.hasNextPage || false;
        page++;
      }

      return allUsers;
    } catch (error) {
      console.error("Error fetching all users:", error);
      toast.error("Erro ao buscar colaboradores para exportação");
      throw error;
    }
  };

  const handleExport = async (format: ExportFormat, items: User[], columns: ExportColumn<User>[]) => {
    try {
      // Generate export based on format
      switch (format) {
        case "csv":
          await exportToCSV(items, columns);
          break;
        case "excel":
          await exportToExcel(items, columns);
          break;
        case "pdf":
          await exportToPDF(items, columns);
          break;
      }

      toast.success(`Exportação ${format.toUpperCase()} concluída com sucesso!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar dados");
      throw error;
    }
  };

  const exportToCSV = async (items: User[], columns: ExportColumn<User>[]) => {
    // CSV headers from visible columns
    const headers = columns.map((col) => col.label);

    // Convert items to CSV rows with only visible columns
    const rows = items.map((item) => columns.map((col) => col.getValue(item)));

    // Create CSV content
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    // Download CSV
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `colaboradores_${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (items: User[], columns: ExportColumn<User>[]) => {
    // Headers from visible columns
    const headers = columns.map((col) => col.label);

    // Convert items to rows with only visible columns
    const rows = items.map((item) => columns.map((col) => col.getValue(item)));

    // Create tab-separated values for Excel
    const excelContent = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");

    // Download as .xls file
    const blob = new Blob(["\ufeff" + excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `colaboradores_${formatDate(new Date()).replace(/\//g, "-")}.xls`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async (items: User[], columns: ExportColumn<User>[]) => {
    // Calculate responsive font sizes based on column count
    const columnCount = columns.length;
    const fontSize = columnCount <= 6 ? "12px" : columnCount <= 10 ? "10px" : "8px";
    const headerFontSize = columnCount <= 6 ? "11px" : columnCount <= 10 ? "9px" : "7px";
    const cellPadding = columnCount <= 6 ? "8px 6px" : columnCount <= 10 ? "6px 4px" : "4px 3px";
    const headerPadding = columnCount <= 6 ? "10px 6px" : columnCount <= 10 ? "8px 4px" : "6px 3px";

    // A4 optimized PDF with proper formatting
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Colaboradores - ${formatDate(new Date())}</title>
        <style>
          @page {
            size: A4;
            margin: 12mm;
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          html, body {
            height: 100vh;
            width: 100vw;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: white;
            font-size: ${fontSize};
            line-height: 1.3;
            overflow-x: auto;
          }

          body {
            display: grid;
            grid-template-rows: auto 1fr auto;
            min-height: 100vh;
            padding: 0;
          }

          .header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
            flex-shrink: 0;
          }

          .logo {
            width: ${columnCount <= 6 ? "100px" : "80px"};
            height: auto;
            margin-right: 15px;
          }

          .header-info {
            flex: 1;
          }

          .info {
            color: #6b7280;
            font-size: ${columnCount <= 6 ? "12px" : "10px"};
          }

          .info p {
            margin: 2px 0;
          }

          .content-wrapper {
            flex: 1;
            overflow: auto;
            min-height: 0;
            padding-bottom: 40px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e5e7eb;
            font-size: ${fontSize};
            table-layout: fixed;
            word-wrap: break-word;
          }

          th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
            padding: ${headerPadding};
            border-bottom: 2px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            font-size: ${headerFontSize};
            text-transform: uppercase;
            letter-spacing: 0.03em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          td {
            padding: ${cellPadding};
            border-bottom: 1px solid #f3f4f6;
            border-right: 1px solid #f3f4f6;
            vertical-align: top;
            word-wrap: break-word;
            overflow: hidden;
          }

          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }

          .text-left { text-align: left; }
          .font-mono {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: ${columnCount <= 6 ? "10px" : "8px"};
          }
          .font-medium { font-weight: 500; }
          .text-muted { color: #6b7280; }

          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: ${columnCount <= 6 ? "10px" : "8px"};
            flex-shrink: 0;
            background: white;
          }

          ${columns
            .map((col, index) => {
              let width = "100px"; // default
              switch (col.id) {
                case "payrollNumber":
                  width = "60px";
                  break;
                case "name":
                  width = columnCount <= 6 ? "200px" : "140px";
                  break;
                case "email":
                  width = "180px";
                  break;
                case "phone":
                  width = "120px";
                  break;
                case "cpf":
                case "pis":
                  width = "110px";
                  break;
                case "position.hierarchy":
                case "sector.name":
                case "managedSector.name":
                  width = "130px";
                  break;
                case "tasksCount":
                case "vacationsCount":
                case "performanceLevel":
                  width = "70px";
                  break;
                case "birth":
                case "dismissal":
                  width = "100px";
                  break;
                case "status":
                  width = "150px";
                  break;
                case "verified":
                case "requirePasswordChange":
                  width = "80px";
                  break;
                case "lastLoginAt":
                case "createdAt":
                case "updatedAt":
                  width = "140px";
                  break;
                case "city":
                case "neighborhood":
                  width = "120px";
                  break;
                case "state":
                  width = "60px";
                  break;
                case "zipCode":
                  width = "90px";
                  break;
                case "address":
                  width = "200px";
                  break;
                default:
                  width = "100px";
              }
              return `th:nth-child(${index + 1}), td:nth-child(${index + 1}) { width: ${width}; min-width: 60px; }`;
            })
            .join("\n")}

          @media print {
            html, body {
              width: 100%;
              height: 100%;
              overflow: visible;
            }

            body {
              display: block;
              min-height: 100vh;
              position: relative;
              padding-bottom: 50px;
            }

            .header {
              margin-bottom: 15px;
              padding-bottom: 10px;
            }

            .logo {
              width: ${columnCount <= 6 ? "80px" : "60px"};
            }

            table {
              font-size: ${columnCount <= 6 ? "9px" : "7px"};
              page-break-inside: auto;
            }

            th {
              padding: ${columnCount <= 6 ? "6px 4px" : "4px 2px"};
              font-size: ${columnCount <= 6 ? "8px" : "6px"};
            }

            td {
              padding: ${columnCount <= 6 ? "4px 3px" : "3px 2px"};
            }

            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }

            thead {
              display: table-header-group;
            }

            .footer {
              position: fixed;
              bottom: 15px;
              left: 12mm;
              right: 12mm;
              background: white;
              font-size: ${columnCount <= 6 ? "8px" : "6px"};
            }

            .content-wrapper {
              padding-bottom: 60px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Logo" class="logo" />
          <div class="header-info">
            <div class="info">
              <p><strong>Data:</strong> ${formatDate(new Date())}</p>
              <p><strong>Total de colaboradores:</strong> ${items.length}</p>
            </div>
          </div>
        </div>

        <div class="content-wrapper">
          <table>
            <thead>
              <tr>
                ${columns.map((col) => `<th class="text-left">${col.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${items
                .map((item) => {
                  return `
                  <tr>
                    ${columns
                      .map((col) => {
                        let value = col.getValue(item) || "-";
                        let className = "";

                        switch (col.id) {
                          case "payrollNumber":
                            className = "font-mono text-left";
                            break;
                          case "name":
                            className = "font-medium text-left";
                            break;
                          case "cpf":
                          case "pis":
                          case "phone":
                            className = "font-mono text-left";
                            break;
                          default:
                            className = "text-left";
                        }

                        return `<td class="${className}">${value}</td>`;
                      })
                      .join("")}
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div class="footer-left">
            <p>Relatório gerado pelo sistema</p>
          </div>
          <div class="footer-right">
            <p><strong>Gerado em:</strong> ${formatDate(new Date())} ${new Date().toLocaleTimeString("pt-BR")}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.focus();

      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      };
    }
  };

  // Filter items based on selection
  const getItemsToExport = () => {
    if (selectedUsers && selectedUsers.size > 0) {
      return currentUsers.filter((user) => selectedUsers.has(user.id));
    }
    return currentUsers;
  };

  return (
    <BaseExportPopover
      className={className}
      currentItems={getItemsToExport()}
      totalRecords={totalRecords}
      selectedItems={selectedUsers}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllUsers}
      entityName="colaborador"
      entityNamePlural="colaboradores"
    />
  );
}
