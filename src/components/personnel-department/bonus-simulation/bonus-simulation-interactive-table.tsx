import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IconUsers,
  IconFilter,
  IconBuilding,
  IconUserMinus,
  IconBriefcase,
  IconUserCheck,
  IconRestore
} from "@tabler/icons-react";
import { formatCurrency, getCurrentPayrollPeriod } from "../../../utils";
import { useUsers, useSectors, usePositions } from "../../../hooks";
import { bonusService } from "../../../api-client";
import { useBonusSimulation } from "../../../hooks/personnel-department/use-bonus";
import { cn } from "@/lib/utils";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { DataTable } from "@/components/ui/datatable";
import { usePricingVisible } from "@/contexts/pricing-context";
import { usePersistedState } from "@/hooks/common/use-persisted-state";
import { toast } from "@/components/ui/sonner";
import { BonusSimulationFilters } from "./bonus-simulation-filters";
import { createBonusSimulationColumns, type SimulatedUser, type RowOverride } from "./bonus-simulation-columns";

// localStorage keys — persist filters/task config/row edits so the user returns to
// exactly where they left off after navigating away. (Column layout + sort are
// persisted server-side by the DataTable via its `tableId`.)
const FILTERS_STORAGE_KEY = "bonus-simulation-filters";
const TASK_STORAGE_KEY = "bonus-simulation-task";
const OVERRIDES_STORAGE_KEY = "bonus-simulation-row-overrides";

/**
 * Divisor do período (headcount médio) → texto pt-BR com 2 casas.
 *
 * O divisor é FRACIONÁRIO por construção — quem entrou ou saiu no meio do
 * período conta a fração de dias úteis que trabalhou — e o campo "Colaboradores"
 * imprimia o `number` cru: `12.5002`, com ponto decimal e quatro casas. Mesma
 * regra da coluna "Colaboradores" da página de Bônus, para os dois números
 * baterem à vista.
 */
const formatDivisor = (value: number): string =>
  Number.isInteger(value)
    ? value.toLocaleString("pt-BR")
    : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Quantidade de tarefas → texto pt-BR com 1 casa ("43,0"). */
const formatTaskInput = (value: number): string => value.toFixed(1).replace(".", ",");

// Escada de cargos usada como ÚLTIMO recurso.
//
// A lista de verdade vem do banco (`usePositions({ bonifiable: true })`). Esta
// constante existia sozinha e era o handle de resolução de salário: a simulação
// mandava `positionName`, o servidor fazia `salaryByPositionName.get(nome)` e,
// quando não achava, caía em `salary = 0` — que `calculateBonus` devolve como
// R$ 0,00 SEM erro. Renomear "Senior IV" para "Sênior IV" no cadastro zeraria
// toda linha que passasse pelo seletor, em silêncio.
const POSITIONS = [
  "Junior I", "Junior II", "Junior III", "Junior IV",
  "Pleno I", "Pleno II", "Pleno III", "Pleno IV",
  "Senior I", "Senior II", "Senior III", "Senior IV"
];

/** Cadastro de elegibilidade do período, como o endpoint de stats devolve. */
interface EligibilityRow {
  userId: string;
  userName: string;
  weight: number;
  temporalWeight: number;
  absenceFactor: number;
  eligibleDays: number;
  reason: string;
  terminatedInPeriod: boolean;
  currentlyEmployed: boolean;
}

/** Texto curto do porquê de alguém não valer período inteiro. */
function describeWeight(row: EligibilityRow): string {
  if (row.weight >= 1) return '';
  const parts: string[] = [];
  if (row.temporalWeight < 1) {
    parts.push(
      row.terminatedInPeriod
        ? `desligado no período (${row.eligibleDays} dia(s) úteis)`
        : `entrou no período (${row.eligibleDays} dia(s) úteis)`,
    );
  }
  if (row.absenceFactor < 1) {
    parts.push(`afastamento médico (fator ${row.absenceFactor.toFixed(2)})`);
  }
  return parts.join(' + ');
}

interface BonusSimulationInteractiveTableProps {
  className?: string;
  embedded?: boolean;
}

