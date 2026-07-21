import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  IconInfoCircle,
  IconTrendingUp,
  IconTrendingDown,
  IconCalendarOff,
  IconHeartbeat,
  IconCheckbox,
  IconBan,
} from "@tabler/icons-react";

interface BonusRulesModalProps {
  open: boolean;
  onClose: () => void;
  highlightReference?: string;
}

function detectSection(ref?: string): string | null {
  if (!ref) return null;
  const lower = ref.toLowerCase();
  // Check "atestado" BEFORE "falta": the label "Faltas - Atestado" contains both,
  // and it must highlight the Atestado rule, not the generic Faltas one.
  if (lower.includes("atestado")) return "atestado";
  if (lower.includes("falta")) return "faltas";
  if (lower.includes("assiduidade")) return "assiduidade";
  if (lower.includes("suspensa") || lower.includes("suspens")) return "suspensas";
  return null;
}

function Section({
  icon: Icon,
  title,
  badge,
  badgeClassName,
  children,
  highlighted,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  badgeClassName?: string;
  children: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        highlighted ? "border-primary bg-primary/5" : "border-border bg-muted/30"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold">{title}</span>
        {badge && (
          <span className={cn("ml-auto text-xs font-medium px-2 py-0.5 rounded-full", badgeClassName)}>
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-2.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

// Assiduidade cell: "Mantém" keeps the full extra (green); anything else is a
// graded loss (red) — "Perde o dia" (−1%), "−50%" or "−100%".
function TierTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="rounded-md border border-border overflow-hidden text-xs mt-1">
      <div className="grid grid-cols-3 bg-muted/60 font-medium text-foreground">
        <div className="px-3 py-1.5 border-r border-border">Horas</div>
        <div className="px-3 py-1.5 border-r border-border">Desconto do Bônus</div>
        <div className="px-3 py-1.5">Assiduidade</div>
      </div>
      {rows.map(([hours, discount, assiduidade], i) => (
        <div
          key={i}
          className="grid grid-cols-3 border-t border-border odd:bg-muted/10 even:bg-muted/25"
        >
          <div className="px-3 py-1.5 border-r border-border">{hours}</div>
          <div className={cn("px-3 py-1.5 border-r border-border font-semibold", discount === "0%" ? "text-emerald-600" : "text-destructive")}>{discount}</div>
          <div className={cn("px-3 py-1.5 font-semibold", assiduidade === "Mantém" ? "text-emerald-600" : "text-destructive")}>
            {assiduidade}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BonusRulesModal({ open, onClose, highlightReference }: BonusRulesModalProps) {
  const highlighted = detectSection(highlightReference);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconInfoCircle className="h-5 w-5 text-primary" />
            Regras de Extras e Descontos
          </DialogTitle>
          <DialogDescription>
            Como extras e descontos são calculados no bônus mensal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">

          {/* Assiduidade */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-3">
              <IconTrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              Extra
            </p>
            <Section
              icon={IconCheckbox}
              title="Assiduidade"
              badge="+% sobre o bônus"
              badgeClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              highlighted={highlighted === "assiduidade"}
            >
              <p>
                A assiduidade é <strong className="text-foreground">somada (+1% por dia útil)</strong> sempre que o colaborador <strong className="text-foreground">não solicita nenhuma correção</strong>, <strong className="text-foreground">não deixa de registrar nenhuma batida</strong> e <strong className="text-foreground">não tem atrasos</strong> — ou seja, o dia tem o <strong className="text-foreground">ponto eletrônico completo</strong> (4 batidas: entrada, saída almoço, retorno almoço, saída).
              </p>
            </Section>
          </div>

          <Separator />

          {/* Descontos */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <IconTrendingDown className="h-3.5 w-3.5 text-destructive" />
              Descontos
            </p>

            <Section
              icon={IconBan}
              title="Tarefas Suspensas"
              badge="Excluído do cálculo"
              badgeClassName="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
              highlighted={highlighted === "suspensas"}
            >
              <p>
                Quando uma tarefa é marcada com <strong className="text-foreground">bonificação suspensa</strong>, ela é <strong className="text-destructive">removida do cálculo do bônus</strong>.
              </p>
              <p className="text-xs italic">
                Tarefas com <strong className="text-foreground">bonificação integral</strong> contam como 1.0 e <strong className="text-foreground">bonificação parcial</strong> conta como 0.5 na ponderação. <strong className="text-foreground">Sem bonificação</strong> e <strong className="text-foreground">suspensa</strong> contam como 0.
              </p>
            </Section>

            <Section
              icon={IconCalendarOff}
              title="Faltas ou Atrasos sem Justificativa"
              badge="Desconto"
              badgeClassName="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
              highlighted={highlighted === "faltas"}
            >
              <p>Ausências e atrasos não justificados.</p>
              <TierTable
                rows={[
                  ["Nenhuma", "0%", "Mantém"],
                  ["até 02:00h", "0%", "Perde o dia"],
                  ["02:00h – 04:00h", "-25%", "-50%"],
                  ["04:00h – 08:00h", "-50%", "-100%"],
                  ["Maior 08:00h", "-100%", "-100%"],
                ]}
              />
            </Section>

            <Section
              icon={IconHeartbeat}
              title="Atestado Médico"
              badge="Desconto / Perdoado"
              badgeClassName="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              highlighted={highlighted === "atestado"}
            >
              <p>
                Afastamentos por atestado médico. Atestados curtos (até 02:00h) não geram nenhuma penalidade — mantêm o bônus e a assiduidade.
              </p>
              <TierTable
                rows={[
                  ["até 02:00h", "0%", "Mantém"],
                  ["02:00h – 04:00h", "0%", "Perde o dia"],
                  ["04:00h – 08:00h", "-25%", "-50%"],
                  ["08:00h – 25:00h", "-50%", "-100%"],
                  ["Maior 25:00h", "-100%", "-100%"],
                ]}
              />
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 px-3 py-2 text-emerald-700 dark:text-emerald-400 text-xs mt-1">
                <strong>Regra de perdão:</strong> se o colaborador não teve nenhum atestado nos <strong>90 dias anteriores</strong> ao período, todo o desconto e a perda de assiduidade são automaticamente cancelados. Aparece como "perdoado" na tela.
              </div>
            </Section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
