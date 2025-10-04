import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { formatCurrency, formatDate } from "../../../../utils";
import type { User, Bonus } from "../../../../types";
import { IconUsers, IconDownload } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";

// Extended User interface for stats display
export interface UserStatsRow extends User {
  taskCount: number;
  weightedTaskCount: number;
  bonusValue: number;
  bonus?: Bonus;
  averageTasksPerEmployee?: number;
}

interface UsersStatsCardProps {
  users: UserStatsRow[];
  title?: string;
  subtitle?: string;
  className?: string;
  showExport?: boolean;
  period?: string;
}

// Export columns configuration
const EXPORT_COLUMNS: ExportColumn<UserStatsRow>[] = [
  { id: "name", label: "Nome", getValue: (user: UserStatsRow) => user.name },
  { id: "position.name", label: "Cargo", getValue: (user: UserStatsRow) => user.position?.name || "-" },
  { id: "taskCount", label: "Tarefas", getValue: (user: UserStatsRow) => user.taskCount.toString() },
  { id: "weightedTaskCount", label: "Tarefas Ponderadas", getValue: (user: UserStatsRow) => user.weightedTaskCount.toFixed(1) },
  { id: "bonusValue", label: "Bonificação", getValue: (user: UserStatsRow) => formatCurrency(user.bonusValue) },
];

