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
} from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { routes, SECTOR_PRIVILEGES } from "@/constants";

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
} from "@/hooks/integrations/use-secullum-mapping";
import { useSectors } from "@/hooks/administration/use-sector";
import { usePositions } from "@/hooks/human-resources/use-position";
import { useUsers } from "@/hooks/human-resources/use-user";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

// ============================================================================
// Page shell
// ============================================================================

export default function SecullumMappingPage() {
  usePageTracker({
    title: "Integração Secullum",
    icon: "users",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Integração Secullum"
          subtitle="Vincule setores e cargos do Ankaa aos departamentos e funções do Secullum. Cada departamento/função pode ter múltiplos setores/cargos."
          icon={IconUsers}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos" },
            { label: "Integração Secullum" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 overflow-y-auto">
          <Tabs defaultValue="departamentos" className="space-y-4">
            <TabsList>
              <TabsTrigger value="departamentos" className="gap-2">
                <IconBuildingStore className="h-4 w-4" /> Departamentos ↔ Setores
              </TabsTrigger>
              <TabsTrigger value="funcoes" className="gap-2">
                <IconBriefcase className="h-4 w-4" /> Funções ↔ Cargos
              </TabsTrigger>
              <TabsTrigger value="funcionarios" className="gap-2">
                <IconUsers className="h-4 w-4" /> Funcionários ↔ Usuários
              </TabsTrigger>
            </TabsList>

            <TabsContent value="departamentos">
              <DepartamentoMappingCard />
            </TabsContent>
            <TabsContent value="funcoes">
              <FuncaoMappingCard />
            </TabsContent>
            <TabsContent value="funcionarios">
              <FuncionariosCard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PrivilegeRoute>
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

  const sectors: SectorRow[] = ((sectorsQ.data as any)?.data ?? []) as SectorRow[];
  const departamentos = departamentosQ.data ?? [];

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
  const linkedCount = groups.reduce((acc, g) => acc + g.linked.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Departamentos do Secullum</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              departamentosQ.refetch();
              sectorsQ.refetch();
            }}
            disabled={departamentosQ.isFetching || sectorsQ.isFetching}
          >
            <IconRefresh
              className={`h-4 w-4 ${departamentosQ.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </CardTitle>
        <CardDescription>
          {isLoading
            ? "Carregando…"
            : `${departamentos.length} departamento(s) • ${linkedCount} setor(es) Ankaa vinculado(s)`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <DepartamentoGroup
                key={g.departamento.Id}
                departamento={g.departamento}
                linkedSectors={g.linked}
                availableSectors={unmappedSectors}
                horarios={horariosQ.data ?? []}
                isPendingLink={linkSector.isPending}
                isPendingHorario={setSectorHorario.isPending}
                onLink={(sectorId) =>
                  linkSector.mutate(
                    { sectorId, departamentoId: g.departamento.Id },
                    {
                      onSuccess: () => toast.success(`Setor vinculado a ${g.departamento.Descricao}`),
                      onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
                    },
                  )
                }
                onUnlink={(sectorId) =>
                  linkSector.mutate(
                    { sectorId, departamentoId: null },
                    {
                      onSuccess: () => toast.success("Setor desvinculado"),
                      onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
                    },
                  )
                }
                onSetHorario={(sectorId, horarioId) =>
                  setSectorHorario.mutate(
                    { sectorId, horarioId },
                    {
                      onSuccess: () => toast.success("Horário padrão atualizado"),
                      onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
                    },
                  )
                }
              />
            ))}
          </div>
        )}

        {!isLoading && unmappedSectors.length > 0 && (
          <UnmappedPanel
            title="Setores Ankaa sem departamento Secullum"
            description="Crie um departamento equivalente no Secullum, ou vincule a um existente acima."
          >
            {unmappedSectors.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md bg-background/50 px-3 py-2 text-sm"
              >
                <span className="font-medium">{s.name}</span>
                <Button
                  size="sm"
                  variant="default"
                  disabled={upsert.isPending}
                  onClick={async () => {
                    try {
                      const created = await upsert.mutateAsync({ Descricao: s.name });
                      toast.success(
                        `Departamento "${created.Descricao}" criado (#${created.Id}). Agora vincule o setor.`,
                      );
                    } catch (e) {
                      toast.error(`Falha ao criar: ${(e as Error).message}`);
                    }
                  }}
                >
                  <IconPlus className="mr-1 h-4 w-4" /> Criar no Secullum
                </Button>
              </li>
            ))}
          </UnmappedPanel>
        )}
      </CardContent>
    </Card>
  );
}

