import { useMemo, useState } from "react";
import {
  IconCheck,
  IconRefresh,
  IconBuildingStore,
  IconBriefcase,
  IconUsers,
  IconPlus,
  IconX,
  IconSearch,
  IconUserCheck,
  IconUserOff,
  IconLink,
  IconActivity,
  IconChevronRight,
  type TablerIcon,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { usePrivileges } from "@/hooks/common/use-privileges";
import { DiagnosticoCard } from "@/components/integrations/secullum/diagnostics/diagnostico-card";
import { routes, SECTOR_PRIVILEGES } from "@/constants";
import { cn } from "@/lib/utils";

import {
  useSecullumDepartamentos,
  useSecullumFuncoes,
  useUpsertSecullumDepartamento,
  useUpsertSecullumFuncao,
  useSecullumFuncionariosLite,
  useSecullumFuncionariosDemitidos,
  useSecullumHorarios,
  useLinkSectorDepartamento,
  useSetSectorHorario,
  useLinkPositionFuncao,
  useLinkUserFuncionario,
} from "@/hooks/integrations/use-secullum-mapping";
import { useSectors } from "@/hooks/administration/use-sector";
import { usePositions } from "@/hooks/human-resources/use-position";
import { useUsers } from "@/hooks/human-resources/use-user";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

// Some hooks return the raw array, others return an axios-wrapped
// `{ data: [...] }` envelope depending on how the endpoint is shaped on the
// server. Normalise to an array so consumers can `.filter` / `.map` safely.
const toArray = <T,>(v: unknown): T[] => {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object" && Array.isArray((v as any).data)) return (v as any).data as T[];
  return [];
};

// ============================================================================
// Page shell
// ============================================================================

export default function SecullumMappingPage() {
  usePageTracker({
    title: "Integração Secullum",
    icon: "users",
  });

  const { isAdmin } = usePrivileges();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Integração Secullum"
          icon={IconUsers}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Departamento Pessoal", href: routes.administration.collaborators.root },
            { label: "Integração Secullum" },
          ]}
          className="flex-shrink-0"
        />
        <Tabs defaultValue="departamentos" className="flex flex-1 min-h-0 flex-col gap-3">
          <TabsList className="flex-shrink-0 self-start">
            <TabsTrigger value="departamentos" className="gap-2">
              <IconBuildingStore className="h-4 w-4" /> Departamentos ↔ Setores
            </TabsTrigger>
            <TabsTrigger value="funcoes" className="gap-2">
              <IconBriefcase className="h-4 w-4" /> Funções ↔ Cargos
            </TabsTrigger>
            <TabsTrigger value="funcionarios" className="gap-2">
              <IconUsers className="h-4 w-4" /> Funcionários ↔ Usuários
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="diagnostico" className="gap-2">
                <IconActivity className="h-4 w-4" /> Diagnóstico
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent
            value="departamentos"
            className="flex-1 min-h-0 overflow-y-auto pb-6 mt-0"
          >
            <DepartamentoMappingCard />
          </TabsContent>
          <TabsContent
            value="funcoes"
            className="flex-1 min-h-0 overflow-y-auto pb-6 mt-0"
          >
            <FuncaoMappingCard />
          </TabsContent>
          <TabsContent
            value="funcionarios"
            className="flex-1 min-h-0 overflow-y-auto pb-6 mt-0"
          >
            <FuncionariosCard />
          </TabsContent>
          {isAdmin && (
            <TabsContent
              value="diagnostico"
              className="flex-1 min-h-0 overflow-y-auto pb-6 mt-0"
            >
              <DiagnosticoCard />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PrivilegeRoute>
  );
}

// ============================================================================
// Shared dense building blocks
// ============================================================================

function MappingToolbar({
  icon: Icon,
  title,
  stats,
  onRefresh,
  isRefreshing,
}: {
  icon: TablerIcon;
  title: string;
  stats: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-0.5">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h2 className="shrink-0 text-sm font-semibold">{title}</h2>
        <span className="truncate text-xs text-muted-foreground">{stats}</span>
      </div>
      {onRefresh && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-8 shrink-0 gap-1.5"
        >
          <IconRefresh className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          Atualizar
        </Button>
      )}
    </div>
  );
}

