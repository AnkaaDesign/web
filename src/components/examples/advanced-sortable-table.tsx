import React, { useState, useMemo } from "react";
import { useUnifiedTableState } from "@/hooks/use-unified-table-state";
import { useEnhancedTableSort } from "@/hooks/use-enhanced-table-sort";
import { useSortFeedback, TableSortFeedback } from "@/components/ui/table-sort-feedback";
import { SortableTableHeader } from "@/components/ui/sortable-table-header";
import { MultiSortSummary } from "@/components/ui/table-sort-icon";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SortableColumnConfig, customSortFunctions, TableSortUtils } from "@/utils/table-sort-utils";
import { cn } from "@/lib/utils";
import { formatCurrency } from "../../utils/number";
import { formatDate } from "../../utils/date";

/**
 * Sample data interface for demonstration
 */
interface SampleEmployee {
  id: string;
  name: string;
  cpf: string;
  position: string;
  salary: number;
  hireDate: Date;
  isActive: boolean;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  department: string;
  email: string;
  tasksCompleted: number;
  performance: number;
}

/**
 * Generate sample data for testing
 */
const generateSampleData = (): SampleEmployee[] => {
  const names = [
    "João da Silva",
    "Maria dos Santos",
    "José de Oliveira",
    "Ana Paula Costa",
    "Carlos Eduardo Lima",
    "Fernanda Alves",
    "Ricardo Mendes",
    "Juliana Ferreira",
    "Paulo Roberto",
    "Camila Rodrigues",
    "Marcos Antonio",
    "Letícia Martins",
    "Eduardo Pereira",
    "Patrícia Souza",
    "Rafael Nascimento",
    "Gabriela Moreira",
  ];

  const positions = ["Desenvolvedor", "Designer", "Gerente", "Analista", "Coordenador", "Especialista", "Assistente", "Supervisor", "Diretor", "Consultor"];

  const departments = ["Tecnologia", "Design", "Vendas", "Marketing", "Recursos Humanos", "Financeiro", "Operações", "Qualidade"];

  const priorities: SampleEmployee["priority"][] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

  return Array.from({ length: 50 }, (_, index) => ({
    id: `emp_${String(index + 1).padStart(3, "0")}`,
    name: names[index % names.length],
    cpf: `${String(Math.floor(Math.random() * 999)).padStart(3, "0")}.${String(Math.floor(Math.random() * 999)).padStart(3, "0")}.${String(Math.floor(Math.random() * 999)).padStart(3, "0")}-${String(Math.floor(Math.random() * 99)).padStart(2, "0")}`,
    position: positions[Math.floor(Math.random() * positions.length)],
    salary: Math.floor(Math.random() * 8000) + 2000,
    hireDate: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
    isActive: Math.random() > 0.1, // 90% active
    priority: priorities[Math.floor(Math.random() * priorities.length)],
    department: departments[Math.floor(Math.random() * departments.length)],
    email: `${names[index % names.length].toLowerCase().replace(/\s+/g, ".")}@empresa.com.br`,
    tasksCompleted: Math.floor(Math.random() * 100),
    performance: Math.round((Math.random() * 40 + 60) * 10) / 10, // 60-100 with 1 decimal
  }));
};

/**
 * Column configuration with enhanced sorting features
 */
