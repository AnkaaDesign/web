import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  IconArrowDown,
  IconBrain,
  IconCalendarTime,
  IconCheck,
  IconCoin,
  IconFileInvoice,
  IconScale,
  IconTargetArrow,
  IconUserCircle,
  IconWand,
  IconX,
} from "@tabler/icons-react";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import { getConfidenceBadgeVariant } from "./match-status-badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSES: {
  step: string;
  title: string;
  description: string;
  icon: TablerIcon;
  color: string;
  outcome: string;
  outcomeVariant: "auto" | "manual";
}[] = [
  {
    step: "Etapa 1",
    title: "CNPJ + valor equivalentes",
    description:
      "Quando o CNPJ do fornecedor bate exatamente e o valor da saída está dentro de ±R$ 0,50 da nota fiscal (tolerância única que cobre taxa de PIX, arredondamento e ajustes), o pareamento é confirmado automaticamente — mesmo que a data esteja distante, porque pagamentos B2B costumam atrasar semanas. O CNPJ pode vir do extrato OFX ou de uma associação memo → CNPJ aprendida. Se houver mais de uma nota igualmente equivalente, vence a mais próxima da data (com pelo menos 30 dias de vantagem).",
    icon: IconTargetArrow,
    color: "blue",
    outcome: "Conciliação automática",
    outcomeVariant: "auto",
  },
  {
    step: "Etapa 2",
    title: "Pareamento por score",
    description:
      "Quando o valor não bate dentro da tolerância de R$ 0,50, o sistema calcula uma pontuação somando valor + data + CNPJ + razão social. Aceita também filiais da mesma empresa (mesma raiz de CNPJ). Útil para casos onde múltiplos sinais fracos somados indicam um match claro.",
    icon: IconScale,
    color: "indigo",
    outcome: "Auto se score ≥ 90 e vantagem ≥ 8 sobre o 2º colocado",
    outcomeVariant: "auto",
  },
  {
    step: "Etapa 3",
    title: "Candidatas sugeridas",
    description:
      "Quando nenhum dos critérios acima fecha um match automático, o sistema lista as notas mais plausíveis ordenadas por score. A janela é ampliada (até 60 dias para CNPJ conhecido) para acomodar prazos B2B. Você confirma manualmente — e o sistema aprende para a próxima vez.",
    icon: IconWand,
    color: "violet",
    outcome: "Lista exibida no diálogo de conciliação manual",
    outcomeVariant: "manual",
  },
];

const SCORE_PARTS: {
  icon: TablerIcon;
  title: string;
  max: number;
  color: string;
  bullets: { label: string; points: string }[];
}[] = [
  {
    icon: IconCoin,
    title: "Valor",
    max: 35,
    color: "emerald",
    bullets: [
      { label: "Equivalente (Δ ≤ R$ 0,50)", points: "35 pts" },
      { label: "Variação ≤ 0,5%", points: "25 pts" },
      { label: "Variação ≤ 1%", points: "18 pts" },
      { label: "Variação ≤ 2%", points: "10 pts" },
      { label: "Variação ≤ 5%", points: "4 pts" },
    ],
  },
  {
    icon: IconCalendarTime,
    title: "Data",
    max: 20,
    color: "blue",
    bullets: [
      { label: "Até 1 dia", points: "20 pts" },
      { label: "Até 3 dias", points: "17 pts" },
      { label: "Até 5 dias", points: "14 pts" },
      { label: "Até 10 dias", points: "10 pts" },
      { label: "Até 20 dias", points: "5 pts" },
      { label: "Até 30 dias", points: "2 pts" },
    ],
  },
  {
    icon: IconFileInvoice,
    title: "CNPJ / CPF",
    max: 30,
    color: "indigo",
    bullets: [
      { label: "CNPJ idêntico", points: "30 pts" },
      { label: "Mesma raiz (filial)", points: "24 pts" },
      { label: "Inferido pelo histórico", points: "23 a 30 pts" },
      { label: "Sem correspondência", points: "0 pts" },
    ],
  },
  {
    icon: IconUserCircle,
    title: "Razão social",
    max: 15,
    color: "violet",
    bullets: [
      { label: "Similaridade ≥ 80%", points: "15 pts" },
      { label: "Similaridade ≥ 60%", points: "12 pts" },
      { label: "Similaridade ≥ 40%", points: "8 pts" },
      { label: "Qualquer coincidência", points: "5 pts" },
    ],
  },
];

const CONFIDENCE_RANGES: {
  range: string;
  label: string;
  score: number;
  description: string;
}[] = [
  { range: "100", label: "Perfeito", score: 100, description: "Ponte de boleto confirmada" },
  { range: "90–99", label: "Alta", score: 95, description: "Pareamento automático permitido" },
  { range: "60–89", label: "Boa", score: 75, description: "Candidata forte — revisão recomendada" },
  { range: "30–59", label: "Média", score: 45, description: "Possível, mas verificar manualmente" },
  { range: "0–29", label: "Fraca", score: 15, description: "Apenas indício de proximidade" },
];