function DepartamentoGroup({
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

  const sectorOptions = availableSectors.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            #{departamento.Id}
          </Badge>
          <span className="font-semibold">{departamento.Descricao}</span>
          {departamento.Nfolha ? (
            <span className="text-xs text-muted-foreground">N. folha: {departamento.Nfolha}</span>
          ) : null}
        </div>
        {linkedSectors.length > 0 ? (
          <Badge className="gap-1 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
            <IconCheck className="h-3 w-3" /> {linkedSectors.length} vinculado(s)
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Sem setores
          </Badge>
        )}
      </div>

      <div className="space-y-2 p-3">
        {linkedSectors.length === 0 && !candidateName && (
          <p className="px-1 text-sm text-muted-foreground">
            Nenhum setor Ankaa vinculado ainda.
          </p>
        )}

        {linkedSectors.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2"
          >
            <span className="flex-1 text-sm font-medium">{s.name}</span>
            <Select
              value={s.secullumHorarioId != null ? String(s.secullumHorarioId) : ""}
              onValueChange={(v) => onSetHorario(s.id, v === "" ? null : Number(v))}
              disabled={isPendingHorario}
            >
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue placeholder="Horário padrão" />
              </SelectTrigger>
              <SelectContent>
                {horarios
                  .filter((h) => !h.Desativar)
                  .map((h) => (
                    <SelectItem key={h.Id} value={String(h.Id)}>
                      #{h.Numero} — {h.Descricao}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-destructive hover:text-destructive"
              disabled={isPendingLink}
              onClick={() => onUnlink(s.id)}
            >
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {candidateName && !linkedSectors.some((s) => s.id === candidateName.id) && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-amber-400/60 bg-amber-50/50 px-3 py-2 dark:bg-amber-950/20">
            <span className="flex-1 text-sm">
              Sugestão: <span className="font-medium">{candidateName.name}</span>
            </span>
            <Button
              size="sm"
              variant="default"
              disabled={isPendingLink}
              onClick={() => onLink(candidateName.id)}
            >
              <IconLink className="mr-1 h-4 w-4" /> Vincular
            </Button>
          </div>
        )}

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
          disabled={isPendingLink || sectorOptions.length === 0}
          triggerClassName="w-full justify-start"
          clearable={false}
        />
      </div>
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

  const positions: PositionRow[] = ((positionsQ.data as any)?.data ?? []) as PositionRow[];
  const funcoes = funcoesQ.data ?? [];

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
  const linkedCount = groups.reduce((acc, g) => acc + g.linked.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Funções do Secullum</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              funcoesQ.refetch();
              positionsQ.refetch();
            }}
            disabled={funcoesQ.isFetching || positionsQ.isFetching}
          >
            <IconRefresh className={`h-4 w-4 ${funcoesQ.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          {isLoading
            ? "Carregando…"
            : `${funcoes.length} função(ões) • ${linkedCount} cargo(s) Ankaa vinculado(s)`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <FuncaoGroup
                key={g.funcao.Id}
                funcao={g.funcao}
                linkedPositions={g.linked}
                availablePositions={unmappedPositions}
                isPendingLink={linkPosition.isPending}
                onLink={(positionId) =>
                  linkPosition.mutate(
                    { positionId, funcaoId: g.funcao.Id },
                    {
                      onSuccess: () => toast.success(`Cargo vinculado a ${g.funcao.Descricao}`),
                      onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
                    },
                  )
                }
                onUnlink={(positionId) =>
                  linkPosition.mutate(
                    { positionId, funcaoId: null },
                    {
                      onSuccess: () => toast.success("Cargo desvinculado"),
                      onError: (e) => toast.error(`Falha: ${(e as Error).message}`),
                    },
                  )
                }
              />
            ))}
          </div>
        )}

        {!isLoading && unmappedPositions.length > 0 && (
          <UnmappedPanel
            title="Cargos Ankaa sem função Secullum"
            description="Crie uma função equivalente no Secullum, ou vincule a uma existente acima."
          >
            {unmappedPositions.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md bg-background/50 px-3 py-2 text-sm"
              >
                <span className="font-medium">{p.name}</span>
                <Button
                  size="sm"
                  variant="default"
                  disabled={upsert.isPending}
                  onClick={async () => {
                    try {
                      const created = await upsert.mutateAsync({ Descricao: p.name });
                      toast.success(
                        `Função "${created.Descricao}" criada (#${created.Id}). Agora vincule o cargo.`,
                      );
                    } catch (e) {
                      toast.error(`Falha ao criar: ${(e as Error).message}`);
                    }
                  }}
                >
                  <IconPlus className="mr-1 h-4 w-4" /> Criar no Secullum
                </Button>
              </li>
            ))}
          </UnmappedPanel>
        )}
      </CardContent>
    </Card>
  );
}