const createColumnConfig = (): SortableColumnConfig[] => [
  {
    key: "name",
    header: "Nome",
    sortable: true,
    customSortFunction: customSortFunctions.brazilianName,
    nullHandling: "last",
    accessor: "name",
    align: "left",
    tooltip: "Nome completo do funcionário",
  },
  {
    key: "cpf",
    header: "CPF",
    sortable: true,
    customSortFunction: customSortFunctions.cpf,
    accessor: "cpf",
    align: "left",
  },
  {
    key: "position",
    header: "Cargo",
    sortable: true,
    accessor: "position",
    align: "left",
  },
  {
    key: "department",
    header: "Departamento",
    sortable: true,
    accessor: "department",
    align: "left",
  },
  {
    key: "salary",
    header: "Salário",
    sortable: true,
    customSortFunction: customSortFunctions.currency,
    accessor: "salary",
    align: "right",
    tooltip: "Salário em Reais (R$)",
  },
  {
    key: "hireDate",
    header: "Data de Contratação",
    sortable: true,
    customSortFunction: customSortFunctions.date,
    accessor: "hireDate",
    align: "center",
    nullHandling: "last",
  },
  {
    key: "priority",
    header: "Prioridade",
    sortable: true,
    customSortFunction: customSortFunctions.priority,
    accessor: "priority",
    align: "center",
  },
  {
    key: "tasksCompleted",
    header: "Tarefas",
    sortable: true,
    customSortFunction: customSortFunctions.quantity,
    accessor: "tasksCompleted",
    align: "right",
    tooltip: "Número de tarefas concluídas",
  },
  {
    key: "performance",
    header: "Performance",
    sortable: true,
    accessor: "performance",
    align: "right",
    tooltip: "Avaliação de performance (0-100)",
  },
  {
    key: "isActive",
    header: "Status",
    sortable: true,
    accessor: "isActive",
    align: "center",
  },
];

/**
 * Advanced sortable table example showcasing all features
 */