const GUARDRAILS: { icon: TablerIcon; title: string; description: string }[] = [
  {
    icon: IconScale,
    title: "Diferença obrigatória",
    description:
      "A melhor candidata precisa estar pelo menos 8 pontos à frente da segunda. Empate técnico bloqueia o auto-pareamento.",
  },
  {
    icon: IconBrain,
    title: "Aprendizado por memo",
    description:
      "Quando um pareamento é confirmado, o sistema guarda a associação memo → CNPJ. Em transações futuras com o mesmo memo, sugere a contraparte aprendida.",
  },
  {
    icon: IconX,
    title: "Tributos e tarifas",
    description:
      "DARF, IOF, tarifas e tributos não são apresentados como candidatos: a recomendação é marcar como Ignorado.",
  },
];

const colorClasses: Record<
  string,
  { bg: string; border: string; text: string; badgeBg: string }
> = {
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-300/60 dark:border-emerald-500/30",
    text: "text-emerald-900 dark:text-emerald-200",
    badgeBg: "bg-emerald-600",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-300/60 dark:border-blue-500/30",
    text: "text-blue-900 dark:text-blue-200",
    badgeBg: "bg-blue-600",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    border: "border-indigo-300/60 dark:border-indigo-500/30",
    text: "text-indigo-900 dark:text-indigo-200",
    badgeBg: "bg-indigo-600",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-500/10",
    border: "border-violet-300/60 dark:border-violet-500/30",
    text: "text-violet-900 dark:text-violet-200",
    badgeBg: "bg-violet-600",
  },
};