export function BonusSimulationInteractiveTable({ className, embedded: _embedded = false }: BonusSimulationInteractiveTableProps) {
  // Subscribe to the show/hide-values toggle: the header totals are formatted with
  // formatCurrency() during THIS component's render, so without a subscription they
  // keep the masked/unmasked string from the last render. (The table cells are
  // covered by the DataTable's own subscription.)
  usePricingVisible();

  // State
  // Quantidade de tarefas do período. `originalTaskQuantity` é SEMPRE o número
  // vivo vindo da API; `taskOverride` é o "e se" que o operador digitou —
  // `null` significa "siga o período", não "zero".
  //
  // Antes `taskQuantity` era persistido em localStorage numa chave sem período
  // (`bonus-simulation-task-quantity`) e o seed vivo só rodava quando o valor
  // guardado fosse EXATAMENTE 0. Qualquer número deixado para trás — inclusive
  // o derivado de uma edição no campo "Média", que grava `média × divisor` —
  // sobrevivia a todo reload e a toda virada de mês, e a simulação abria com a
  // base de outro período. Foi o que abriu a divergência de 24/08/2026: o
  // simulador abriu com 33,4 tarefas (B1 = 2,67) enquanto o período vivo tinha
  // 43,0 (B1 = 3,44) — e como o polinômio é de 5º grau e MUITO íngreme nessa
  // faixa, 22% de erro na base virou 145% de erro em todo bônus da tela.
  const [originalTaskQuantity, setOriginalTaskQuantity] = useState<number>(0); // Store original for restore (always the fetched value)
  // O período vai DENTRO do valor, não na chave.
  //
  // `usePersistedState` lê o localStorage só no inicializador (na montagem) e
  // depois GRAVA o estado atual sempre que a chave muda — então uma chave
  // dinâmica por período faria o pior dos dois mundos na virada do dia 26: não
  // releria o valor do período novo E carimbaria o override do período velho
  // por cima dele. Chave fixa + carimbo no valor: período diferente do atual é
  // simplesmente ignorado, sem depender do hook reagir a nada.
  const [storedOverride, setStoredOverride] = usePersistedState<{
    period: string;
    value: number;
  } | null>(`${TASK_STORAGE_KEY}-override`, null);
  // Buffer de digitação — deliberadamente NÃO persistido: quem manda no valor é
  // `taskOverride`, e o texto é sempre derivado dele.
  const [taskInput, setTaskInput] = useState<string>('0,0');
  const [averageInput, setAverageInput] = useState<string>('0,00'); // String value for controlled input (Brazilian format) - 2 decimals
  const [simulatedUsers, setSimulatedUsers] = useState<SimulatedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [liveTaskInfo, setLiveTaskInfo] = useState<{ rawCount: number; weightedCount: number; suspendedCount: number; eligibleUsers: number; averageTasksPerEmployee: number } | null>(null);

  /**
   * Cadastro de elegibilidade do período (userId → peso e motivo), servido pelo
   * mesmo endpoint das estatísticas.
   *
   * A tela NÃO decide mais sozinha quem entra. Antes ela montava a lista com
   * "vínculo ACTIVE + cargo bonificável" e errava dos dois lados: mostrava quem
   * a folha EXCLUI (afastamento médico integral zera o peso) e escondia quem a
   * folha INCLUI (desligado no meio do período, que é justamente o número da
   * rescisão) — e pagava todo mundo como se fosse período inteiro.
   *
   * `null` = ainda não chegou; a lista fica vazia até chegar, em vez de
   * mostrar um recorte errado por um instante.
   */
  const [eligibility, setEligibility] = useState<Map<string, EligibilityRow> | null>(null);

  // Filter state - no default filters, show all eligible users (persisted)
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [filters, setFilters] = usePersistedState(FILTERS_STORAGE_KEY, {
    sectorIds: [] as string[],
    positionIds: [] as string[],
    includeUserIds: [] as string[],
    excludeUserIds: [] as string[],
    showOnlyEligible: true // Default to showing only eligible users
  });

  // Per-row Cargo/Performance edits (persisted). Read via ref in the init
  // effect so applying them doesn't make every edit rebuild the whole table.
  const [rowOverrides, setRowOverrides] = usePersistedState<Record<string, RowOverride>>(OVERRIDES_STORAGE_KEY, {});
  const rowOverridesRef = useRef(rowOverrides);
  rowOverridesRef.current = rowOverrides;

  // Get current bonus period for task counting
  // Get current payroll period (26th-25th cycle) - centralized utility
  // If today is Sept 26th or later, this returns October
  const { year: periodYear, month: periodMonth } = getCurrentPayrollPeriod();
  const periodKey = `${periodYear}-${periodMonth}`;

  // Override só vale para o período que o gravou. De outro período = inexistente.
  const taskOverride =
    storedOverride && storedOverride.period === periodKey ? storedOverride.value : null;
  const setTaskOverride = (value: number | null) =>
    setStoredOverride(value === null ? null : { period: periodKey, value });
  const taskQuantity = taskOverride ?? originalTaskQuantity;

  // Fetch sectors for filtering (Sector model has no status field)
  const { data: sectorsData } = useSectors({
    orderBy: { name: "asc" },
    limit: 100
  });

  // Cargos bonificáveis do banco — nomes para o seletor e o id para o cálculo.
  const { data: positionsData } = usePositions({
    where: { bonifiable: true },
    orderBy: { hierarchy: "asc" },
    limit: 100,
  });
  const positionOptions = useMemo<string[]>(() => {
    const names = (positionsData?.data ?? [])
      .map((p: any) => p?.name)
      .filter((n: unknown): n is string => typeof n === 'string' && n.length > 0);
    return names.length > 0 ? names : POSITIONS;
  }, [positionsData]);
  // Nome → id, para mandar `positionId` e não depender de casar string.
  const positionIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of positionsData?.data ?? []) {
      if (p?.name && p?.id) map.set(String(p.name).toLowerCase().trim(), String(p.id));
    }
    return map;
  }, [positionsData]);

  // Fetch weighted task count from the lightweight period stats endpoint
  // This returns only task counts without Secullum integration (fast)
  useEffect(() => {
    const fetchWeightedTaskCount = async () => {
      try {
        const response = await bonusService.getPeriodTaskStats(periodYear, periodMonth);
        const liveData = (response.data as any)?.data ?? response.data;

        // Use totalWeightedTasks from the live calculation (excludes suspended bonifications)
        const weightedTaskCount = typeof liveData.totalWeightedTasks === 'number'
          ? liveData.totalWeightedTasks
          : Number(liveData.totalWeightedTasks) || 0;

        const rawCount = typeof liveData.totalRawTaskCount === 'number'
          ? liveData.totalRawTaskCount
          : Number(liveData.totalRawTaskCount) || 0;

        const suspendedCount = typeof liveData.totalSuspendedTasks === 'number'
          ? liveData.totalSuspendedTasks
          : Number(liveData.totalSuspendedTasks) || 0;

        const eligibleUsers = typeof liveData.eligibleUsers === 'number'
          ? liveData.eligibleUsers
          : Number(liveData.eligibleUsers) || 0;

        const averageTasksPerEmployee = typeof liveData.averageTasksPerEmployee === 'number'
          ? liveData.averageTasksPerEmployee
          : Number(liveData.averageTasksPerEmployee) || 0;

        // Store task info for the period info display
        setLiveTaskInfo({ rawCount, weightedCount: weightedTaskCount, suspendedCount, eligibleUsers, averageTasksPerEmployee });

        // Cadastro de elegibilidade — quem está no período e com que peso.
        const rows: EligibilityRow[] = Array.isArray(liveData.eligibility) ? liveData.eligibility : [];
        setEligibility(new Map(rows.map(r => [r.userId, { ...r, weight: Number(r.weight) || 0 }])));

        // O número do período é a BASE, sempre. `taskQuantity` deriva dele
        // enquanto `taskOverride` for null — não há mais seed condicional, que
        // era exatamente o ponto onde um valor velho de localStorage se
        // eternizava (o seed só rodava se o guardado fosse 0).
        setOriginalTaskQuantity(weightedTaskCount);
      } catch (err) {
        console.error('[BonusSimulation] Failed to fetch weighted task count:', err);
      }
    };

    fetchWeightedTaskCount();
  }, [periodYear, periodMonth]);

  /**
   * Ids exatamente do cadastro de elegibilidade do período.
   *
   * Antes o recorte era `CLT + ACTIVE + tem secullumEmployeeId`, três
   * aproximações que a folha não usa:
   *   • `ACTIVE` derrubava quem foi desligado no meio do período — que RECEBE
   *     proporcional, e é o número que o RH precisa para a rescisão;
   *   • `secullumEmployeeId != null` derrubava os mesmos desligados de novo (a
   *     demissão desvincula a pessoa do Secullum);
   *   • nada disso enxergava o afastamento médico, que zera o peso e tira a
   *     pessoa da folha — o caso que trouxe este bug à tona.
   */
  const eligibleUserIds = useMemo(() => (eligibility ? [...eligibility.keys()] : []), [eligibility]);

  const { data: usersData } = useUsers({
    where: { id: { in: eligibleUserIds } },
    include: {
      position: true,
      sector: true
    },
    orderBy: { name: "asc" },
    limit: 100
  });

  // Initialize simulated users from fetched data
  useEffect(() => {
    if (!eligibility) return; // sem o cadastro do período não há lista honesta a montar
    if (usersData?.data) {
      if (usersData.data.length > 0) {
        const users = usersData.data.map(user => {
          const initialPosition = user.position?.name || "Pleno I";
          const initialPerformanceLevel = user.performanceLevel ?? 0;
          const elig = eligibility.get(user.id);

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            payrollNumber: user.payrollNumber || null,
            originalPosition: initialPosition,
            originalPerformanceLevel: initialPerformanceLevel,
            sectorId: user.sector?.id || null,
            sectorName: user.sector?.name || null,
            position: initialPosition,
            performanceLevel: initialPerformanceLevel,
            // Populated by the simulation sync effect once /bonus/simulate
            // returns. Starts at 0 to avoid a flash of stale legacy values.
            bonusAmount: 0,
            eligibilityWeight: elig?.weight ?? 1,
            eligibilityReason: elig ? describeWeight(elig) : '',
          };
        }) as SimulatedUser[];

        // Re-apply persisted per-row edits (Cargo / Performance).
        const overrides = rowOverridesRef.current;
        const withOverrides = users.map(u => {
          const o = overrides[u.id];
          if (!o) return u;
          return {
            ...u,
            ...(o.position !== undefined ? { position: o.position } : {}),
            ...(o.performanceLevel !== undefined ? { performanceLevel: o.performanceLevel } : {}),
          };
        });
        setSimulatedUsers(withOverrides);
      }
      setIsLoading(false);
    }
  }, [usersData, eligibility]); // Only reinitialize when usersData changes, not when taskQuantity changes

  // Apply filters to get visible users
  const filteredUsers = useMemo(() => {
    let filtered = simulatedUsers;

    // Apply eligibility filter
    // A user is eligible if:
    // 1. They have a bonifiable position
    // 2. They are EFFECTED status (already filtered in the query)
    // 3. They have a performance level > 0
    if (filters.showOnlyEligible) {
      filtered = filtered.filter(user => {
        // Find the original user data to check position bonifiable flag
        const originalUser = usersData?.data?.find(u => u.id === user.id);
        const isBonifiable = originalUser?.position?.bonifiable === true;
        const hasPerformanceLevel = user.performanceLevel > 0;

        return isBonifiable && hasPerformanceLevel;
      });
    }

    // Apply sector filter (only if sectors are explicitly selected)
    if (filters.sectorIds.length > 0) {
      filtered = filtered.filter(user =>
        user.sectorId && filters.sectorIds.includes(user.sectorId)
      );
    }

    // Apply position filter (only if positions are explicitly selected)
    if (filters.positionIds.length > 0) {
      filtered = filtered.filter(user => {
        // Find the user's position ID from the original data
        const originalUser = usersData?.data?.find(u => u.id === user.id);
        return originalUser?.positionId && filters.positionIds.includes(originalUser.positionId);
      });
    }

    // Apply include users filter (if specified, only show these users)
    if (filters.includeUserIds.length > 0) {
      filtered = filtered.filter(user =>
        filters.includeUserIds.includes(user.id)
      );
    }

    // Apply exclusion filter
    if (filters.excludeUserIds.length > 0) {
      filtered = filtered.filter(user =>
        !filters.excludeUserIds.includes(user.id)
      );
    }

    return filtered;
  }, [simulatedUsers, filters, usersData]);

  // Calculate metrics
  const hasManualFilters =
    filters.sectorIds.length > 0 ||
    filters.positionIds.length > 0 ||
    filters.includeUserIds.length > 0 ||
    filters.excludeUserIds.length > 0;

  /**
   * Divisor de B1 = o divisor DO PERÍODO, sempre. Nunca a lista visível.
   *
   * Todo filtro desta tela — setor, cargo, incluir, excluir — é recorte de
   * VISTA. Nenhum deles muda quantas pessoas o período teve, então nenhum deles
   * pode mexer em B1: o divisor é propriedade do período, e olhar um setor não o
   * altera. Antes, qualquer filtro manual jogava o divisor para
   * `filteredUsers.length` e o bônus de TODO MUNDO na tela mudava junto —
   * escolher "Produção 1" recalculava B1 sobre 8 pessoas em vez de 12,5002.
   *
   * A tentativa intermediária de tratar incluir/excluir como "e se de população"
   * era pior que o bug original em dois pontos: somava pesos sobre
   * `filteredUsers`, que JÁ vinha filtrado por setor/cargo (bastava um exclude
   * junto de um filtro de setor para o divisor desabar), e `includeUserIds` é
   * whitelist — incluir uma pessoa de peso 0,05 dava divisor 0,05 e B1 = 860.
   *
   * Quem quiser simular outra população muda o campo "Média" direto: ele
   * resolve `tarefas = média × divisor` e é o botão honesto para isso.
   */
  const eligibleUserCount = liveTaskInfo?.eligibleUsers ?? 0;

  // Average is calculated using eligible users (not included users)
  // This matches how the backend calculates: total tasks / total eligible users
  const averageTasksPerUser = useMemo(() => {
    if (eligibleUserCount === 0) return 0;
    return taskQuantity / eligibleUserCount;
  }, [taskQuantity, eligibleUserCount]);

  // ============================================================
  // Bonus calculation — runs server-side via /bonus/simulate.
  // The web frontend never recomputes the formula locally.
  // ============================================================
  const simulationInput = useMemo(
    () =>
      simulatedUsers.length === 0
        ? null
        : {
            averageTasksPerUser,
            users: simulatedUsers.map(u => ({
              id: u.id,
              name: u.name,
              // `positionId` primeiro: o servidor resolve salário por id e só cai
              // no nome quando o id falta. Mandar só o nome deixava a conta
              // refém de casar string com o cadastro.
              positionId: positionIdByName.get(u.position.toLowerCase().trim()),
              positionName: u.position,
              sectorName: u.sectorName ?? undefined,
              performanceLevel: u.performanceLevel,
            })),
            // Send the period so the API injects the saved reajuste — the
            // simulation then matches the real (saved) bonus to the cent.
            year: periodYear,
            month: periodMonth,
          },
    [simulatedUsers, averageTasksPerUser, periodYear, periodMonth, positionIdByName],
  );
  const { data: simulation } = useBonusSimulation(simulationInput, {
    enabled: simulationInput !== null,
  });
  const bonusByUserId = useMemo(() => {
    const map = new Map<string, number>();
    if (simulation?.users) {
      for (const u of simulation.users) {
        if (u.id) map.set(u.id, u.bonus);
      }
    }
    return map;
  }, [simulation]);
  // Sync simulation results back into the simulatedUsers state's `bonusAmount`
  // field so the existing render/sort/export code keeps working unchanged.
  useEffect(() => {
    if (!simulation?.users) return;
    setSimulatedUsers(prev => {
      const next = prev.map(u => {
        // `/bonus/simulate` calcula o valor de PERÍODO INTEIRO — ele só recebe
        // cargo e nível, e não tem como saber que a pessoa entrou no dia 14 ou
        // saiu no dia 17. O prorrateio é o mesmo `weight` que entra no divisor:
        // quem contou 0,73 no denominador recebe 73% do valor.
        const fullPeriodBonus = bonusByUserId.get(u.id) ?? 0;
        const newBonus = Math.round(fullPeriodBonus * u.eligibilityWeight * 100) / 100;
        return Math.abs(u.bonusAmount - newBonus) < 0.005 ? u : { ...u, bonusAmount: newBonus };
      });
      // Reference equality short-circuit if nothing changed.
      const changed = next.some((u, i) => u !== prev[i]);
      return changed ? next : prev;
    });
  }, [simulation, bonusByUserId]);

  const totalBonusAmount = useMemo(() =>
    filteredUsers.reduce((sum, user) => sum + user.bonusAmount, 0),
    [filteredUsers]
  );

  // Effect 0: mantém o texto do campo "Tarefas" colado em `taskQuantity`.
  // Mesmo padrão do campo "Média" logo abaixo: só reescreve quando o texto atual
  // não representa mais o valor, para não atrapalhar quem está digitando.
  useEffect(() => {
    // Campo vazio (ou só a vírgula) é estado LEGÍTIMO de digitação: reescrever
    // "0,0" por cima no instante em que o operador apaga tudo devolvia o cursor
    // depois do zero e transformava o "43" seguinte em "0,043".
    if (taskInput === '' || taskInput === ',') return;
    const currentParsed = parseFloat(taskInput.replace(',', '.'));
    if (isNaN(currentParsed) || Math.abs(currentParsed - taskQuantity) > 0.05) {
      setTaskInput(formatTaskInput(taskQuantity));
    }
    // `taskInput` fica de fora das deps de propósito: ele é a SAÍDA deste efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskQuantity]);

  // Effect 1: Update average input when task quantity or eligible count changes
  // Don't overwrite if user is typing (check if current value matches calculated)
  useEffect(() => {
    if (eligibleUserCount === 0) {
      if (averageInput !== '0,00') {
        setAverageInput('0,00');
      }
      return;
    }

    const newAverage = taskQuantity / eligibleUserCount;

    // Only update if the current input value doesn't match (to avoid overwriting while typing)
    const currentParsed = parseFloat(averageInput.replace(',', '.'));
    const difference = Math.abs(currentParsed - newAverage);

    // If difference is significant (more than 0.001), update the display
    if (isNaN(currentParsed) || difference > 0.001) {
      setAverageInput(newAverage.toFixed(2).replace('.', ','));
    }
  }, [taskQuantity, eligibleUserCount, averageInput]);

  // Effect 2: Zero out bonuses for users excluded by filters.
  // Inclusion-based bonus values are populated by the /bonus/simulate sync effect.
  useEffect(() => {
    if (filteredUsers.length === 0) return;
    const filteredIds = new Set(filteredUsers.map(u => u.id));
    setSimulatedUsers(prev => {
      let changed = false;
      const next = prev.map(user => {
        if (!filteredIds.has(user.id) && user.bonusAmount !== 0) {
          changed = true;
          return { ...user, bonusAmount: 0 };
        }
        return user;
      });
      return changed ? next : prev;
    });
  }, [filteredUsers]);

  // Handlers
  const handleTaskQuantityChange = (e: React.ChangeEvent<HTMLInputElement> | string) => {
    // Handle both event object and direct value
    let value = typeof e === 'string' ? e : e?.target?.value;

    if (value === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Handler] No value received:', e);
      }
      return;
    }

    // Replace period with comma for Brazilian format
    value = value.replace('.', ',');

    // Allow empty string, numbers, and decimal commas while typing
    if (value === '' || value === ',' || /^\d*,?\d*$/.test(value)) {
      setTaskInput(value); // Update input string immediately for smooth typing

      // Only update taskQuantity if it's a valid number (not just a comma or empty)
      if (value !== '' && value !== ',') {
        const num = parseFloat(value.replace(',', '.'));
        if (!isNaN(num) && num >= 0) {
          setTaskOverride(num);
        }
      }
      // Campo vazio NÃO vira `setTaskOverride(0)`: isso PERSISTIA um override de
      // zero, e quem apagasse o campo e saísse da tela voltava com todos os
      // bônus zerados — a mesma armadilha de valor velho que esta refatoração
      // existe para matar. Vazio só limpa o texto; o valor segue o que estava.
    }
  };

  const handleAveragePerUserChange = (e: React.ChangeEvent<HTMLInputElement> | string) => {
    // Handle both event object and direct value
    let value = typeof e === 'string' ? e : e?.target?.value;

    if (value === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Handler] No value received:', e);
      }
      return;
    }

    // Replace period with comma for Brazilian format
    value = value.replace('.', ',');

    // Allow empty string, numbers, and decimal commas while typing
    if (value === '' || value === ',' || /^\d*,?\d*$/.test(value)) {
      setAverageInput(value); // Update input string immediately for smooth typing

      // Only update taskQuantity if it's a valid number and we have eligible users
      if (value !== '' && value !== ',' && eligibleUserCount > 0) {
        const num = parseFloat(value.replace(',', '.'));
        if (!isNaN(num) && num >= 0) {
          // Update task quantity based on average (reverse calculation)
          // Formula: taskQuantity = average × eligible_users
          const newTaskQuantity = num * eligibleUserCount;
          setTaskOverride(newTaskQuantity);
          setTaskInput(formatTaskInput(newTaskQuantity)); // Format with 1 decimal, Brazilian format
        }
      }
      // Vazio não zera o override — mesma decisão do campo "Tarefas" acima.
    }
  };

  const handleFiltersApply = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleFiltersReset = () => {
    setFilters({
      sectorIds: [],
      positionIds: [],
      includeUserIds: [],
      excludeUserIds: [],
      showOnlyEligible: true
    });
  };

  // Position / performance changes only update the input fields. The bonus
  // value is recomputed by the /bonus/simulate hook + sync effect above.
  const handlePositionChange = useCallback(
    (userId: string, newPosition: string) => {
      setSimulatedUsers(prev =>
        prev.map(user => (user.id === userId ? { ...user, position: newPosition } : user)),
      );
      setRowOverrides(prev => ({ ...prev, [userId]: { ...prev[userId], position: newPosition } }));
    },
    [setRowOverrides],
  );

  const handlePerformanceLevelChange = useCallback(
    (userId: string, newLevel: number) => {
      setSimulatedUsers(prev =>
        prev.map(user => (user.id === userId ? { ...user, performanceLevel: newLevel } : user)),
      );
      setRowOverrides(prev => ({ ...prev, [userId]: { ...prev[userId], performanceLevel: newLevel } }));
    },
    [setRowOverrides],
  );

  const columns = useMemo(
    () => createBonusSimulationColumns({ positionOptions, onPositionChange: handlePositionChange, onPerformanceLevelChange: handlePerformanceLevelChange }),
    [positionOptions, handlePositionChange, handlePerformanceLevelChange],
  );

  const hasActiveFilters =
    hasManualFilters ||
    (!filters.showOnlyEligible && !hasManualFilters); // Only count eligibility as active if explicitly disabled

  const clearAllFilters = () => {
    setFilters({
      sectorIds: [],
      positionIds: [],
      includeUserIds: [],
      excludeUserIds: [],
      showOnlyEligible: true
    });
  };

  // Create filter badges for display (like items table)
  // Each sector, position, and user gets its own individual badge
  const activeFilters = useMemo(() => {
    const filterBadges: Array<{
      key: string;
      label: string;
      value: string;
      onRemove: () => void;
      icon?: React.ReactNode;
    }> = [];

    // Add individual sector filter badges
    filters.sectorIds.forEach(sectorId => {
      const sector = sectorsData?.data?.find(s => s.id === sectorId);
      if (sector) {
        filterBadges.push({
          key: `sector-${sectorId}`,
          label: "Setor",
          value: sector.name,
          onRemove: () => setFilters(prev => ({
            ...prev,
            sectorIds: prev.sectorIds.filter(id => id !== sectorId)
          })),
          icon: <IconBuilding className="h-3 w-3" />
        });
      }
    });

    // Add individual position filter badges
    filters.positionIds.forEach(positionId => {
      const position = usersData?.data?.find(u => u.positionId === positionId)?.position;
      if (position) {
        filterBadges.push({
          key: `position-${positionId}`,
          label: "Cargo",
          value: position.name,
          onRemove: () => setFilters(prev => ({
            ...prev,
            positionIds: prev.positionIds.filter(id => id !== positionId)
          })),
          icon: <IconBriefcase className="h-3 w-3" />
        });
      }
    });

    // Add individual included user filter badges
    filters.includeUserIds.forEach(userId => {
      const user = simulatedUsers.find(u => u.id === userId);
      if (user) {
        filterBadges.push({
          key: `include-${userId}`,
          label: "Incluir Usuário",
          value: user.name,
          onRemove: () => setFilters(prev => ({
            ...prev,
            includeUserIds: prev.includeUserIds.filter(id => id !== userId)
          })),
          icon: <IconUserCheck className="h-3 w-3" />
        });
      }
    });

    // Add individual excluded user filter badges
    filters.excludeUserIds.forEach(userId => {
      const user = simulatedUsers.find(u => u.id === userId);
      if (user) {
        filterBadges.push({
          key: `exclude-${userId}`,
          label: "Excluir Usuário",
          value: user.name,
          onRemove: () => setFilters(prev => ({
            ...prev,
            excludeUserIds: prev.excludeUserIds.filter(id => id !== userId)
          })),
          icon: <IconUserMinus className="h-3 w-3" />
        });
      }
    });

    // Add "Mostrar todos" badge if showOnlyEligible is false AND no manual filters are applied
    // Don't show this badge if eligibility was automatically disabled by applying other filters
    if (!filters.showOnlyEligible && !hasManualFilters) {
      filterBadges.push({
        key: 'show-all',
        label: "Exibir",
        value: "Todos os usuários",
        onRemove: () => setFilters(prev => ({ ...prev, showOnlyEligible: true })),
        icon: <IconUsers className="h-3 w-3" />
      });
    }

    return filterBadges;
  }, [filters, sectorsData?.data, simulatedUsers, usersData]);

  const restoreCurrentPeriodTasks = () => {
    // `null` = volta a SEGUIR o período. Gravar o número de agora congelaria a
    // simulação de novo na primeira tarefa concluída depois do clique.
    setTaskOverride(null);
    setTaskInput(formatTaskInput(originalTaskQuantity));
    setAverageInput(
      eligibleUserCount > 0
        ? (originalTaskQuantity / eligibleUserCount).toFixed(2).replace('.', ',')
        : '0,00',
    );
  };

  // Ter override é o que importa, não o valor coincidir. Digitar exatamente as
  // 43,0 de agora fixava o número e escondia o botão "Restaurar" — e na tarefa
  // seguinte a simulação ficava congelada em 43 sem nada na tela dizendo isso.
  const isTaskQuantityModified = taskOverride !== null;

  // Linhas com cargo ou desempenho diferentes do cadastro — o mesmo critério
  // que pinta o valor de laranja na tabela, para o botão e a tela contarem a
  // mesma história.
  const modifiedRowCount = useMemo(
    () =>
      simulatedUsers.filter(
        u => u.position !== u.originalPosition || u.performanceLevel !== u.originalPerformanceLevel,
      ).length,
    [simulatedUsers],
  );

  const hasSimulationChanges = isTaskQuantityModified || modifiedRowCount > 0;

  /**
   * Desfaz TUDO que foi mexido para testar: a base de tarefas volta a seguir o
   * período e cada linha volta ao cargo e ao nível do cadastro. Os overrides
   * são persistidos, então limpar o estado sem limpar `rowOverrides` traria as
   * edições de volta no próximo carregamento da lista.
   */
  const resetSimulation = () => {
    restoreCurrentPeriodTasks();
    setRowOverrides({});
    setSimulatedUsers(prev =>
      prev.map(u =>
        u.position === u.originalPosition && u.performanceLevel === u.originalPerformanceLevel
          ? u
          : { ...u, position: u.originalPosition, performanceLevel: u.originalPerformanceLevel },
      ),
    );
    toast.success("Simulação restaurada aos valores originais");
  };

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      {/* Header: base do cálculo + total. Mesmo desenho da Simulação de
          Promoções — campos de igual largura à esquerda, ação à direita, e
          busca/colunas/exportação dentro da barra da tabela. */}
      <div className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          {/* Left side - base do cálculo + total */}
          <div className="flex flex-row flex-wrap gap-4">
            <div className="flex flex-col" style={{ width: "7rem" }}>
              <Label htmlFor="taskQuantity" className="text-sm font-medium mb-1.5">
                Tarefas
              </Label>
              <Input
                id="taskQuantity"
                type="text"
                inputMode="decimal"
                value={taskInput}
                onChange={(value) => handleTaskQuantityChange(String(value))}
                className="h-10 text-center font-semibold bg-transparent"
                placeholder="0,0"
              />
            </div>

            <div className="flex flex-col" style={{ width: "7rem" }}>
              <Label className="text-sm font-medium mb-1.5">Elegíveis</Label>
              <Input
                type="text"
                value={eligibleUserCount > 0 ? formatDivisor(eligibleUserCount) : "—"}
                readOnly
                className="h-10 text-center font-semibold bg-transparent cursor-default"
                title={`Divisor do período: ${formatDivisor(eligibleUserCount)}. É a soma dos PESOS de elegibilidade — quem entrou, saiu ou esteve afastado no meio do período conta só a fração de dias úteis que trabalhou, por isso o número é quebrado.`}
              />
            </div>

            <div className="flex flex-col" style={{ width: "7rem" }}>
              <Label htmlFor="averagePerUser" className="text-sm font-medium mb-1.5">
                Média
              </Label>
              <Input
                id="averagePerUser"
                type="text"
                inputMode="decimal"
                value={averageInput}
                onChange={(value) => handleAveragePerUserChange(String(value))}
                className="h-10 text-center font-semibold bg-transparent"
                placeholder="0,00"
                title="Digite a média desejada por colaborador elegível para calcular as tarefas totais"
              />
            </div>

            <div className="flex flex-col" style={{ width: "9rem" }}>
              <Label className="text-sm font-medium mb-1.5">Bônus Total</Label>
              <Input
                type="text"
                value={formatCurrency(totalBonusAmount)}
                readOnly
                className="h-10 text-center font-semibold bg-transparent cursor-default text-green-600"
              />
            </div>
          </div>

          {/* Right side - Restaurar (Filtros + colunas + exportação vivem na barra da tabela) */}
          {hasSimulationChanges && (
            <div className="flex flex-col">
              <Label className="text-sm font-medium mb-1.5 opacity-0">Ações</Label>
              <div className="flex gap-2 h-10">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={resetSimulation}
                  className="h-10 gap-2 border-orange-500/50 text-orange-600 hover:text-orange-600"
                  title={
                    modifiedRowCount > 0
                      ? `Restaurar a simulação: tarefas do período e ${modifiedRowCount} ${modifiedRowCount === 1 ? 'linha alterada' : 'linhas alteradas'}`
                      : "Restaurar quantidade de tarefas do período atual"
                  }
                >
                  <IconRestore className="h-4 w-4" />
                  Restaurar
                  {modifiedRowCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-orange-500/15 text-orange-600">
                      {modifiedRowCount}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && (
          <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />
        )}
      </div>

      {/* Interactive table (busca / ordenação / layout de colunas / exportação vêm do DataTable) */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
        <DataTable<SimulatedUser>
          tableId="bonus-simulation"
          bare
          data={filteredUsers}
          columns={columns}
          getRowId={(u) => u.id}
          isLoading={isLoading}
          enableSelection={false}
          enablePagination={false}
          defaultSorting={[{ id: "name", desc: false }]}
          estimateRowHeight={52}
          searchPlaceholder="Buscar colaborador..."
          emptyMessage="Nenhum colaborador elegível encontrado. Ajuste os filtros para ver os colaboradores."
          exportTitle="Simulação de Bônus"
          exportFilename="simulacao-bonus"
          toolbarActions={
            <Button variant={hasActiveFilters ? "default" : "outline"} onClick={() => setShowFiltersModal(true)} className="gap-2">
              <IconFilter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-0 px-1.5">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          }
        />
      </div>

      {/* Filters Modal */}
      <BonusSimulationFilters
        open={showFiltersModal}
        onOpenChange={setShowFiltersModal}
        filters={filters}
        onApply={handleFiltersApply}
        onReset={handleFiltersReset}
        sectors={sectorsData?.data || []}
      />
    </Card>
  );
}
