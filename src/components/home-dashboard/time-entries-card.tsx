import { useMemo } from "react";
import { IconClock } from "@tabler/icons-react";
import { DashboardCardList, DashboardPagination } from "./dashboard-card-list";
import { useMySecullumCalculations } from "../../hooks/integrations/use-secullum";

function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    startDate: monday.toISOString().split("T")[0],
    endDate: sunday.toISOString().split("T")[0],
  };
}

interface ParsedEntry {
  date: string;
  entrada1: string;
  saida1: string;
  entrada2: string;
  saida2: string;
  normais: string;
}

function parseSecullumResponse(data: any): ParsedEntry[] {
  const apiResponse = data?.data || data;

  if (apiResponse && "success" in apiResponse && apiResponse.success === false) {
    return [];
  }

  const secullumData = apiResponse && "data" in apiResponse ? apiResponse.data : null;
  if (!secullumData) return [];

  const { Colunas = [], Linhas = [] } = secullumData;

  if (!Array.isArray(Colunas) || !Array.isArray(Linhas)) {
    return [];
  }

  const columnMap = new Map<string, number>();
  Colunas.forEach((col: any, index: number) => {
    if (col?.Nome) {
      columnMap.set(col.Nome, index);
    }
  });

  return Linhas.map((row: any[]) => ({
    date: row[columnMap.get("Data") ?? 0] || "",
    entrada1: row[columnMap.get("Entrada 1") ?? 1] || "",
    saida1: row[columnMap.get("Saída 1") ?? 2] || "",
    entrada2: row[columnMap.get("Entrada 2") ?? 3] || "",
    saida2: row[columnMap.get("Saída 2") ?? 4] || "",
    normais: row[columnMap.get("Normais") ?? 7] || "",
  }));
}

export function TimeEntriesCard() {
  const weekRange = useMemo(() => getWeekRange(), []);
  const { data, isLoading, isError } = useMySecullumCalculations({
    startDate: weekRange.startDate,
    endDate: weekRange.endDate,
  });

  const notRegistered = data?.data?.notRegistered;
  const entries = useMemo(() => parseSecullumResponse(data), [data]);

  if (notRegistered) {
    return (
      <DashboardCardList
        title="Ponto da Semana"
        icon={<IconClock className="h-4 w-4 text-teal-500" />}
        viewAllLink="/pessoal/meus-pontos"
        emptyMessage="Sem cadastro no sistema de ponto"
        isEmpty
      />
    );
  }

  if (isError) {
    return (
      <DashboardCardList
        title="Ponto da Semana"
        icon={<IconClock className="h-4 w-4 text-teal-500" />}
        viewAllLink="/pessoal/meus-pontos"
        emptyMessage="Sem dados de ponto disponíveis"
        isEmpty
      />
    );
  }

  if (isLoading) {
    return (
      <DashboardCardList
        title="Ponto da Semana"
        icon={<IconClock className="h-4 w-4 text-teal-500" />}
        viewAllLink="/pessoal/meus-pontos"
        emptyMessage=""
        isEmpty={false}
      >
        <div className="px-4 py-6 text-center">
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </DashboardCardList>
    );
  }

  return (
    <DashboardCardList
      title="Ponto da Semana"
      icon={<IconClock className="h-4 w-4 text-teal-500" />}
      emptyMessage="Sem registros de ponto esta semana"
      isEmpty={entries.length === 0}
      footer={
        <DashboardPagination
          totalItems={entries.length}
          page={0}
          pageSize={20}
          onPageChange={() => {}}
        />
      }
    >
      {/* Table header */}
      <div className="sticky top-0 z-10 grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-x-2 px-4 py-2 bg-secondary border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="w-20">Data</span>
        <span className="text-center">Entrada 1</span>
        <span className="text-center">Saída 1</span>
        <span className="text-center">Entrada 2</span>
        <span className="text-center">Saída 2</span>
        <span className="w-14 text-right">Normais</span>
      </div>
      {entries.map((entry, index) => (
        <div
          key={index}
          className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-x-2 items-center px-4 py-2 border-b border-border last:border-b-0"
        >
          <span className="text-xs font-medium text-foreground w-20">
            {entry.date || `Dia ${index + 1}`}
          </span>
          <span className="text-xs text-muted-foreground text-center">{entry.entrada1 || "—"}</span>
          <span className="text-xs text-muted-foreground text-center">{entry.saida1 || "—"}</span>
          <span className="text-xs text-muted-foreground text-center">{entry.entrada2 || "—"}</span>
          <span className="text-xs text-muted-foreground text-center">{entry.saida2 || "—"}</span>
          <span className="text-xs text-muted-foreground w-14 text-right">{entry.normais || "—"}</span>
        </div>
      ))}
    </DashboardCardList>
  );
}
