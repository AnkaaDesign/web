import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconAdjustments, IconClock, IconCoins, IconDroplet, IconPaint, IconRefresh, IconScale } from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SECTOR_PRIVILEGES, routes } from "@/constants";
import { usePaintingConfig, usePaintingConfigMutations } from "@/hooks";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PAINTING_INDIRECT_MODE_LABELS, PAINTING_RATE_MODE_LABELS } from "@/types";
import type { PaintingIndirectCost, PaintingPaintSystem, PaintingProcessParams, PaintingProductivityRate, PaintingRule } from "@/types";

const TAB_CONTENT_CLASSES = "mt-0 flex-1 min-h-0 overflow-y-auto pb-6 p-0 bg-transparent";

function NumberCell({
  value,
  onCommit,
  disabled,
  step = 0.01,
  className,
}: {
  value: number;
  onCommit: (next: number) => void;
  disabled?: boolean;
  step?: number;
  className?: string;
}) {
  // undefined = não está editando; null = campo limpo durante a edição
  const [draft, setDraft] = useState<number | null | undefined>(undefined);
  return (
    <Input
      type="number"
      step={step}
      value={draft === undefined ? value : draft}
      disabled={disabled}
      className={className ?? "h-8 w-24 text-right tabular-nums"}
      onChange={(next) => setDraft(typeof next === "number" ? next : next ? Number(next) : null)}
      onBlur={() => {
        if (draft === undefined) return;
        const parsed = draft;
        setDraft(undefined);
        if (parsed === null || !Number.isFinite(parsed) || parsed === value) return;
        onCommit(parsed);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Taxas de produtividade
// ---------------------------------------------------------------------------

function RatesTab({ rates }: { rates: PaintingProductivityRate[] }) {
  const { updateRateMutation } = usePaintingConfigMutations();
  const commit = (rate: PaintingProductivityRate, data: Record<string, number>) => {
    updateRateMutation.mutate(
      { id: rate.id, data },
      {
        onSuccess: () => toast.success(`Taxa "${rate.label}" atualizada.`),
        onError: () => toast.error(`Erro ao atualizar "${rate.label}".`),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconClock className="h-4 w-4 text-muted-foreground" />
          Taxas de Produtividade
        </CardTitle>
        <CardDescription>
          Quanto a equipe produz por minuto em cada operação. As alterações são salvas automaticamente ao sair do campo e passam a valer para os próximos
          recálculos de plano.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Operação</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Fator médio</TableHead>
                <TableHead className="text-right">Fator alto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="py-2">
                    <p className="text-sm font-medium">{rate.label}</p>
                    {rate.notes ? <p className="text-xs text-muted-foreground">{rate.notes}</p> : null}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground">{PAINTING_RATE_MODE_LABELS[rate.mode]}</TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={rate.value} onCommit={(value) => commit(rate, { value })} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={rate.complexityFactorMedium} onCommit={(complexityFactorMedium) => commit(rate, { complexityFactorMedium })} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={rate.complexityFactorHigh} onCommit={(complexityFactorHigh) => commit(rate, { complexityFactorHigh })} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sistemas de pintura (esquema de demãos + catálise/diluição)
// ---------------------------------------------------------------------------

/** Esquema de demãos em uma linha: "2× Laca (fundo) + 3× Poliéster + 1× Verniz". */
function coatScheduleLabel(system: PaintingPaintSystem): string {
  const roles: Record<string, string> = { GROUND: " (fundo)", COLOR: "", CLEAR: "" };
  const schedule = Array.isArray(system.coatsSchedule) ? system.coatsSchedule : [];
  if (schedule.length === 0) return "—";
  return schedule.map((entry) => `${entry.coats}× ${entry.systemKey}${roles[entry.role] ?? ""}`).join(" + ");
}

function PaintSystemsTab({ systems }: { systems: PaintingPaintSystem[] }) {
  const { updatePaintSystemMutation } = usePaintingConfigMutations();
  const commit = (system: PaintingPaintSystem, data: Record<string, number | boolean>) => {
    updatePaintSystemMutation.mutate(
      { id: system.id, data },
      {
        onSuccess: () => toast.success(`Sistema "${system.label}" atualizado.`),
        onError: () => toast.error(`Erro ao atualizar "${system.label}".`),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconDroplet className="h-4 w-4 text-muted-foreground" />
          Sistemas de Pintura
        </CardTitle>
        <CardDescription>
          Proporção de mistura (tinta : catalisador : diluente), rendimento da mistura pronta e esquema de demãos. Sistemas marcados como
          "estimado" ainda usam valores de partida — confirme e o alerta some do plano.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead>Sistema</TableHead>
                <TableHead>Esquema de demãos</TableHead>
                <TableHead className="text-right">Tinta</TableHead>
                <TableHead className="text-right">Catalisador</TableHead>
                <TableHead className="text-right">Diluente</TableHead>
                <TableHead className="text-right">Rend. (m²/L)</TableHead>
                <TableHead className="text-right">Lote mín. (L)</TableHead>
                <TableHead className="text-right">Cura (min)</TableHead>
                <TableHead className="text-center">Confirmado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {systems.map((system) => (
                <TableRow key={system.id}>
                  <TableCell className="py-2">
                    <p className="text-sm font-medium">{system.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {system.catalystItem?.name ? `${system.catalystItem.name} · ` : ""}
                      {system.thinnerItem?.name ?? "sem diluente"}
                    </p>
                  </TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground">{coatScheduleLabel(system)}</TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={system.mixBase} step={0.5} className="h-8 w-20 text-right tabular-nums" onCommit={(mixBase) => commit(system, { mixBase })} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell
                        value={system.mixCatalyst}
                        step={0.5}
                        className="h-8 w-20 text-right tabular-nums"
                        onCommit={(mixCatalyst) => commit(system, { mixCatalyst })}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell
                        value={system.mixThinner}
                        step={0.5}
                        className="h-8 w-20 text-right tabular-nums"
                        onCommit={(mixThinner) => commit(system, { mixThinner })}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={system.coverageM2PerL} step={0.5} onCommit={(coverageM2PerL) => commit(system, { coverageM2PerL })} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={system.minBatchL} step={0.25} onCommit={(minBatchL) => commit(system, { minBatchL })} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={system.cureMinutes} step={15} onCommit={(cureMinutes) => commit(system, { cureMinutes })} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col items-center gap-1">
                      <Switch
                        checked={!system.needsConfirmation}
                        onCheckedChange={(checked) => commit(system, { needsConfirmation: !checked })}
                      />
                      {system.needsConfirmation && (
                        <Badge variant="yellow" size="sm">
                          estimado
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Custos indiretos
// ---------------------------------------------------------------------------

function IndirectsTab({ indirects }: { indirects: PaintingIndirectCost[] }) {
  const { updateIndirectMutation } = usePaintingConfigMutations();
  const commit = (cost: PaintingIndirectCost, data: { value?: number; active?: boolean }) => {
    updateIndirectMutation.mutate(
      { id: cost.id, data },
      {
        onSuccess: () => toast.success(`"${cost.label}" atualizado.`),
        onError: () => toast.error(`Erro ao atualizar "${cost.label}".`),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCoins className="h-4 w-4 text-muted-foreground" />
          Custos Indiretos e Margens
        </CardTitle>
        <CardDescription>
          Cabine, administração, reservas e margem de lucro aplicados sobre o custo direto. Percentuais em fração (0,35 = 35%). Salvamento automático.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ativo</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indirects.map((cost) => (
                <TableRow key={cost.id}>
                  <TableCell className="py-2">
                    <Switch checked={cost.active} onCheckedChange={(active) => commit(cost, { active })} />
                  </TableCell>
                  <TableCell className={cost.active ? "py-2 text-sm font-medium" : "py-2 text-sm font-medium text-muted-foreground"}>{cost.label}</TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground">{PAINTING_INDIRECT_MODE_LABELS[cost.mode]}</TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={cost.value} onCommit={(value) => commit(cost, { value })} disabled={!cost.active} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Regras de estratégia
// ---------------------------------------------------------------------------

function RuleParamsEditor({ rule }: { rule: PaintingRule }) {
  const { updateRuleMutation } = usePaintingConfigMutations();
  const [draft, setDraft] = useState<string | null>(null);
  const serialized = JSON.stringify(rule.params, null, 0);

  const commit = () => {
    if (draft === null) return;
    const text = draft;
    setDraft(null);
    if (text === serialized) return;
    try {
      const params = JSON.parse(text);
      updateRuleMutation.mutate(
        { id: rule.id, data: { params } },
        {
          onSuccess: () => toast.success(`Regra "${rule.label}" atualizada.`),
          onError: () => toast.error(`Erro ao atualizar "${rule.label}".`),
        },
      );
    } catch {
      toast.error("JSON inválido — a alteração não foi salva.");
    }
  };

  return (
    <Textarea
      value={draft ?? serialized}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      rows={2}
      className="min-h-0 w-full min-w-[280px] resize-y font-mono text-xs"
    />
  );
}

function RulesTab({ rules }: { rules: PaintingRule[] }) {
  const { updateRuleMutation } = usePaintingConfigMutations();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconScale className="h-4 w-4 text-muted-foreground" />
          Regras de Decisão
        </CardTitle>
        <CardDescription>
          Limiares que definem as estratégias do motor (pintura geral, corte × cura, larguras de adesivo, custo-hora...). Os parâmetros são JSON e salvam ao
          sair do campo.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ativa</TableHead>
                <TableHead className="w-80">Regra</TableHead>
                <TableHead>Parâmetros</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="py-2">
                    <Switch
                      checked={rule.active}
                      onCheckedChange={(active) =>
                        updateRuleMutation.mutate(
                          { id: rule.id, data: { active } },
                          {
                            onSuccess: () => toast.success(`Regra "${rule.label}" ${active ? "ativada" : "desativada"}.`),
                            onError: () => toast.error(`Erro ao atualizar "${rule.label}".`),
                          },
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <p className={rule.active ? "text-sm font-medium" : "text-sm font-medium text-muted-foreground"}>{rule.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">{rule.key}</p>
                  </TableCell>
                  <TableCell className="py-2">
                    <RuleParamsEditor rule={rule} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Parâmetros por tipo de tinta
// ---------------------------------------------------------------------------

function ProcessParamsTab({ processParams }: { processParams: PaintingProcessParams[] }) {
  const { updateProcessParamsMutation } = usePaintingConfigMutations();
  const commit = (param: PaintingProcessParams, data: Record<string, number | boolean>) => {
    updateProcessParamsMutation.mutate(
      { id: param.id, data },
      {
        onSuccess: () => toast.success(`Parâmetros de "${param.paintType?.name ?? "tipo"}" atualizados.`),
        onError: () => toast.error("Erro ao atualizar parâmetros."),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconPaint className="h-4 w-4 text-muted-foreground" />
          Parâmetros por Tipo de Tinta
        </CardTitle>
        <CardDescription>
          Demãos, rendimento (m²/L), perdas e cura por tipo. O verniz obrigatório vale para laca (verniz coletivo final) e poliéster. Salvamento automático.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Demãos</TableHead>
                <TableHead className="text-right">m²/L</TableHead>
                <TableHead className="text-right">Perda spray</TableHead>
                <TableHead className="text-right">Perda preparo</TableHead>
                <TableHead className="text-right">Cura (min)</TableHead>
                <TableHead className="text-right">Verniz obrigatório</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processParams.map((param) => (
                <TableRow key={param.id}>
                  <TableCell className="py-2 text-sm font-medium">
                    {param.paintType?.name ?? (
                      <Badge variant="muted" size="sm">
                        Padrão
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={param.coatsDefault} step={1} onCommit={(coatsDefault) => commit(param, { coatsDefault })} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={param.coverageM2PerL} onCommit={(coverageM2PerL) => commit(param, { coverageM2PerL })} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={param.sprayLossPct} onCommit={(sprayLossPct) => commit(param, { sprayLossPct })} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={param.prepLossPct} onCommit={(prepLossPct) => commit(param, { prepLossPct })} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <NumberCell value={param.cureMinutes} step={1} onCommit={(cureMinutes) => commit(param, { cureMinutes })} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <Switch checked={param.needsClearCoat} onCheckedChange={(needsClearCoat) => commit(param, { needsClearCoat })} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export function PaintingBudgetConfigPage() {
  usePageTracker({ title: "Configurações — Orçamento de Pintura", icon: "cog" });
  const navigate = useNavigate();
  const { data: response, isLoading, refetch, isFetching } = usePaintingConfig();
  const config = response?.data;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex h-full flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Configurações do Orçamento de Pintura"
            icon={IconAdjustments}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração" },
              { label: "Orçamento de Pintura", href: routes.administration.paintingBudget.root },
              { label: "Configurações" },
            ]}
            backButton={{ onClick: () => navigate(routes.administration.paintingBudget.root) }}
            actions={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconRefresh,
                onClick: () => refetch(),
                variant: "outline" as const,
                loading: isFetching,
              },
            ]}
          />
        </div>

        {isLoading || !config ? (
          <div className="mt-4 flex flex-col gap-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="taxas" className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
            <TabsList className="flex-shrink-0 self-start">
              <TabsTrigger value="taxas" className="gap-2">
                <IconClock className="h-4 w-4" /> Taxas
              </TabsTrigger>
              <TabsTrigger value="indiretos" className="gap-2">
                <IconCoins className="h-4 w-4" /> Indiretos e Margens
              </TabsTrigger>
              <TabsTrigger value="regras" className="gap-2">
                <IconScale className="h-4 w-4" /> Regras
              </TabsTrigger>
              <TabsTrigger value="sistemas" className="gap-2">
                <IconDroplet className="h-4 w-4" /> Sistemas de Pintura
              </TabsTrigger>
              <TabsTrigger value="tintas" className="gap-2">
                <IconPaint className="h-4 w-4" /> Tipos de Tinta
              </TabsTrigger>
            </TabsList>
            <TabsContent value="taxas" className={TAB_CONTENT_CLASSES}>
              <RatesTab rates={config.rates} />
            </TabsContent>
            <TabsContent value="indiretos" className={TAB_CONTENT_CLASSES}>
              <IndirectsTab indirects={config.indirects} />
            </TabsContent>
            <TabsContent value="regras" className={TAB_CONTENT_CLASSES}>
              <RulesTab rules={config.rules} />
            </TabsContent>
            <TabsContent value="sistemas" className={TAB_CONTENT_CLASSES}>
              <PaintSystemsTab systems={config.paintSystems ?? []} />
            </TabsContent>
            <TabsContent value="tintas" className={TAB_CONTENT_CLASSES}>
              <ProcessParamsTab processParams={config.processParams} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </PrivilegeRoute>
  );
}

export default PaintingBudgetConfigPage;
