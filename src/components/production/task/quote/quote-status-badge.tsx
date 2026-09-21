import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TASK_QUOTE_STATUS } from '@/types/budget';

interface QuoteStatusBadgeProps {
  status: TASK_QUOTE_STATUS;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

/**
 * O ESTADO DO ORÇAMENTO — os cinco, e nada além.
 *
 * ⚠️ NÃO serve para faturamento. `BILLING_STATUS` é outro enum, com outros
 * valores e outros rótulos ("Vencido" ali é parcela em atraso; aqui não existe),
 * e reaproveitar este badge lá foi exatamente o que fez a lista de Faturamento
 * mostrar o ciclo do orçamento no lugar do ciclo do pagamento. Para cobrança use
 * `BillingStatusBadge`.
 */
/**
 * A FONTE ÚNICA do rótulo e da cor de cada estado do orçamento.
 *
 * Mora fora do componente porque nem todo lugar que pinta um estado pode usar um
 * `<Badge>`: o gatilho do combobox de status é um botão e precisa das classes
 * soltas. Antes havia TRÊS mapas — este, o de `budget-step-review` e o de
 * `task-detail-page` — e os três divergiram: "Assinado" saía verde na tabela e
 * verde-água nas outras duas, e "Aprovado" saía azul aqui e verde lá. O operador
 * via a mesma palavra em duas cores conforme a tela, e conforme pudesse ou não
 * editar. Quem precisar da cor pede aqui.
 */
export const QUOTE_STATUS_CONFIG: Record<TASK_QUOTE_STATUS, { label: string; variant: string }> = {
  // ⚠️ NÃO é o vermelho de `destructive`: vencer sem assinatura não é perda, é
  // trabalho voltando para a mesa do comercial. Vermelho nesta casa é parcela
  // em atraso, que é `BILLING_STATUS.OVERDUE` — noutra entidade e noutro badge.
  EXPIRED: {
    label: 'Aguardando Reanálise',
    variant: 'orange',
  },
  // ⚠️ VERDE, o MESMO de `SETTLED` no faturamento (decisão do dono, 17/09).
  //
  // Era verde-água, por um argumento que não se sustentou no uso: "verde quer
  // dizer terminou, e aqui ainda falta a nossa contra-assinatura". Na prática o
  // que o operador lê varrendo as duas telas é outra coisa — verde é o DESFECHO
  // BOM da fase daquela lista. Em Orçamentos, o desfecho bom da cerimônia é o
  // cliente ter assinado; em Faturamento, é o dinheiro ter entrado. Duas telas,
  // a mesma leitura, e nenhuma delas exige ler o rótulo.
  SIGNED: {
    label: 'Assinado',
    variant: 'completed',
  },
  // ⚠️ MESMA COR DO `PENDING` DO FATURAMENTO, por decisão do dono (17/09): a
  // mesma palavra tem de ter a mesma cor nas duas telas, senão o operador
  // aprende duas linguagens para o mesmo conceito. Era cinza (`secondary`),
  // que dizia "inerte" — e pendente não é inerte, é espera com dono.
  //
  // Foi essa troca que obrigou `EXPIRED` a sair do âmbar acima: os dois
  // ficariam idênticos, e justamente os dois que o comercial precisa separar
  // ("esperando o cliente" × "voltou para a minha mesa").
  PENDING: {
    label: 'Aguardando Assinatura',
    variant: 'pending',
  },
  // ⚠️ ROXO, cor que nenhum outro estado usa nas duas telas. Requisição é o único
  // estado em que o trabalho ainda NÃO EXISTE — não há serviço, não há valor, não
  // há documento. Dar a ele um âmbar ou um laranja o misturaria com "voltou para
  // a minha mesa", e é o oposto: nunca esteve na mesa de ninguém.
  REQUESTED: {
    label: 'Requisição',
    variant: 'purple',
  },
  // ⚠️ NÃO é da família do âmbar de `PENDING`, ainda que as duas sejam "a bola
  // está com eles": são justamente as duas que o comercial precisa separar numa
  // varredura ("negociando o preço" × "assinando o que já foi acertado"), e o
  // repositório já pagou esse preço uma vez — foi por isso que `EXPIRED` teve de
  // sair do âmbar em 17/09. Verde-água estava livre desde que `SIGNED` virou verde.
  IN_NEGOTIATION: {
    label: 'Em Negociação',
    variant: 'teal',
  },
  // Vizinho do azul de `APPROVED` de propósito: é o mesmo "acertado, seguindo",
  // um passo antes. Índigo e não `info`/`primary`, que são apelidos DEPRECADOS do
  // mesmo blue-700 de `APPROVED` — iguais na tela, e o estado sumiria dentro dele.
  PRE_APPROVED: {
    label: 'Pré-aprovado',
    variant: 'indigo',
  },
  // O ÚLTIMO estado do orçamento — daqui em diante quem anda é a COBRANÇA.
  //
  // ⚠️ AZUL, e a mesma cor do `APPROVED` do faturamento (decisão do dono,
  // 17/09). Era verde, que nesta casa quer dizer "terminou" — e aprovar o
  // orçamento não termina nada, abre a cobrança. Verde ficou reservado para
  // `SETTLED`, que é onde o dinheiro de fato entrou.
  APPROVED: {
    label: 'Aprovado',
    variant: 'processing',
  },
  CANCELLED: {
    label: 'Cancelado',
    variant: 'cancelled',
  },
};

/**
 * As classes do MESMO estado para quem não pode usar `<Badge>` — o gatilho do
 * combobox de status, que é um botão sólido com borda.
 *
 * Derivado da variante, e não uma segunda tabela de cores: trocar a variante em
 * `QUOTE_STATUS_CONFIG` troca as duas superfícies juntas, que é o que faltava.
 */
const TRIGGER_CLASS_BY_VARIANT: Record<string, string> = {
  completed: 'bg-green-700 text-white hover:bg-green-800 border-green-800',
  approved: 'bg-green-700 text-white hover:bg-green-800 border-green-800',
  green: 'bg-green-700 text-white hover:bg-green-800 border-green-800',
  processing: 'bg-blue-700 text-white hover:bg-blue-800 border-blue-800',
  pending: 'bg-amber-600 text-white hover:bg-amber-700 border-amber-700',
  expired: 'bg-amber-600 text-white hover:bg-amber-700 border-amber-700',
  orange: 'bg-orange-500 text-white hover:bg-orange-600 border-orange-600',
  cancelled: 'bg-red-700 text-white hover:bg-red-800 border-red-800',
  // Os três do portal (20/09/2026). Sem estas linhas `quoteStatusTriggerClass`
  // devolvia `''` e o GATILHO do seletor de status saía INCOLOR ao lado de um
  // badge colorido — mesma palavra, duas aparências, na mesma tela.
  //
  // ⚠️ Este mapa NÃO é derivado de `badgeVariants`: o gatilho é um `<button>` do
  // combobox e precisa de `border-*`, que o `<Badge>` não tem. Variante nova em
  // `QUOTE_STATUS_CONFIG` precisa de linha AQUI também.
  purple: 'bg-purple-600 text-white hover:bg-purple-700 border-purple-700',
  teal: 'bg-teal-500 text-white hover:bg-teal-600 border-teal-600',
  indigo: 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-700',
  secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 border-neutral-300',
};

/** Normaliza a caixa: um `"approved"` legado ainda resolve em vez de vazar cru. */
function normalizeQuoteStatus(status: unknown): TASK_QUOTE_STATUS {
  return (typeof status === 'string' ? status.toUpperCase() : status) as TASK_QUOTE_STATUS;
}

/** A variante de `<Badge>` deste estado — para quem pinta fora deste componente. */
export function quoteStatusVariant(status: unknown): string {
  return QUOTE_STATUS_CONFIG[normalizeQuoteStatus(status)]?.variant ?? 'secondary';
}

/** As classes do gatilho sólido deste estado (combobox de status). */
export function quoteStatusTriggerClass(status: unknown): string {
  return TRIGGER_CLASS_BY_VARIANT[quoteStatusVariant(status)] ?? '';
}

export function QuoteStatusBadge({ status, className, size = 'default' }: QuoteStatusBadgeProps) {
  const normalized = normalizeQuoteStatus(status);
  const { label, variant } = QUOTE_STATUS_CONFIG[normalized] || { label: 'Desconhecido', variant: 'secondary' };

  return (
    <Badge variant={variant as any} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
