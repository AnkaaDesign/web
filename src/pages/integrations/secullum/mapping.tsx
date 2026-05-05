import { useMemo, useState } from "react";
import {
  IconCheck,
  IconAlertTriangle,
  IconRefresh,
  IconBuildingStore,
  IconBriefcase,
  IconUsers,
} from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

export default function SecullumMappingPage() {
  return (
    <div className="container max-w-6xl space-y-6 py-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Integração Secullum — Mapeamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Vincula setores e cargos do Ankaa aos departamentos e funções do Secullum.
            Necessário para a sincronização automática ao criar/editar/desligar usuários.
          </p>
        </div>
      </div>

      <Tabs defaultValue="departamentos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="departamentos" className="gap-2">
            <IconBuildingStore className="h-4 w-4" /> Departamentos ↔ Setores
          </TabsTrigger>
          <TabsTrigger value="funcoes" className="gap-2">
            <IconBriefcase className="h-4 w-4" /> Funções ↔ Cargos
          </TabsTrigger>
          <TabsTrigger value="funcionarios" className="gap-2">
            <IconUsers className="h-4 w-4" /> Funcionários
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
  );
}

// ============================================================================
// Departamentos ↔ Setores
// ============================================================================

function DepartamentoMappingCard() {
  const departamentosQ = useSecullumDepartamentos();
  const horariosQ = useSecullumHorarios();
  // Real useSectors returns the standard list response: { data: { data: Sector[], total, ... } }
  const sectorsQ = useSectors({ orderBy: { name: "asc" }, take: 200 } as any);
  const upsert = useUpsertSecullumDepartamento();
  const linkSector = useLinkSectorDepartamento();
  const setSectorHorario = useSetSectorHorario();

  const rows = useMemo(() => {
    const sectors = ((sectorsQ.data as any)?.data ?? []) as Array<{
      id: string;
      name: string;
      secullumDepartamentoId?: number | null;
      secullumHorarioId?: number | null;
    }>;
    const departamentos = departamentosQ.data ?? [];
    const sectorByDeptId = new Map(
      sectors
        .filter((s) => s.secullumDepartamentoId != null)
        .map((s) => [s.secullumDepartamentoId as number, s]),
    );
    const sectorByName = new Map(sectors.map((s) => [norm(s.name), s]));

    const matched = departamentos.map((d) => {
      const linked = sectorByDeptId.get(d.Id);
      const candidate = sectorByName.get(norm(d.Descricao));
      return {
        departamento: d,
        sector: linked ?? candidate ?? null,
        status: linked
          ? ("linked" as const)
          : candidate
            ? ("candidate" as const)
            : ("unmatched" as const),
      };
    });

    const unmappedSectors = sectors.filter(
      (s) =>
        s.secullumDepartamentoId == null &&
        !departamentos.some((d) => norm(d.Descricao) === norm(s.name)),
    );

    return { matched, unmappedSectors };
  }, [sectorsQ.data, departamentosQ.data]);

  const isLoading = departamentosQ.isLoading || sectorsQ.isLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Departamentos do Secullum</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => departamentosQ.refetch()}
            disabled={departamentosQ.isFetching}
          >
            <IconRefresh
              className={`h-4 w-4 ${departamentosQ.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </CardTitle>
        <CardDescription>
          {isLoading
            ? "Carregando…"
            : `${rows.matched.length} departamento(s) no Secullum, ` +
              `${rows.matched.filter((r) => r.status === "linked").length} vinculado(s).`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Secullum (Id / Descrição)</th>
                  <th className="px-3 py-2">Setor Ankaa</th>
                  <th className="px-3 py-2">Horário padrão</th>
                  <th className="px-3 py-2">Status / Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.matched.map((r) => (
                  <tr key={r.departamento.Id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{r.departamento.Id}
                      </span>{" "}
                      {r.departamento.Descricao}
                    </td>
                    <td className="px-3 py-2">
                      {r.sector ? r.sector.name : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.sector && r.status === "linked" ? (
                        <Select
                          value={
                            r.sector.secullumHorarioId != null
                              ? String(r.sector.secullumHorarioId)
                              : ""
                          }
                          onValueChange={(v) =>
                            setSectorHorario.mutate(
                              {
                                sectorId: r.sector!.id,
                                horarioId: v === "" ? null : Number(v),
                              },
                              {
                                onSuccess: () =>
                                  toast.success(
                                    `Horário padrão atualizado para "${r.sector!.name}"`,
                                  ),
                                onError: (e) =>
                                  toast.error(
                                    `Falha ao atualizar horário: ${(e as Error).message}`,
                                  ),
                              },
                            )
                          }
                          disabled={
                            horariosQ.isLoading || setSectorHorario.isPending
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Sem padrão" />
                          </SelectTrigger>
                          <SelectContent>
                            {(horariosQ.data ?? [])
                              .filter((h) => !h.Desativar)
                              .map((h) => (
                                <SelectItem key={h.Id} value={String(h.Id)}>
                                  #{h.Numero} — {h.Descricao}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        {r.status === "candidate" && r.sector && (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={linkSector.isPending}
                            onClick={() =>
                              linkSector.mutate(
                                {
                                  sectorId: r.sector!.id,
                                  departamentoId: r.departamento.Id,
                                },
                                {
                                  onSuccess: () =>
                                    toast.success(
                                      `Setor "${r.sector!.name}" vinculado ao departamento #${r.departamento.Id}`,
                                    ),
                                  onError: (e) =>
                                    toast.error(
                                      `Falha ao vincular: ${(e as Error).message}`,
                                    ),
                                },
                              )
                            }
                          >
                            Vincular
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.unmappedSectors.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
            <div className="mb-2 text-sm font-medium text-amber-900">
              Setores Ankaa sem departamento Secullum
            </div>
            <ul className="space-y-2">
              {rows.unmappedSectors.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{s.name}</span>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={upsert.isPending}
                    onClick={async () => {
                      try {
                        const created = await upsert.mutateAsync({
                          Descricao: s.name,
                        });
                        toast.success(
                          `Departamento "${created.Descricao}" criado no Secullum (#${created.Id}). ` +
                            `Atualize o setor para vincular.`,
                        );
                      } catch (e) {
                        toast.error(
                          `Falha ao criar departamento: ${(e as Error).message}`,
                        );
                      }
                    }}
                  >
                    Criar no Secullum
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Funcoes ↔ Positions
// ============================================================================

function FuncaoMappingCard() {
  const funcoesQ = useSecullumFuncoes();
  const positionsQ = usePositions({ orderBy: { name: "asc" }, take: 200 } as any);
  const upsert = useUpsertSecullumFuncao();
  const linkPosition = useLinkPositionFuncao();

  const rows = useMemo(() => {
    const positions = ((positionsQ.data as any)?.data ?? []) as Array<{
      id: string;
      name: string;
      secullumFuncaoId?: number | null;
    }>;
    const funcoes = funcoesQ.data ?? [];
    const posByFuncaoId = new Map(
      positions
        .filter((p) => p.secullumFuncaoId != null)
        .map((p) => [p.secullumFuncaoId as number, p]),
    );
    const posByName = new Map(positions.map((p) => [norm(p.name), p]));

    const matched = funcoes.map((f) => {
      const linked = posByFuncaoId.get(f.Id);
      const candidate = posByName.get(norm(f.Descricao));
      return {
        funcao: f,
        position: linked ?? candidate ?? null,
        status: linked
          ? ("linked" as const)
          : candidate
            ? ("candidate" as const)
            : ("unmatched" as const),
      };
    });

    const unmappedPositions = positions.filter(
      (p) =>
        p.secullumFuncaoId == null &&
        !funcoes.some((f) => norm(f.Descricao) === norm(p.name)),
    );

    return { matched, unmappedPositions };
  }, [positionsQ.data, funcoesQ.data]);

  const isLoading = funcoesQ.isLoading || positionsQ.isLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Funções do Secullum</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => funcoesQ.refetch()}
            disabled={funcoesQ.isFetching}
          >
            <IconRefresh
              className={`h-4 w-4 ${funcoesQ.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </CardTitle>
        <CardDescription>
          {isLoading
            ? "Carregando…"
            : `${rows.matched.length} função(ões) no Secullum, ` +
              `${rows.matched.filter((r) => r.status === "linked").length} vinculada(s).`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Secullum (Id / Descrição)</th>
                  <th className="px-3 py-2">Cargo Ankaa</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.matched.map((r) => (
                  <tr key={r.funcao.Id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{r.funcao.Id}
                      </span>{" "}
                      {r.funcao.Descricao}
                    </td>
                    <td className="px-3 py-2">
                      {r.position ? r.position.name : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        {r.status === "candidate" && r.position && (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={linkPosition.isPending}
                            onClick={() =>
                              linkPosition.mutate(
                                {
                                  positionId: r.position!.id,
                                  funcaoId: r.funcao.Id,
                                },
                                {
                                  onSuccess: () =>
                                    toast.success(
                                      `Cargo "${r.position!.name}" vinculado à função #${r.funcao.Id}`,
                                    ),
                                  onError: (e) =>
                                    toast.error(
                                      `Falha ao vincular: ${(e as Error).message}`,
                                    ),
                                },
                              )
                            }
                          >
                            Vincular
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.unmappedPositions.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
            <div className="mb-2 text-sm font-medium text-amber-900">
              Cargos Ankaa sem função Secullum
            </div>
            <ul className="space-y-2">
              {rows.unmappedPositions.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{p.name}</span>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={upsert.isPending}
                    onClick={async () => {
                      try {
                        const created = await upsert.mutateAsync({ Descricao: p.name });
                        toast.success(
                          `Função "${created.Descricao}" criada no Secullum (#${created.Id}).`,
                        );
                      } catch (e) {
                        toast.error(`Falha ao criar função: ${(e as Error).message}`);
                      }
                    }}
                  >
                    Criar no Secullum
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Funcionarios — overview only (manage from existing user pages)
// ============================================================================

function FuncionariosCard() {
  const ativosQ = useSecullumFuncionariosLite();
  const demitidosQ = useSecullumFuncionariosDemitidos();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Funcionários ativos</CardTitle>
          <CardDescription>
            {ativosQ.isLoading
              ? "Carregando…"
              : `${(ativosQ.data ?? []).length} funcionário(s) ativo(s) no Secullum`}
          </CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Funcionários demitidos</CardTitle>
          <CardDescription>
            {demitidosQ.isLoading
              ? "Carregando…"
              : `${(demitidosQ.data ?? []).length} funcionário(s) desligado(s)`}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function StatusBadge({ status }: { status: "linked" | "candidate" | "unmatched" }) {
  if (status === "linked")
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-900 hover:bg-emerald-200">
        <IconCheck className="h-3 w-3" /> Vinculado
      </Badge>
    );
  if (status === "candidate")
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-200">
        <IconAlertTriangle className="h-3 w-3" /> Vincular manualmente
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Sem correspondência
    </Badge>
  );
}
