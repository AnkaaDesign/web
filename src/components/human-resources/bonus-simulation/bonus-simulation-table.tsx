import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  IconFilter,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconUsers,
  IconCurrencyDollar,
  IconTrendingUp,
  IconReceipt,
  IconCalculator
} from "@tabler/icons-react";
import { formatCurrency } from "../../../utils";
import { useBonusSimulation, useSectors } from "../../../hooks";
import { BonusSimulationFilters } from "./bonus-simulation-filters";

interface BonusSimulationTableProps {
  className?: string;
}

export function BonusSimulationTable({ className }: BonusSimulationTableProps) {
  // Current date for default period
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // State management
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [simulationParams, setSimulationParams] = useState({
    year: currentYear,
    month: currentMonth,
    taskQuantity: undefined as number | undefined, // Don't provide default - fetch from DB
    sectorIds: [] as string[],
    excludeUserIds: [] as string[],
  });

  // Fetch data
  const { data: sectorsData } = useSectors();
  const sectors = sectorsData?.data || [];

  const {
    data: simulationData,
    isLoading,
    isError,
    refetch
  } = useBonusSimulation(simulationParams);

  // Debug log
  console.log('Simulation data from hook:', simulationData);
  console.log('Simulation params:', simulationParams);

  // Parse simulation response
  const simulation = simulationData?.data;
  const users = simulation?.users || [];
  const summary = simulation?.summary || {};
  const parameters = simulation?.parameters || {};

  // Filter management
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (simulationParams.sectorIds.length > 0) count++;
    if (simulationParams.excludeUserIds.length > 0) count++;
    if (simulationParams.taskQuantity !== undefined) count++; // Has custom task quantity
    return count;
  }, [simulationParams]);

  const handleFiltersApply = useCallback((newFilters: typeof simulationParams) => {
    setSimulationParams(newFilters);
    setShowFiltersModal(false);
  }, []);

  const handleFiltersReset = useCallback(() => {
    setSimulationParams({
      year: currentYear,
      month: currentMonth,
      taskQuantity: undefined,
      sectorIds: [],
      excludeUserIds: [],
    });
  }, [currentYear, currentMonth]);

  // Summary statistics
  const summaryCards = [
    {
      title: "Tarefas Totais",
      value: summary.totalTasks?.toString() || "0",
      subtitle: "tarefas no período",
      icon: IconCalculator,
      color: "text-blue-600",
    },
    {
      title: "Usuários Elegíveis",
      value: summary.totalUsers?.toString() || "0",
      subtitle: "usuários bonificáveis",
      icon: IconUsers,
      color: "text-blue-600",
    },
    {
      title: "Média por Usuário",
      value: summary.averageTasksPerUser?.toString() || "0",
      subtitle: "tarefas/usuário",
      icon: IconTrendingUp,
      color: "text-amber-600",
    },
    {
      title: "Total Bonificação",
      value: formatCurrency(summary.totalBonusAmount || 0),
      subtitle: "em bonificações",
      icon: IconCurrencyDollar,
      color: "text-green-600",
    },
  ];

  return (
    <Card className={`h-full flex flex-col shadow-sm border border-border ${className || ""}`}>
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-4">
          {/* Filters Button */}
          <Button
            variant={activeFiltersCount > 0 ? "default" : "outline"}
            onClick={() => setShowFiltersModal(true)}
            className="gap-2"
          >
            <IconFilter size={16} />
            Filtros{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
          </Button>

          {/* Reset Button */}
          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              onClick={handleFiltersReset}
              className="gap-2"
            >
              <IconRefresh size={16} />
              Resetar
            </Button>
          )}

          {/* Refresh Button */}
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-2"
          >
            <IconRefresh size={16} />
            Atualizar
          </Button>

          {/* Period Display */}
          <div className="text-sm text-muted-foreground">
            Período: {simulationParams.month.toString().padStart(2, '0')}/{simulationParams.year}
          </div>
        </div>

        {/* Summary Toggle */}
        <Collapsible open={showSummary} onOpenChange={setShowSummary}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <IconReceipt size={16} />
              Resumo
              {showSummary ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Summary Statistics */}
      <Collapsible open={showSummary} onOpenChange={setShowSummary}>
        <CollapsibleContent>
          <div className="p-4 border-b bg-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {summaryCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <div key={index} className="flex flex-col h-full p-3 bg-card rounded-lg border">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${card.color}`} />
                      <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    </div>
                    <div className="flex-grow flex flex-col justify-between">
                      <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                      <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Additional Parameters Display */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div>
                <strong>Tarefas Configuradas:</strong> {parameters.taskQuantity || 0}
              </div>
              <div>
                <strong>Usuários Filtrados:</strong> {parameters.userQuantity || 0}
              </div>
              <div>
                <strong>Média Real:</strong> {parameters.averageTasksPerUser || 0} tarefas/usuário
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>Erro ao carregar a simulação</p>
            <Button onClick={() => refetch()} className="mt-4">
              Tentar Novamente
            </Button>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>Nenhum usuário elegível encontrado para os filtros aplicados</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead className="text-center">Nível</TableHead>
                <TableHead className="text-right">Remuneração</TableHead>
                <TableHead className="text-right">Bonificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user: any) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">
                    <div>
                      <p>{user.userName}</p>
                      <p className="text-xs text-muted-foreground">{user.userEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {user.sectorName}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{user.positionName}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={user.performanceLevel === 0 ? "destructive" : "default"}
                      className="w-6 h-6 rounded-full text-xs font-bold"
                    >
                      {user.performanceLevel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(user.remuneration)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-bold ${
                      user.bonusAmount > 0 ? 'text-green-600' : 'text-muted-foreground'
                    }`}>
                      {formatCurrency(user.bonusAmount)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Filters Modal */}
      <BonusSimulationFilters
        open={showFiltersModal}
        onOpenChange={setShowFiltersModal}
        filters={simulationParams}
        onApply={handleFiltersApply}
        onReset={handleFiltersReset}
        sectors={sectors}
        users={users} // Pass all users for exclusion filter
      />
    </Card>
  );
}