export function AdvancedSortableTableExample() {
  // Sample data
  const [data] = useState(generateSampleData);
  const [columns] = useState(createColumnConfig);

  // Table state management
  const tableState = useUnifiedTableState({
    defaultPageSize: 10,
    defaultSort: [{ column: "name", direction: "asc" }],
    namespace: "employees",
    enableMultiSort: true,
  });

  // Enhanced sorting
  const sortHook = useEnhancedTableSort({
    columns,
    sortConfigs: tableState.sortConfigs,
    onSortChange: (sortConfigs) => {
      // Update table state and trigger feedback
      const sortParam = TableSortUtils.serializeSortForUrl(sortConfigs);
      // This would normally update the URL via tableState methods
      console.log("Sort changed:", sortConfigs, sortParam);

      feedbackHook.showLoading("Aplicando ordenação...");

      // Simulate async sort operation
      setTimeout(() => {
        feedbackHook.showSuccess();
      }, 500);
    },
    enableMultiSort: true,
    enableCustomSorts: true,
    enableOptimisticSort: true,
    maxSortColumns: 3,
  });

  // Sort feedback
  const feedbackHook = useSortFeedback({
    enableFeedback: true,
    feedbackDuration: 2000,
    feedbackVariant: "toast",
  });

  // Sort and paginate data
  const processedData = useMemo(() => {
    let sortedData = [...data];

    // Apply sorting if any sort configs exist
    if (tableState.sortConfigs.length > 0) {
      sortedData = sortHook.sortData(sortedData);
    }

    // Apply pagination
    const startIndex = tableState.page * tableState.pageSize;
    const endIndex = startIndex + tableState.pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [data, tableState.sortConfigs, tableState.page, tableState.pageSize, sortHook]);

  // Column visibility (all visible for demo)
  const visibleColumns = useMemo(() => {
    return new Set(columns.map((col) => col.key));
  }, [columns]);

  // Handle column sort with event detection
  const handleSort = (columnKey: string, event?: React.MouseEvent) => {
    sortHook.toggleSort(columnKey, event);
  };

  // Get priority badge variant
  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "destructive";
      case "HIGH":
        return "destructive";
      case "MEDIUM":
        return "warning";
      case "LOW":
        return "secondary";
      default:
        return "secondary";
    }
  };

  // Quick sort presets
  const sortPresets = [
    {
      name: "Por Nome",
      sortConfigs: [{ column: "name", direction: "asc" as const }],
    },
    {
      name: "Por Salário (Maior)",
      sortConfigs: [{ column: "salary", direction: "desc" as const }],
    },
    {
      name: "Por Data de Contratação",
      sortConfigs: [{ column: "hireDate", direction: "desc" as const }],
    },
    {
      name: "Por Performance",
      sortConfigs: [
        { column: "performance", direction: "desc" as const, order: 0 },
        { column: "tasksCompleted", direction: "desc" as const, order: 1 },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Sistema de Ordenação Avançado</CardTitle>
          <CardDescription>
            Demonstração completa do sistema de ordenação com suporte a múltiplas colunas, funções customizadas, persistência de estado em URL e feedback imediato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Sort presets */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Predefinições de Ordenação</h4>
              <div className="flex flex-wrap gap-2">
                {sortPresets.map((preset) => (
                  <Button key={preset.name} variant="outline" size="sm" onClick={() => sortHook.applySortPreset(preset)}>
                    {preset.name}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={() => sortHook.clearSort()} disabled={!sortHook.hasActiveSort()}>
                  Limpar Ordenação
                </Button>
              </div>
            </div>

            {/* Sort summary */}
            {sortHook.sortSummary && (
              <MultiSortSummary
                sortConfigs={sortHook.sortConfigs}
                columnLabels={sortHook.getColumnLabels()}
                onRemoveSort={(column) => sortHook.clearSort(column)}
                onClearAll={() => sortHook.clearSort()}
              />
            )}

            {/* Features info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{sortHook.maxSortColumns}</div>
                <div className="text-sm text-muted-foreground">Máximo de Colunas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{sortHook.sortConfigs.length}</div>
                <div className="text-sm text-muted-foreground">Ordenações Ativas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{data.length}</div>
                <div className="text-sm text-muted-foreground">Total de Registros</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sort feedback */}
      <TableSortFeedback config={feedbackHook.feedbackConfig} sortConfigs={sortHook.sortConfigs} columnLabels={sortHook.getColumnLabels()} onDismiss={feedbackHook.hideFeedback} />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <SortableTableHeader
                columns={columns}
                visibleColumns={visibleColumns}
                showCheckbox={false}
                onSort={handleSort}
                getSortDirection={sortHook.getSortDirection}
                getSortOrder={sortHook.getSortOrder}
                showMultipleSortOrder={sortHook.hasMultipleSort}
              />
              <TableBody>
                {processedData.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell className="font-mono text-sm">{employee.cpf}</TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(employee.salary)}</TableCell>
                    <TableCell className="text-center">{formatDate(employee.hireDate)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getPriorityVariant(employee.priority)}>{employee.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{employee.tasksCompleted}</TableCell>
                    <TableCell className="text-right">{employee.performance}%</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={employee.isActive ? "success" : "secondary"}>{employee.isActive ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination info */}
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
            <div className="text-sm text-muted-foreground">
              Mostrando {tableState.page * tableState.pageSize + 1} até {Math.min((tableState.page + 1) * tableState.pageSize, data.length)} de {data.length} registros
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => tableState.setPage(Math.max(0, tableState.page - 1))} disabled={tableState.page === 0}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => tableState.setPage(tableState.page + 1)} disabled={(tableState.page + 1) * tableState.pageSize >= data.length}>
                Próximo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Como Usar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-1">Ordenação Simples</h4>
              <p className="text-muted-foreground">
                Clique no cabeçalho de qualquer coluna para ordenar. Clique novamente para inverter a ordem. Clique uma terceira vez para remover a ordenação.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Ordenação Múltipla</h4>
              <p className="text-muted-foreground">
                Mantenha Ctrl/Cmd pressionado e clique em outras colunas para adicionar ordenações secundárias. Os números indicam a ordem de prioridade.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Funções Customizadas</h4>
              <p className="text-muted-foreground">
                As colunas têm funções de ordenação específicas: nomes brasileiros, CPF, moeda, datas e prioridades são ordenados com lógica customizada.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Valores Nulos</h4>
              <p className="text-muted-foreground">Valores nulos e vazios são tratados adequadamente, aparecendo no final por padrão.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