// One-line collapsed status indicator (dot + count, or muted "empty" label).
function LinkCountTag({ count, emptyLabel }: { count: number; emptyLabel: string }) {
  if (count > 0) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-500">
        <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
        {count} vinculado(s)
      </span>
    );
  }
  return <span className="shrink-0 text-xs text-muted-foreground">{emptyLabel}</span>;
}

function UnmappedSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="px-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">{children}</ul>
      </Card>
    </div>
  );
}

function UnmappedRow({
  label,
  disabled,
  onCreate,
}: {
  label: string;
  disabled: boolean;
  onCreate: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
      <span className="min-w-0 truncate font-medium">{label}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={onCreate}
        className="h-7 shrink-0 gap-1 px-2 text-xs"
      >
        <IconPlus className="h-3.5 w-3.5" /> Criar no Secullum
      </Button>
    </li>
  );
}

// ============================================================================
// Departamentos ↔ Setores  (N:1 — many sectors → one departamento)
// ============================================================================

type SectorRow = {
  id: string;
  name: string;
  secullumDepartamentoId?: number | null;
  secullumHorarioId?: number | null;
};

function DepartamentoMappingCard() {
  const departamentosQ = useSecullumDepartamentos();
  const horariosQ = useSecullumHorarios();
  const sectorsQ = useSectors({ orderBy: { name: "asc" }, take: 100 } as any);
  const upsert = useUpsertSecullumDepartamento();
  const linkSector = useLinkSectorDepartamento();
  const setSectorHorario = useSetSectorHorario();

  const sectors = toArray<SectorRow>((sectorsQ.data as any)?.data ?? sectorsQ.data);
  const departamentos = toArray<{ Id: number; Descricao: string; Nfolha?: string | null }>(
    departamentosQ.data,
  );
  const horarios = toArray<{ Id: number; Numero: number; Descricao: string; Desativar?: boolean }>(
    horariosQ.data,
  );

  const groups = useMemo(() => {
    const linkedBy = new Map<number, SectorRow[]>();
    for (const s of sectors) {
      if (s.secullumDepartamentoId == null) continue;
      const arr = linkedBy.get(s.secullumDepartamentoId) ?? [];
      arr.push(s);
      linkedBy.set(s.secullumDepartamentoId, arr);
    }
    return departamentos.map((d) => ({
      departamento: d,
      linked: (linkedBy.get(d.Id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [departamentos, sectors]);

  const unmappedSectors = useMemo(
    () =>
      sectors
        .filter((s) => s.secullumDepartamentoId == null)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [sectors],
  );

  const isLoading = departamentosQ.isLoading || sectorsQ.isLoading;
  // Secullum catalog read failure: surface it instead of rendering an empty
  // mapping section that looks like "no departamentos exist".
  const isError = departamentosQ.isError;
  const isFetching = departamentosQ.isFetching || sectorsQ.isFetching;
  const linkedCount = groups.reduce((acc, g) => acc + g.linked.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <MappingToolbar
        icon={IconBuildingStore}
        title="Departamentos do Secullum"
        stats={
          isLoading
            ? "Carregando…"
            : `${departamentos.length} departamento(s) · ${linkedCount} setor(es) vinculado(s)`
        }
        onRefresh={() => {
          departamentosQ.refetch();
          sectorsQ.refetch();
        }}
        isRefreshing={isFetching}
      />

      {isLoading ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="px-3 py-2.5">
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        </Card>
      ) : isError ? (
        <ErrorState
          title="Erro ao carregar departamentos do Secullum"
          description="Não foi possível ler o catálogo de departamentos do ponto (Secullum). Verifique a integração e tente novamente."
          onRetry={() => departamentosQ.refetch()}
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            {groups.length === 0 ? (
              <EmptyState
                icon={<IconBuildingStore className="h-9 w-9" />}
                title="Nenhum departamento no Secullum"
                description="Crie departamentos no Secullum ou use o painel abaixo para criá-los a partir dos setores Ankaa."
                className="py-8"
              />
            ) : (
              <div className="divide-y divide-border">
                {groups.map((g) => (
                  <DepartamentoRow
                    key={g.departamento.Id}
                    departamento={g.departamento}
                    linkedSectors={g.linked}
                    availableSectors={unmappedSectors}
                    horarios={horarios}
                    isPendingLink={linkSector.isPending}
                    isPendingHorario={setSectorHorario.isPending}
                    onLink={(sectorId) =>
                      // Success/error toasts emitted by the axios interceptor (POST mapping endpoint).
                      linkSector.mutate({ sectorId, departamentoId: g.departamento.Id })
                    }
                    onUnlink={(sectorId) =>
                      // Success/error toasts emitted by the axios interceptor (POST mapping endpoint).
                      linkSector.mutate({ sectorId, departamentoId: null })
                    }
                    onSetHorario={(sectorId, horarioId) =>
                      // Success/error toasts emitted by the axios interceptor (POST mapping endpoint).
                      setSectorHorario.mutate({ sectorId, horarioId })
                    }
                  />
                ))}
              </div>
            )}
          </Card>

          {unmappedSectors.length > 0 && (
            <UnmappedSection
              title={`Setores Ankaa sem departamento (${unmappedSectors.length})`}
              description="Crie um departamento equivalente no Secullum, ou vincule a um existente acima."
            >
              {unmappedSectors.map((s) => (
                <UnmappedRow
                  key={s.id}
                  label={s.name}
                  disabled={upsert.isPending}
                  onCreate={async () => {
                    try {
                      await upsert.mutateAsync({ Descricao: s.name });
                      // Success/error toasts emitted by the axios interceptor (POST /integrations/secullum/departamentos).
                    } catch {
                      // Error toast emitted by the axios error interceptor.
                    }
                  }}
                />
              ))}
            </UnmappedSection>
          )}
        </>
      )}
    </div>
  );
}

function DepartamentoRow({
  departamento,
  linkedSectors,
  availableSectors,
  horarios,
  isPendingLink,
  isPendingHorario,
  onLink,
  onUnlink,
  onSetHorario,
}: {
  departamento: { Id: number; Descricao: string; Nfolha?: string | null };
  linkedSectors: SectorRow[];
  availableSectors: SectorRow[];
  horarios: Array<{ Id: number; Numero: number; Descricao: string; Desativar?: boolean }>;
  isPendingLink: boolean;
  isPendingHorario: boolean;
  onLink: (sectorId: string) => void;
  onUnlink: (sectorId: string) => void;
  onSetHorario: (sectorId: string, horarioId: number | null) => void;
}) {
  const candidateName = useMemo(
    () => availableSectors.find((s) => norm(s.name) === norm(departamento.Descricao)),
    [availableSectors, departamento.Descricao],
  );
  const hasSuggestion = !!candidateName && !linkedSectors.some((s) => s.id === candidateName.id);

  // Auto-open rows that have an actionable name suggestion so the operator
  // sees something to do without hunting through collapsed rows.
  const [open, setOpen] = useState(hasSuggestion);

  const sectorOptions = availableSectors.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <IconChevronRight
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <span className="shrink-0 font-mono text-xs text-muted-foreground">#{departamento.Id}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{departamento.Descricao}</span>
        {departamento.Nfolha ? (
          <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
            N. folha {departamento.Nfolha}
          </span>
        ) : null}
        {hasSuggestion && !open && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[0.688rem] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            sugestão
          </span>
        )}
        <LinkCountTag count={linkedSectors.length} emptyLabel="Sem setores" />
      </button>

      {open && (
        <div className="space-y-1 bg-muted/20 pb-2.5 pl-9 pr-3 pt-0.5">
          {linkedSectors.length === 0 && !hasSuggestion && (
            <p className="py-1.5 text-xs text-muted-foreground">Nenhum setor Ankaa vinculado ainda.</p>
          )}

          {linkedSectors.map((s) => {
            const horarioOptions = horarios
              .filter((h) => !h.Desativar)
              .map((h) => {
                // Defensive: Secullum rows may omit Descricao. Combobox requires
                // `label: string`, never undefined.
                const descricao = h.Descricao ?? "(sem descrição)";
                return {
                  value: String(h.Id),
                  label: h.Numero ? `#${h.Numero} — ${descricao}` : descricao,
                };
              });
            return (
              <div
                key={s.id}
                className="grid grid-cols-[1fr_minmax(0,220px)_auto] items-center gap-2"
              >
                <span className="min-w-0 truncate text-sm">{s.name}</span>
                <Combobox
                  mode="single"
                  options={horarioOptions}
                  value={s.secullumHorarioId != null ? String(s.secullumHorarioId) : ""}
                  onValueChange={(v) =>
                    onSetHorario(s.id, typeof v === "string" && v ? Number(v) : null)
                  }
                  placeholder="Horário padrão…"
                  searchPlaceholder="Buscar horário…"
                  emptyText="Nenhum horário"
                  disabled={isPendingHorario}
                  clearable
                  triggerClassName="h-7 text-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  disabled={isPendingLink}
                  onClick={() => onUnlink(s.id)}
                  aria-label={`Desvincular ${s.name}`}
                >
                  <IconX className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}

          {hasSuggestion && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-950/50 dark:bg-amber-950/20">
              <span className="min-w-0 truncate text-sm">
                <span className="text-muted-foreground">Sugestão: </span>
                <span className="font-medium">{candidateName!.name}</span>
              </span>
              <Button
                size="sm"
                variant="default"
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                disabled={isPendingLink}
                onClick={() => onLink(candidateName!.id)}
              >
                <IconLink className="h-3.5 w-3.5" /> Vincular
              </Button>
            </div>
          )}

          {sectorOptions.length > 0 && (
            <Combobox
              mode="single"
              options={sectorOptions}
              value=""
              onValueChange={(v) => {
                if (typeof v === "string" && v) onLink(v);
              }}
              placeholder="+ Vincular outro setor…"
              searchPlaceholder="Buscar setor…"
              emptyText="Nenhum setor disponível"
              disabled={isPendingLink}
              triggerClassName="h-7 justify-start border-dashed text-xs text-muted-foreground"
              clearable={false}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Funções ↔ Cargos  (N:1 — many positions → one função)
// ============================================================================

type PositionRow = {
  id: string;
  name: string;
  secullumFuncaoId?: number | null;
};

function FuncaoMappingCard() {
  const funcoesQ = useSecullumFuncoes();
  const positionsQ = usePositions({ orderBy: { name: "asc" }, take: 100 } as any);
  const upsert = useUpsertSecullumFuncao();
  const linkPosition = useLinkPositionFuncao();

  const positions = toArray<PositionRow>((positionsQ.data as any)?.data ?? positionsQ.data);
  const funcoes = toArray<{ Id: number; Descricao: string }>(funcoesQ.data);

  const groups = useMemo(() => {
    const linkedBy = new Map<number, PositionRow[]>();
    for (const p of positions) {
      if (p.secullumFuncaoId == null) continue;
      const arr = linkedBy.get(p.secullumFuncaoId) ?? [];
      arr.push(p);
      linkedBy.set(p.secullumFuncaoId, arr);
    }
    return funcoes.map((f) => ({
      funcao: f,
      linked: (linkedBy.get(f.Id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [funcoes, positions]);

  const unmappedPositions = useMemo(
    () =>
      positions
        .filter((p) => p.secullumFuncaoId == null)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [positions],
  );

  const isLoading = funcoesQ.isLoading || positionsQ.isLoading;
  // Secullum catalog read failure: surface it instead of an empty mapping.
  const isError = funcoesQ.isError;
  const isFetching = funcoesQ.isFetching || positionsQ.isFetching;
  const linkedCount = groups.reduce((acc, g) => acc + g.linked.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <MappingToolbar
        icon={IconBriefcase}
        title="Funções do Secullum"
        stats={
          isLoading
            ? "Carregando…"
            : `${funcoes.length} função(ões) · ${linkedCount} cargo(s) vinculado(s)`
        }
        onRefresh={() => {
          funcoesQ.refetch();
          positionsQ.refetch();
        }}
        isRefreshing={isFetching}
      />

      {isLoading ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-3 py-2.5">
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        </Card>
      ) : isError ? (
        <ErrorState
          title="Erro ao carregar funções do Secullum"
          description="Não foi possível ler o catálogo de funções do ponto (Secullum). Verifique a integração e tente novamente."
          onRetry={() => funcoesQ.refetch()}
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            {groups.length === 0 ? (
              <EmptyState
                icon={<IconBriefcase className="h-9 w-9" />}
                title="Nenhuma função no Secullum"
                description="Crie funções no Secullum ou use o painel abaixo para criá-las a partir dos cargos Ankaa."
                className="py-8"
              />
            ) : (
              <div className="divide-y divide-border">
                {groups.map((g) => (
                  <FuncaoRow
                    key={g.funcao.Id}
                    funcao={g.funcao}
                    linkedPositions={g.linked}
                    availablePositions={unmappedPositions}
                    isPendingLink={linkPosition.isPending}
                    onLink={(positionId) =>
                      // Success/error toasts emitted by the axios interceptor (POST mapping endpoint).
                      linkPosition.mutate({ positionId, funcaoId: g.funcao.Id })
                    }
                    onUnlink={(positionId) =>
                      // Success/error toasts emitted by the axios interceptor (POST mapping endpoint).
                      linkPosition.mutate({ positionId, funcaoId: null })
                    }
                  />
                ))}
              </div>
            )}
          </Card>

          {unmappedPositions.length > 0 && (
            <UnmappedSection
              title={`Cargos Ankaa sem função (${unmappedPositions.length})`}
              description="Crie uma função equivalente no Secullum, ou vincule a uma existente acima."
            >
              {unmappedPositions.map((p) => (
                <UnmappedRow
                  key={p.id}
                  label={p.name}
                  disabled={upsert.isPending}
                  onCreate={async () => {
                    try {
                      await upsert.mutateAsync({ Descricao: p.name });
                      // Success/error toasts emitted by the axios interceptor (POST /integrations/secullum/funcoes).
                    } catch {
                      // Error toast emitted by the axios error interceptor.
                    }
                  }}
                />
              ))}
            </UnmappedSection>
          )}
        </>
      )}
    </div>
  );
}

function FuncaoRow({
  funcao,
  linkedPositions,
  availablePositions,
  isPendingLink,
  onLink,
  onUnlink,
}: {
  funcao: { Id: number; Descricao: string };
  linkedPositions: PositionRow[];
  availablePositions: PositionRow[];
  isPendingLink: boolean;
  onLink: (positionId: string) => void;
  onUnlink: (positionId: string) => void;
}) {
  const candidate = useMemo(
    () => availablePositions.find((p) => norm(p.name) === norm(funcao.Descricao)),
    [availablePositions, funcao.Descricao],
  );
  const hasSuggestion = !!candidate && !linkedPositions.some((p) => p.id === candidate.id);

  const [open, setOpen] = useState(hasSuggestion);

  const positionOptions = availablePositions.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <IconChevronRight
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <span className="shrink-0 font-mono text-xs text-muted-foreground">#{funcao.Id}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{funcao.Descricao}</span>
        {hasSuggestion && !open && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[0.688rem] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            sugestão
          </span>
        )}
        <LinkCountTag count={linkedPositions.length} emptyLabel="Sem cargos" />
      </button>

      {open && (
        <div className="space-y-1 bg-muted/20 pb-2.5 pl-9 pr-3 pt-0.5">
          {linkedPositions.length === 0 && !hasSuggestion && (
            <p className="py-1.5 text-xs text-muted-foreground">Nenhum cargo Ankaa vinculado ainda.</p>
          )}

          {linkedPositions.map((p) => (
            <div key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-2">
              <span className="min-w-0 truncate text-sm">{p.name}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                disabled={isPendingLink}
                onClick={() => onUnlink(p.id)}
                aria-label={`Desvincular ${p.name}`}
              >
                <IconX className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {hasSuggestion && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-950/50 dark:bg-amber-950/20">
              <span className="min-w-0 truncate text-sm">
                <span className="text-muted-foreground">Sugestão: </span>
                <span className="font-medium">{candidate!.name}</span>
              </span>
              <Button
                size="sm"
                variant="default"
                className="h-7 shrink-0 gap-1 px-2 text-xs"
                disabled={isPendingLink}
                onClick={() => onLink(candidate!.id)}
              >
                <IconLink className="h-3.5 w-3.5" /> Vincular
              </Button>
            </div>
          )}

          {positionOptions.length > 0 && (
            <Combobox
              mode="single"
              options={positionOptions}
              value=""
              onValueChange={(v) => {
                if (typeof v === "string" && v) onLink(v);
              }}
              placeholder="+ Vincular outro cargo…"
              searchPlaceholder="Buscar cargo…"
              emptyText="Nenhum cargo disponível"
              disabled={isPendingLink}
              triggerClassName="h-7 justify-start border-dashed text-xs text-muted-foreground"
              clearable={false}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Funcionários ↔ Usuários
// ============================================================================

type UserRow = {
  id: string;
  name: string;
  payrollNumber?: number | null;
  secullumEmployeeId?: number | null;
  sector?: { id: string; name: string } | null;
};

type FuncionarioRow = {
  Id: number;
  Nome: string;
  NumeroFolha: string;
  Cpf?: string;
  DepartamentoDescricao?: string;
};

function FuncionariosCard() {
  const ativosQ = useSecullumFuncionariosLite();
  const demitidosQ = useSecullumFuncionariosDemitidos();
  const usersQ = useUsers({
    orderBy: { name: "asc" },
    take: 100,
    include: { sector: true },
  } as any);

  const [search, setSearch] = useState("");

  const users = toArray<UserRow>((usersQ.data as any)?.data ?? usersQ.data);
  const ativos = toArray<FuncionarioRow>(ativosQ.data);
  const demitidos = toArray<FuncionarioRow>(demitidosQ.data);

  const userByEmployeeId = useMemo(() => {
    const m = new Map<number, UserRow>();
    for (const u of users) {
      if (u.secullumEmployeeId != null) m.set(u.secullumEmployeeId, u);
    }
    return m;
  }, [users]);

  const userByPayroll = useMemo(() => {
    const m = new Map<number, UserRow>();
    for (const u of users) {
      if (u.payrollNumber != null) m.set(u.payrollNumber, u);
    }
    return m;
  }, [users]);

  // Resolve a Funcionario row to its Ankaa user.
  // `via: 'fk'` means User.secullumEmployeeId is set — actually linked.
  // `via: 'payroll'` is a fuzzy candidate (payroll number match) that the
  // operator can promote to a real link via the "Vincular" button.
  const matchUser = (
    f: FuncionarioRow,
  ): { user: UserRow; via: "fk" | "payroll" } | null => {
    const byId = userByEmployeeId.get(f.Id);
    if (byId) return { user: byId, via: "fk" };
    const folha = Number(f.NumeroFolha);
    if (!Number.isNaN(folha) && folha > 0) {
      const byFolha = userByPayroll.get(folha);
      if (byFolha) return { user: byFolha, via: "payroll" };
    }
    return null;
  };

  const filterRows = (rows: FuncionarioRow[]) => {
    const q = norm(search);
    if (!q) return rows;
    return rows.filter((r) => {
      if (norm(r.Nome).includes(q)) return true;
      if ((r.NumeroFolha ?? "").includes(q)) return true;
      const m = matchUser(r);
      if (m && norm(m.user.name).includes(q)) return true;
      return false;
    });
  };

  const ativosFiltered = filterRows(ativos);
  const demitidosFiltered = filterRows(demitidos);

  const ativosLinked = ativos.filter((f) => matchUser(f)?.via === "fk").length;
  const ativosPending = ativos.filter((f) => matchUser(f)?.via === "payroll").length;

  const isLoading = ativosQ.isLoading || demitidosQ.isLoading || usersQ.isLoading;
  // Secullum catalog read failures: surface them per-section instead of showing
  // a "no funcionários" empty state when the read actually failed.
  const ativosError = ativosQ.isError;
  const demitidosError = demitidosQ.isError;
  const isFetching = ativosQ.isFetching || demitidosQ.isFetching || usersQ.isFetching;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <MappingToolbar
          icon={IconUserCheck}
          title="Funcionários ativos"
          stats={
            isLoading
              ? "Carregando…"
              : `${ativos.length} ativo(s) · ${ativosLinked} vinculado(s)` +
                (ativosPending > 0 ? ` · ${ativosPending} aguardando` : "")
          }
          onRefresh={() => {
            ativosQ.refetch();
            demitidosQ.refetch();
            usersQ.refetch();
          }}
          isRefreshing={isFetching}
        />

        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, folha ou usuário Ankaa…"
            value={search}
            onChange={(value) => setSearch(typeof value === "string" ? value : "")}
            className="h-9 pl-9"
          />
        </div>

        {isLoading ? (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="px-3 py-2.5">
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
          </Card>
        ) : ativosError ? (
          <ErrorState
            title="Erro ao carregar funcionários ativos do Secullum"
            description="Não foi possível ler os funcionários ativos do ponto (Secullum). Verifique a integração e tente novamente."
            onRetry={() => ativosQ.refetch()}
          />
        ) : (
          <Card className="overflow-hidden">
            <FuncionariosTable rows={ativosFiltered} matchUser={matchUser} variant="ativo" />
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-0.5">
          <IconUserOff className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h2 className="shrink-0 text-sm font-semibold">Funcionários demitidos</h2>
          <span className="truncate text-xs text-muted-foreground">
            {isLoading ? "Carregando…" : `${demitidos.length} desligado(s) · somente leitura`}
          </span>
        </div>

        {isLoading ? (
          <Card className="overflow-hidden">
            <div className="px-3 py-2.5">
              <Skeleton className="h-20 w-full" />
            </div>
          </Card>
        ) : demitidosError ? (
          <ErrorState
            title="Erro ao carregar funcionários demitidos do Secullum"
            description="Não foi possível ler os funcionários desligados do ponto (Secullum). Verifique a integração e tente novamente."
            onRetry={() => demitidosQ.refetch()}
          />
        ) : (
          <Card className="overflow-hidden">
            <FuncionariosTable rows={demitidosFiltered} matchUser={matchUser} variant="demitido" />
          </Card>
        )}
      </section>
    </div>
  );
}

function FuncionariosTable({
  rows,
  matchUser,
  variant,
}: {
  rows: FuncionarioRow[];
  matchUser: (
    f: FuncionarioRow,
  ) => { user: UserRow; via: "fk" | "payroll" } | null;
  variant: "ativo" | "demitido";
}) {
  const linkMutation = useLinkUserFuncionario();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const handleLink = async (funcionarioId: number, userId: string) => {
    setPendingId(funcionarioId);
    try {
      await linkMutation.mutateAsync({ userId, funcionarioId });
      // Success/error toasts emitted by the axios interceptor (POST mapping endpoint).
    } catch {
      // Error toast emitted by the axios error interceptor.
    } finally {
      setPendingId(null);
    }
  };

  const handleUnlink = async (funcionarioId: number, userId: string) => {
    setPendingId(funcionarioId);
    try {
      await linkMutation.mutateAsync({ userId, funcionarioId: null });
      // Success/error toasts emitted by the axios interceptor (POST mapping endpoint).
    } catch {
      // Error toast emitted by the axios error interceptor.
    } finally {
      setPendingId(null);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<IconUsers className="h-9 w-9" />}
        title="Nenhum funcionário encontrado"
        description="Ajuste a busca ou verifique se há funcionários cadastrados no Secullum."
        className="py-8"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-9 w-[88px]">Folha</TableHead>
          <TableHead className="h-9">Funcionário (Secullum)</TableHead>
          <TableHead className="h-9">Usuário Ankaa</TableHead>
          <TableHead className="h-9 w-[160px] text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((f) => {
          const m = matchUser(f);
          const u = m?.user ?? null;
          const isBusy = pendingId === f.Id;
          return (
            <TableRow key={f.Id}>
              <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">
                {f.NumeroFolha || "—"}
              </TableCell>
              <TableCell className="py-1.5">
                <div className="text-sm font-medium leading-tight">{f.Nome}</div>
                {f.DepartamentoDescricao ? (
                  <div className="text-xs text-muted-foreground">{f.DepartamentoDescricao}</div>
                ) : null}
              </TableCell>
              <TableCell className="py-1.5">
                {u ? (
                  <div>
                    <div className="text-sm font-medium leading-tight">{u.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.sector?.name ??
                        (m?.via === "payroll"
                          ? `sugestão · folha ${u.payrollNumber ?? "—"}`
                          : "—")}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="py-1.5">
                <div className="flex items-center justify-end gap-1.5">
                  {variant === "demitido" ? (
                    <Badge variant="muted">Desligado</Badge>
                  ) : m?.via === "fk" ? (
                    <>
                      <Badge variant="active" className="gap-1">
                        <IconCheck className="h-3 w-3" /> Vinculado
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={isBusy}
                        onClick={() => handleUnlink(f.Id, u!.id)}
                        aria-label={`Desvincular ${f.Nome}`}
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : m?.via === "payroll" ? (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={isBusy}
                      onClick={() => handleLink(f.Id, u!.id)}
                    >
                      <IconLink className="h-3.5 w-3.5" />
                      {isBusy ? "Vinculando…" : "Vincular"}
                    </Button>
                  ) : (
                    <Badge variant="outline">Sem usuário</Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
