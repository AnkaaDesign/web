import { useMemo, useState } from "react";
import {
  IconCheck,
  IconX,
  IconMinus,
  IconRefresh,
  IconActivity,
  IconClock,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useLatestSecullumSmokeTestRun,
  useRunSecullumSmokeTest,
} from "@/hooks/integrations/use-secullum-smoke-test";
import type {
  SecullumSmokeCheck,
  SecullumSmokeCheckStatus,
  SecullumSmokeRun,
} from "@/api-client/services/secullum-smoke-test";

const CATEGORY_LABELS: Record<string, string> = {
  connectivity: "Conectividade & autenticação",
  read: "Leituras (catálogo)",
  "funcionario-crud": "Cadastro de funcionário (criar/editar/demitir/excluir)",
  "time-entry": "Batidas / Cartão-ponto",
  afastamento: "Afastamentos & férias",
  holiday: "Feriados",
  request: "Solicitações (ajuste, ausência, aprovar/rejeitar)",
  "inclusao-ponto": "Inclusão de ponto (app/GPS)",
  assinatura: "Fechamento / Assinatura de cartão-ponto",
  "self-service": "Auto-atendimento",
  teardown: "Finalização & limpeza",
};

const CATEGORY_ORDER = [
  "connectivity",
  "read",
  "funcionario-crud",
  "time-entry",
  "afastamento",
  "holiday",
  "request",
  "inclusao-ponto",
  "assinatura",
  "self-service",
  "teardown",
];

function StatusPill({ status }: { status: SecullumSmokeCheckStatus }) {
  if (status === "PASS")
    return (
      <Badge variant="approved" className="gap-1">
        <IconCheck className="h-3.5 w-3.5" /> OK
      </Badge>
    );
  if (status === "FAIL")
    return (
      <Badge variant="failed" className="gap-1">
        <IconX className="h-3.5 w-3.5" /> Falhou
      </Badge>
    );
  return (
    <Badge variant="muted" className="gap-1">
      <IconMinus className="h-3.5 w-3.5" /> Ignorado
    </Badge>
  );
}

function RunStatusBadge({ run }: { run: SecullumSmokeRun }) {
  const map: Record<string, { variant: string; label: string }> = {
    PASSED: { variant: "approved", label: "Tudo OK" },
    PARTIAL: { variant: "amber", label: "Parcial" },
    FAILED: { variant: "failed", label: "Com falhas" },
    RUNNING: { variant: "processing", label: "Executando" },
  };
  const cfg = map[run.status] ?? { variant: "muted", label: run.status };
  return <Badge variant={cfg.variant as any}>{cfg.label}</Badge>;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function DiagnosticoCard() {
  const latestQ = useLatestSecullumSmokeTestRun();
  const runMutation = useRunSecullumSmokeTest();
  const run = latestQ.data ?? null;
  const [includeApuracao, setIncludeApuracao] = useState(false);

  const grouped = useMemo(() => {
    const checks: SecullumSmokeCheck[] = run?.checks ?? [];
    const byCat = new Map<string, SecullumSmokeCheck[]>();
    for (const c of checks) {
      const arr = byCat.get(c.category) ?? [];
      arr.push(c);
      byCat.set(c.category, arr);
    }
    const cats = [...byCat.keys()].sort(
      (a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99),
    );
    return cats.map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      checks: byCat.get(cat)!.sort((a, b) => a.order - b.order),
    }));
  }, [run]);

  const isRunning = runMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      {/* Header / summary */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <IconActivity className="h-5 w-5 text-primary" />
              Diagnóstico da Integração Secullum
            </CardTitle>
            <CardDescription>
              Teste automático (06:00 e 12:00) de todas as integrações Secullum. Cria/edita/exclui
              um funcionário de teste, e exercita a conta Kennedy (reativada e re-demitida ao final).
              Verde = OK, vermelho = quebrou.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Button onClick={() => runMutation.mutate(includeApuracao)} disabled={isRunning} className="gap-2">
              <IconRefresh className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
              {isRunning ? "Executando…" : "Executar agora"}
            </Button>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={includeApuracao} onCheckedChange={(v) => setIncludeApuracao(v === true)} disabled={isRunning} />
              Incluir fechamento (cria apurações)
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {latestQ.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : !run ? (
            <EmptyState
              title="Nenhuma execução ainda"
              description="Clique em “Executar agora” para rodar o diagnóstico pela primeira vez."
              icon={<IconActivity className="h-10 w-10" />}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <RunStatusBadge run={run} />
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <IconClock className="h-4 w-4" />
                {fmtDateTime(run.ranAt)}
                <span className="text-xs">({run.trigger === "MANUAL" ? "manual" : "agendado"})</span>
              </span>
              <span className="flex items-center gap-1.5 text-green-700">
                <IconCheck className="h-4 w-4" /> {run.passCount} OK
              </span>
              <span className="flex items-center gap-1.5 text-red-600">
                <IconX className="h-4 w-4" /> {run.failCount} falhas
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <IconMinus className="h-4 w-4" /> {run.skipCount} ignorados
              </span>
              <span className="text-muted-foreground">Duração: {fmtDuration(run.durationMs)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-category results */}
      {run && run.failCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <IconAlertTriangle className="h-4 w-4 flex-shrink-0" />
          {run.failCount} verificação(ões) falharam — a integração correspondente pode estar quebrada.
          Passe o mouse sobre cada falha para ver o erro retornado pelo Secullum.
        </div>
      )}

      {grouped.map((group) => {
        const groupFails = group.checks.filter((c) => c.status === "FAIL").length;
        return (
          <Card key={group.category}>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{group.label}</span>
                {groupFails > 0 ? (
                  <Badge variant="failed">{groupFails} falha(s)</Badge>
                ) : (
                  <Badge variant="approved">OK</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[55%]">Verificação</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[90px] text-right">Tempo</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.checks.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell>
                        <StatusPill status={c.status} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {fmtDuration(c.durationMs)}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                        {c.errorMessage ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={c.status === "FAIL" ? "text-red-600 cursor-help" : "cursor-help"}>
                                  {c.errorMessage}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm break-words">
                                {c.errorMessage}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
