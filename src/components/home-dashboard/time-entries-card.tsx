import { useMemo } from "react";
import { IconClock } from "@tabler/icons-react";
import { DashboardCardList, DashboardPagination } from "./dashboard-card-list";
import { useMySecullumCalculations } from "../../hooks/integrations/use-secullum";
import { renderHourValue } from "../integrations/secullum/cell-renderers";

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
  faltas: string;
  atraso: string;
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

  // Secullum's /Calculos column names vary in case and exact spelling
  // (e.g. "Atras." vs "Atrasos"), and the canonical label sometimes lives in
  // NomeExibicao rather than Nome — mirror the bonus/payroll integration
  // services and match case-insensitively against both, with synonyms.
  const columnIndex = new Map<string, number>();
  Colunas.forEach((col: any, index: number) => {
    for (const key of [col?.Nome, col?.NomeExibicao]) {
      if (key) {
        const norm = String(key).toLowerCase().trim();
        if (!columnIndex.has(norm)) columnIndex.set(norm, index);
      }
    }
  });
  const colIdx = (candidates: string[], fallback: number): number => {
    for (const c of candidates) {
      const idx = columnIndex.get(c);
      if (idx != null) return idx;
    }
    return fallback;
  };

  const idxData = colIdx(["data"], 0);
  const idxEntrada1 = colIdx(["entrada 1", "entrada1"], 1);
  const idxSaida1 = colIdx(["saída 1", "saida 1", "saída1", "saida1"], 2);
  const idxEntrada2 = colIdx(["entrada 2", "entrada2"], 3);
  const idxSaida2 = colIdx(["saída 2", "saida 2", "saída2", "saida2"], 4);
  const idxNormais = colIdx(["normais"], 7);
  const idxFaltas = colIdx(["faltas", "ausências", "ausencias"], -1);
  const idxAtraso = colIdx(["atras.", "atrasos", "atraso", "atras"], -1);

  const at = (row: any[], idx: number): string => (idx >= 0 ? row[idx] || "" : "");

  return Linhas.map((row: any[]) => ({
    date: at(row, idxData),
    entrada1: at(row, idxEntrada1),
    saida1: at(row, idxSaida1),
    entrada2: at(row, idxEntrada2),
    saida2: at(row, idxSaida2),
    normais: at(row, idxNormais),
    faltas: at(row, idxFaltas),
    atraso: at(row, idxAtraso),
  }));
}

interface TimeEntriesCardProps {
  embedded?: boolean;
}

export function TimeEntriesCard({ embedded }: TimeEntriesCardProps = {}) {
  const weekRange = useMemo(() => getWeekRange(), []);
  const { data, isLoading, isError } = useMySecullumCalculations({
    startDate: weekRange.startDate,
    endDate: weekRange.endDate,
  });

  const notRegistered = (data?.data as any)?.notRegistered;
  const entries = useMemo(() => parseSecullumResponse(data), [data]);

  if (notRegistered) {
    return (
      <DashboardCardList
        title="Ponto da Semana"
        icon={<IconClock className="h-4 w-4 text-teal-500" />}
        viewAllLink="/pessoal/meus-pontos"
        emptyMessage="Sem cadastro no sistema de ponto"
        isEmpty
        embedded={embedded}
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
        embedded={embedded}
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
        embedded={embedded}
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
      embedded={embedded}
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
      <div className="sticky top-0 z-10 grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto_auto_auto] gap-x-2 px-4 py-2 bg-secondary border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="w-16">Data</span>
        <span className="text-center">Entrada 1</span>
        <span className="text-center">Saída 1</span>
        <span className="text-center">Entrada 2</span>
        <span className="text-center">Saída 2</span>
        <span className="w-12 text-right">Normais</span>
        <span className="w-12 text-right">Faltas</span>
        <span className="w-12 text-right">Atraso</span>
      </div>
      {entries.map((entry, index) => (
        <div
          key={index}
          className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto_auto_auto] gap-x-2 items-center px-4 py-2 border-b border-border last:border-b-0"
        >
          <span className="text-xs font-medium text-foreground w-16">
            {entry.date || `Dia ${index + 1}`}
          </span>
          <span className="text-xs text-muted-foreground text-center">{entry.entrada1 || "—"}</span>
          <span className="text-xs text-muted-foreground text-center">{entry.saida1 || "—"}</span>
          <span className="text-xs text-muted-foreground text-center">{entry.entrada2 || "—"}</span>
          <span className="text-xs text-muted-foreground text-center">{entry.saida2 || "—"}</span>
          <span className="text-xs text-muted-foreground w-12 text-right">{entry.normais || "—"}</span>
          <span className="w-12 text-right">{renderHourValue(entry.faltas, "bad")}</span>
          <span className="w-12 text-right">{renderHourValue(entry.atraso, "bad")}</span>
        </div>
      ))}
    </DashboardCardList>
  );
}