export function UsersStatsCard({
  users,
  title = "Estatísticas dos Usuários",
  subtitle,
  className,
  showExport = true,
  period
}: UsersStatsCardProps) {

  // Table state management
  const {
    sortConfigs,
    toggleSort,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultPageSize: users.length, // Show all users
    resetSelectionOnPageChange: false,
  });

  // Sort the data based on current sort configs
  const sortedUsers = useMemo(() => {
    if (sortConfigs.length === 0) {
      return [...users].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    return [...users].sort((a, b) => {
      for (const config of sortConfigs) {
        let aValue: any;
        let bValue: any;

        switch (config.column) {
          case 'name':
            aValue = a.name;
            bValue = b.name;
            break;
          case 'position.name':
            aValue = a.position?.name || '';
            bValue = b.position?.name || '';
            break;
          case 'taskCount':
            aValue = a.taskCount;
            bValue = b.taskCount;
            break;
          case 'weightedTaskCount':
            aValue = a.weightedTaskCount;
            bValue = b.weightedTaskCount;
            break;
          case 'bonusValue':
            aValue = a.bonusValue;
            bValue = b.bonusValue;
            break;
          default:
            continue;
        }

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue, 'pt-BR');
        } else {
          comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }

        if (comparison !== 0) {
          return config.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }, [users, sortConfigs]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalUsers = users.length;
    const totalTasks = users.reduce((sum, user) => sum + user.taskCount, 0);
    const totalWeightedTasks = users.reduce((sum, user) => sum + user.weightedTaskCount, 0);
    const totalBonusValue = users.reduce((sum, user) => sum + user.bonusValue, 0);

    const averageTasks = totalUsers > 0 ? totalTasks / totalUsers : 0;
    const averageWeightedTasks = totalUsers > 0 ? totalWeightedTasks / totalUsers : 0;
    const averageBonusValue = totalUsers > 0 ? totalBonusValue / totalUsers : 0;

    return {
      totalUsers,
      totalTasks,
      totalWeightedTasks,
      totalBonusValue,
      averageTasks,
      averageWeightedTasks,
      averageBonusValue,
    };
  }, [users]);

  // Define table columns
  const columns: StandardizedColumn<UserStatsRow>[] = [
    {
      key: "name",
      header: "NOME",
      accessor: (user: UserStatsRow) => (
        <div className="font-medium truncate">{user.name}</div>
      ),
      sortable: true,
      className: "w-64",
      align: "left",
    },
    {
      key: "position.name",
      header: "CARGO",
      accessor: (user: UserStatsRow) => (
        <div className="text-sm truncate">{user.position?.name || "-"}</div>
      ),
      sortable: true,
      className: "w-48",
      align: "left",
    },
    {
      key: "taskCount",
      header: "TAREFAS",
      accessor: (user: UserStatsRow) => (
        <div className="text-sm font-medium text-center tabular-nums">
          {user.taskCount}
        </div>
      ),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "weightedTaskCount",
      header: "TAREFAS PONDERADAS",
      accessor: (user: UserStatsRow) => (
        <div className="text-sm font-medium text-center tabular-nums">
          {user.weightedTaskCount.toFixed(1)}
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "center",
    },
    {
      key: "bonusValue",
      header: "BONIFICAÇÃO",
      accessor: (user: UserStatsRow) => {
        // Check if position is eligible for bonus
        if (!user.position?.bonifiable || (user.performanceLevel || 0) <= 0) {
          return (
            <div className="text-sm text-muted-foreground text-right">
              Não elegível
            </div>
          );
        }

        // Show bonus status badge if available
        const showStatusBadge = !!user.bonus;
        let statusLabel = '';
        let statusVariant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' = 'default';

        if (showStatusBadge) {
          if (user.bonus?.status === 'CONFIRMED') {
            statusLabel = 'Confirmado';
            statusVariant = 'success';
          } else {
            statusLabel = 'Rascunho';
            statusVariant = 'warning';
          }
        }

        return (
          <div className="text-sm font-medium text-right">
            <div className="tabular-nums">
              {formatCurrency(user.bonusValue)}
            </div>
            {showStatusBadge && (
              <div className="mt-1">
                <Badge
                  variant={statusVariant}
                  className="text-xs px-1 py-0 h-5"
                >
                  {statusLabel}
                </Badge>
              </div>
            )}
          </div>
        );
      },
      sortable: true,
      className: "w-36",
      align: "right",
    },
  ];

  // Export functionality
  const handleExport = async (format: ExportFormat, items: UserStatsRow[], columns: ExportColumn<UserStatsRow>[]) => {
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
  };

  const exportToCSV = async (items: UserStatsRow[], columns: ExportColumn<UserStatsRow>[]) => {
    const headers = columns.map((col) => col.label);
    const rows = items.map((item) => columns.map((col) => col.getValue(item)));

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const cellStr = String(cell);
            if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `estatisticas_usuarios_${period || new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (items: UserStatsRow[], columns: ExportColumn<UserStatsRow>[]) => {
    const headers = columns.map((col) => col.label);
    const rows = items.map((item) => columns.map((col) => col.getValue(item)));

    const excelContent = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");

    const blob = new Blob(["\ufeff" + excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `estatisticas_usuarios_${period || new Date().toISOString().slice(0, 10)}.xls`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async (items: UserStatsRow[], columns: ExportColumn<UserStatsRow>[]) => {
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Estatísticas dos Usuários - ${period || formatDate(new Date())}</title>
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
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.5;
            color: #1f2937;
            font-size: 10px;
          }

          .container {
            padding: 16px;
          }

          .header {
            margin-bottom: 16px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 12px;
          }

          h1 {
            font-size: 20px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 8px;
          }

          .info {
            color: #6b7280;
            font-size: 10px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e5e7eb;
            font-size: 10px;
            table-layout: fixed;
          }

          th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
            padding: 8px 4px;
            border: 1px solid #e5e7eb;
            font-size: 9px;
            text-transform: uppercase;
          }

          td {
            padding: 6px 4px;
            border: 1px solid #f3f4f6;
            vertical-align: top;
          }

          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }

          .text-right { text-align: right; }
          .text-center { text-align: center; }

          .summary {
            margin-top: 16px;
            padding: 12px;
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
          }

          .summary h2 {
            font-size: 14px;
            margin-bottom: 8px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }

          .summary-item {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Estatísticas dos Usuários</h1>
            <div class="info">
              <p>Período: ${period || formatDate(new Date())}</p>
              <p>Total de usuários: ${items.length}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                ${columns.map((col) => `<th>${col.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                    <tr>
                      ${columns
                        .map((col) => {
                          const value = col.getValue(item);
                          const isNumeric = col.id === 'taskCount' || col.id === 'weightedTaskCount';
                          const isCurrency = col.id === 'bonusValue';
                          const className = isCurrency || isNumeric ? 'text-right' : '';
                          return `<td class="${className}">${value || ""}</td>`;
                        })
                        .join("")}
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>

          <div class="summary">
            <h2>Resumo</h2>
            <div class="summary-grid">
              <div class="summary-item">
                <span>Total de Usuários:</span>
                <span>${summaryStats.totalUsers}</span>
              </div>
              <div class="summary-item">
                <span>Total de Tarefas:</span>
                <span>${summaryStats.totalTasks}</span>
              </div>
              <div class="summary-item">
                <span>Média de Tarefas:</span>
                <span>${summaryStats.averageTasks.toFixed(1)}</span>
              </div>
              <div class="summary-item">
                <span>Total Ponderado:</span>
                <span>${summaryStats.totalWeightedTasks.toFixed(1)}</span>
              </div>
              <div class="summary-item">
                <span>Média Ponderada:</span>
                <span>${summaryStats.averageWeightedTasks.toFixed(1)}</span>
              </div>
              <div class="summary-item">
                <span>Total Bonificações:</span>
                <span>${formatCurrency(summaryStats.totalBonusValue)}</span>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      };
    }
  };

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="flex-shrink-0 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <IconUsers className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {showExport && users.length > 0 && (
            <BaseExportPopover<UserStatsRow>
              className="ml-2"
              currentItems={users}
              totalRecords={users.length}
              visibleColumns={new Set(EXPORT_COLUMNS.map(col => col.id))}
              exportColumns={EXPORT_COLUMNS}
              defaultVisibleColumns={new Set(EXPORT_COLUMNS.map(col => col.id))}
              onExport={handleExport}
              onFetchAllItems={async () => users}
              entityName="estatística de usuário"
              entityNamePlural="estatísticas de usuários"
            >
              <Button variant="outline" size="sm">
                <IconDownload className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </BaseExportPopover>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full flex flex-col">
          {/* Statistics Summary */}
          <div className="px-6 pb-4 border-b border-border">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-lg text-primary">{summaryStats.totalUsers}</div>
                <div className="text-muted-foreground">Usuários</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-primary">{summaryStats.totalTasks}</div>
                <div className="text-muted-foreground">Tarefas</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-primary">{summaryStats.averageTasks.toFixed(1)}</div>
                <div className="text-muted-foreground">Média Tarefas</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-primary">{summaryStats.totalWeightedTasks.toFixed(1)}</div>
                <div className="text-muted-foreground">Total Ponderado</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-primary">{summaryStats.averageWeightedTasks.toFixed(1)}</div>
                <div className="text-muted-foreground">Média Ponderada</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-primary">{formatCurrency(summaryStats.totalBonusValue)}</div>
                <div className="text-muted-foreground">Total Bonificações</div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-hidden">
            <StandardizedTable<UserStatsRow>
              columns={columns}
              data={sortedUsers}
              getItemKey={(user) => user.id}
              isLoading={false}
              emptyMessage="Nenhum usuário encontrado"
              emptyDescription="Não há dados de usuários disponíveis para o período selecionado"
              emptyIcon={IconUsers}
              onSort={toggleSort}
              getSortDirection={getSortDirection}
              getSortOrder={getSortOrder}
              sortConfigs={sortConfigs.map((config) => ({ field: config.column, direction: config.direction }))}
              showPagination={false}
              showPageInfo={false}
              currentPage={0}
              totalPages={1}
              pageSize={sortedUsers.length}
              totalRecords={sortedUsers.length}
              className="h-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}