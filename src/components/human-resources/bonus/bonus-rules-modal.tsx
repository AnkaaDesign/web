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
} from "@tabler/icons-react";

interface BonusRulesModalProps {
  open: boolean;
  onClose: () => void;
  highlightReference?: string;
}

function detectSection(ref?: string): string | null {
  if (!ref) return null;
  const lower = ref.toLowerCase();
  if (lower.includes("falta")) return "faltas";
  if (lower.includes("atestado")) return "atestado";
  if (lower.includes("assiduidade")) return "assiduidade";
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

function TierTable({ rows }: { rows: [string, string, boolean][] }) {
  return (
    <div className="rounded-md border border-border overflow-hidden text-xs mt-1">
      <div className="grid grid-cols-3 bg-muted/60 font-medium text-foreground">
        <div className="px-3 py-1.5 border-r border-border">Horas</div>
        <div className="px-3 py-1.5 border-r border-border">Desconto do Bônus</div>
        <div className="px-3 py-1.5">Assiduidade</div>
      </div>
      {rows.map(([hours, discount, keepsAssiduidade], i) => (
        <div
          key={i}
          className="grid grid-cols-3 border-t border-border odd:bg-muted/10 even:bg-muted/25"
        >
          <div className="px-3 py-1.5 border-r border-border">{hours}</div>
          <div className={cn("px-3 py-1.5 border-r border-border font-semibold", discount === "0%" ? "text-emerald-600" : "text-destructive")}>{discount}</div>
          <div className={cn("px-3 py-1.5 font-semibold", keepsAssiduidade ? "text-emerald-600" : "text-destructive")}>
            {keepsAssiduidade ? "Mantém" : "Perde"}
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
                A cada dia útil do período com o <strong className="text-foreground">ponto eletrônico completo</strong> (4 batidas: entrada, saída almoço, retorno almoço, saída), o colaborador acumula <strong className="text-foreground">+1% de bônus</strong>.
              </p>
              <p>
                Qualquer falta ou atestado acima de 02:00h <strong className="text-destructive">zera todo o bônus de assiduidade</strong>.
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
              icon={IconCalendarOff}
              title="Faltas ou Atrasos sem Justificativa"
              badge="Desconto"
              badgeClassName="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
              highlighted={highlighted === "faltas"}
            >
              <p>Ausências e atrasos não justificados.</p>
              <TierTable
                rows={[
                  ["Nenhuma", "0%", true],
                  ["até 02:00h", "-25%", false],
                  ["02:00h – 08:00h", "-50%", false],
                  ["Maior 08:00h", "-100%", false],
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
                Afastamentos por atestado médico. Atestados curtos (até 02:00h) não geram nenhuma penalidade.
              </p>
              <TierTable
                rows={[
                  ["até 02:00h", "0%", true],
                  ["02:00h – 08:00h", "0%", false],
                  ["08:00h – 16:00h", "-25%", false],
                  ["16:00h – 25:00h", "-50%", false],
                  ["Maior 25:00h", "-100%", false],
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