function FuncaoGroup({
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

  const positionOptions = availablePositions.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            #{funcao.Id}
          </Badge>
          <span className="font-semibold">{funcao.Descricao}</span>
        </div>
        {linkedPositions.length > 0 ? (
          <Badge className="gap-1 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
            <IconCheck className="h-3 w-3" /> {linkedPositions.length} vinculado(s)
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Sem cargos
          </Badge>
        )}
      </div>

      <div className="space-y-2 p-3">
        {linkedPositions.length === 0 && !candidate && (
          <p className="px-1 text-sm text-muted-foreground">Nenhum cargo Ankaa vinculado ainda.</p>
        )}

        {linkedPositions.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2"
          >
            <span className="flex-1 text-sm font-medium">{p.name}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-destructive hover:text-destructive"
              disabled={isPendingLink}
              onClick={() => onUnlink(p.id)}
            >
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {candidate && !linkedPositions.some((p) => p.id === candidate.id) && (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-amber-400/60 bg-amber-50/50 px-3 py-2 dark:bg-amber-950/20">
            <span className="flex-1 text-sm">
              Sugestão: <span className="font-medium">{candidate.name}</span>
            </span>
            <Button
              size="sm"
              variant="default"
              disabled={isPendingLink}
              onClick={() => onLink(candidate.id)}
            >
              <IconLink className="mr-1 h-4 w-4" /> Vincular
            </Button>
          </div>
        )}

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
          disabled={isPendingLink || positionOptions.length === 0}
          triggerClassName="w-full justify-start"
          clearable={false}
        />
      </div>
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
  status?: string | null;
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
  const usersQ = useUsers({ orderBy: { name: "asc" }, take: 100 } as any);

  const [search, setSearch] = useState("");

  const users: UserRow[] = ((usersQ.data as any)?.data ?? []) as UserRow[];
  const ativos: FuncionarioRow[] = (ativosQ.data ?? []) as FuncionarioRow[];
  const demitidos: FuncionarioRow[] = (demitidosQ.data ?? []) as FuncionarioRow[];

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

  const matchUser = (f: FuncionarioRow): UserRow | null => {
    const byId = userByEmployeeId.get(f.Id);
    if (byId) return byId;
    const folha = Number(f.NumeroFolha);
    if (!Number.isNaN(folha) && folha > 0) {
      const byFolha = userByPayroll.get(folha);
      if (byFolha) return byFolha;
    }
    return null;
  };

  const filterRows = (rows: FuncionarioRow[]) => {
    const q = norm(search);
    if (!q) return rows;
    return rows.filter((r) => {
      if (norm(r.Nome).includes(q)) return true;
      if ((r.NumeroFolha ?? "").includes(q)) return true;
      const u = matchUser(r);
      if (u && norm(u.name).includes(q)) return true;
      return false;
    });
  };

  const ativosFiltered = filterRows(ativos);
  const demitidosFiltered = filterRows(demitidos);

  const ativosLinked = ativos.filter((f) => matchUser(f) != null).length;

  const isLoading = ativosQ.isLoading || demitidosQ.isLoading || usersQ.isLoading;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <IconUserCheck className="h-5 w-5 text-emerald-600" />
              Funcionários ativos
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                ativosQ.refetch();
                demitidosQ.refetch();
                usersQ.refetch();
              }}
              disabled={ativosQ.isFetching || demitidosQ.isFetching || usersQ.isFetching}
            >
              <IconRefresh
                className={`h-4 w-4 ${ativosQ.isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </CardTitle>
          <CardDescription>
            {isLoading
              ? "Carregando…"
              : `${ativos.length} ativo(s) no Secullum • ${ativosLinked} vinculado(s) a usuários Ankaa`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, folha ou usuário Ankaa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <FuncionariosTable rows={ativosFiltered} matchUser={matchUser} variant="ativo" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUserOff className="h-5 w-5 text-muted-foreground" />
            Funcionários demitidos
          </CardTitle>
          <CardDescription>
            {isLoading
              ? "Carregando…"
              : `${demitidos.length} desligado(s) — somente leitura`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <FuncionariosTable rows={demitidosFiltered} matchUser={matchUser} variant="demitido" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FuncionariosTable({
  rows,
  matchUser,
  variant,
}: {
  rows: FuncionarioRow[];
  matchUser: (f: FuncionarioRow) => UserRow | null;
  variant: "ativo" | "demitido";
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
        Nenhum funcionário encontrado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Secullum (Id / Nome)</th>
            <th className="px-3 py-2 font-medium">Folha</th>
            <th className="px-3 py-2 font-medium">Departamento</th>
            <th className="px-3 py-2 font-medium">Usuário Ankaa</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const u = matchUser(f);
            return (
              <tr key={f.Id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="font-medium">{f.Nome}</span>
                    <span className="font-mono text-xs text-muted-foreground">#{f.Id}</span>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{f.NumeroFolha || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {f.DepartamentoDescricao || "—"}
                </td>
                <td className="px-3 py-2">
                  {u ? (
                    <div className="flex flex-col">
                      <span className="font-medium">{u.name}</span>
                      {u.payrollNumber ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          Folha #{u.payrollNumber}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {variant === "demitido" ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      Desligado
                    </Badge>
                  ) : u ? (
                    <Badge className="gap-1 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <IconCheck className="h-3 w-3" /> Vinculado
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-400/60 text-amber-600 dark:text-amber-400"
                    >
                      Sem usuário
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function UnmappedPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-amber-400/40 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="mb-2">
        <div className="text-sm font-medium text-amber-900 dark:text-amber-300">{title}</div>
        {description ? (
          <p className="text-xs text-amber-800/80 dark:text-amber-300/70">{description}</p>
        ) : null}
      </div>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}