export function ScoringWorkflowDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="space-y-3 pb-2">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <IconBrain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Como funciona a conciliação</DialogTitle>
              <DialogDescription className="mt-0.5">
                Cada saída bancária é confrontada com as notas fiscais recebidas em 3 etapas.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-md border border-blue-300/60 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-3.5 py-2.5 text-sm text-blue-900 dark:text-blue-200">
            <IconArrowDown className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              A conciliação considera apenas <strong>débitos</strong> — saídas de
              dinheiro (pagamentos a fornecedores). Créditos não entram nesse fluxo.
            </p>
          </div>
        </DialogHeader>

        {/* Step 1: pipeline */}
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold tabular-nums text-muted-foreground">1.</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Fluxo de pareamento
            </h3>
          </div>
          <div className="space-y-2">
            {PASSES.map(pass => {
              const c = colorClasses[pass.color];
              const Icon = pass.icon;
              return (
                <div
                  key={pass.step}
                  className={`rounded-lg border ${c.border} ${c.bg} p-4`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${c.badgeBg} text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {pass.step}
                        </span>
                        <h4 className={`text-sm font-semibold ${c.text}`}>{pass.title}</h4>
                      </div>
                      <p className="mt-1 text-sm text-foreground/80 leading-relaxed">
                        {pass.description}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {pass.outcomeVariant === "auto" ? (
                          <IconCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <IconWand className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                        )}
                        <span className="text-xs font-medium text-foreground/70">
                          {pass.outcome}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Step 2: score breakdown */}
        <section className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold tabular-nums text-muted-foreground">2.</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pontuação (0 a 100)
              </h3>
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Cada candidata recebe pontos em quatro critérios. A soma define a confiança
              exibida no badge ao lado da nota.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 mb-3">
            {SCORE_PARTS.map(part => {
              const c = colorClasses[part.color];
              const Icon = part.icon;
              return (
                <div
                  key={part.title}
                  className="rounded-lg border border-border/60 bg-card p-3"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-md ${c.bg} ${c.border} border p-1.5`}>
                        <Icon className={`h-4 w-4 ${c.text}`} />
                      </div>
                      <span className="text-sm font-semibold">{part.title}</span>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                      até {part.max} pts
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {part.bullets.map(b => (
                      <li
                        key={b.label}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-foreground/80">{b.label}</span>
                        <span className="font-semibold text-foreground/90 tabular-nums">
                          {b.points}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* "Inferido pelo histórico" explainer — this row is the only one in the
              score table whose value depends on past confirmations, so it needs
              its own breakdown. */}
          <div className="rounded-lg border border-indigo-300/60 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 p-4">
            <div className="flex items-start gap-2 mb-3">
              <IconBrain className="h-4 w-4 text-indigo-700 dark:text-indigo-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                  O que é "Inferido pelo histórico"
                </p>
                <p className="text-xs text-indigo-900/80 dark:text-indigo-200/80 leading-relaxed mt-1">
                  Quando o extrato bancário não traz o CNPJ do fornecedor, o sistema
                  pode reaproveitar a associação <strong>descrição → CNPJ</strong>{" "}
                  aprendida em conciliações anteriores. Quanto mais vezes essa
                  associação foi confirmada (e quanto mais "humana" foi a origem),
                  mais pontos ela vale.
                </p>
              </div>
            </div>
            <ul className="space-y-1 text-xs">
              {[
                { label: "Confirmado manualmente (3+ vezes)", pts: "30 pts" },
                { label: "Cadastrado por administrador", pts: "~29 pts" },
                { label: "Confirmado manualmente (1–2 vezes)", pts: "27 pts" },
                { label: "Aprendido automaticamente (5+ vezes)", pts: "~26 pts" },
                { label: "Aprendido automaticamente (2–4 vezes)", pts: "~23 pts" },
                { label: "Aprendido só 1 vez por automação", pts: "0 pts (não promove)" },
              ].map(row => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 py-1 border-b border-indigo-300/30 dark:border-indigo-500/20 last:border-0"
                >
                  <span className="text-indigo-900/90 dark:text-indigo-100/90">
                    {row.label}
                  </span>
                  <span className="font-semibold text-indigo-900 dark:text-indigo-100 tabular-nums">
                    {row.pts}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Step 3: confidence legend */}
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold tabular-nums text-muted-foreground">3.</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Legenda dos badges
            </h3>
          </div>
          <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
            {CONFIDENCE_RANGES.map((r, idx) => (
              <div
                key={r.range}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${
                  idx !== CONFIDENCE_RANGES.length - 1 ? "border-b border-border/40" : ""
                }`}
              >
                <Badge
                  variant={getConfidenceBadgeVariant(r.score)}
                  className="min-w-[72px] justify-center tabular-nums"
                >
                  {r.range}
                </Badge>
                <span className="font-medium w-20 flex-shrink-0">{r.label}</span>
                <span className="text-xs text-muted-foreground flex-1">
                  {r.description}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Step 4: guardrails */}
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold tabular-nums text-muted-foreground">4.</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cuidados do sistema
            </h3>
          </div>
          <div className="space-y-2">
            {GUARDRAILS.map(g => {
              const Icon = g.icon;
              return (
                <div
                  key={g.title}
                  className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/30 p-3"
                >
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{g.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {g.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold tabular-nums text-muted-foreground">5.</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Como o sistema aprende com você
            </h3>
          </div>
          <div className="rounded-lg border border-violet-300/60 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <IconBrain className="h-4 w-4 text-violet-700 dark:text-violet-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-violet-900 dark:text-violet-100 leading-relaxed">
                <strong>Bancos quase nunca enviam o CNPJ do fornecedor no extrato.</strong>{" "}
                A maioria dos débitos chega só com uma descrição como{" "}
                <code className="rounded bg-violet-200/40 dark:bg-violet-500/20 px-1 py-0.5 text-[11px]">
                  PIX FORN ACME LTDA
                </code>
                . Sem CNPJ, o motor não tem como pontuar a contraparte — então, na
                primeira aparição de um fornecedor novo, a conciliação{" "}
                <strong>sempre será manual</strong>.
              </p>
            </div>

            <ol className="space-y-2 text-xs text-violet-900/90 dark:text-violet-100/90 list-decimal list-inside pl-1">
              <li>
                <strong>1ª vez:</strong> você concilia manualmente a transação com a
                nota correta.
              </li>
              <li>
                <strong>Sistema aprende:</strong> guarda a associação{" "}
                <code className="rounded bg-violet-200/40 dark:bg-violet-500/20 px-1 py-0.5 text-[10px]">
                  descrição → CNPJ
                </code>{" "}
                com selo de confirmação manual.
              </li>
              <li>
                <strong>Próximas vezes:</strong> quando a mesma descrição aparece, o
                sistema reaplica o CNPJ aprendido e tenta auto-conciliar — incluindo
                a regra de "valor + CNPJ perfeitos, data irrelevante".
              </li>
            </ol>

            <div className="rounded-md border border-violet-300/40 dark:border-violet-500/20 bg-white/60 dark:bg-violet-950/30 p-3 text-xs text-violet-900/90 dark:text-violet-100/90">
              <strong className="text-violet-900 dark:text-violet-100">
                Trava de segurança:
              </strong>{" "}
              uma associação descoberta automaticamente (sem confirmação humana) vale{" "}
              <strong>zero pontos</strong> até ser confirmada manualmente. Isso impede
              que o sistema reforce um erro próprio em cadeia.
            </div>
          </div>
        </section>

        <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Resumo:</strong> são auto-conciliadas
          apenas as saídas que casam por <strong className="text-foreground">CNPJ
          exato + valor dentro de R$ 0,50</strong> da NFe, ou que somam{" "}
          <strong className="text-foreground">score ≥ 90</strong> com vantagem clara
          sobre alternativas. O resto vira sugestão manual — e cada confirmação sua
          ensina o sistema para a próxima vez.
        </div>
      </DialogContent>
    </Dialog>
  );
}
