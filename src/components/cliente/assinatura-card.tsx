// web/src/components/cliente/assinatura-card.tsx
//
// UM ENVELOPE ESPERANDO A ASSINATURA DESTA PESSOA.
//
// O cartão é um DOCUMENTO, não um formulário: número do orçamento, o recorte que
// esta pessoa recebeu, os veículos cobertos, a folha, e um botão. Tudo o que se
// digita aqui cabe num campo só — o do Nº DO PEDIDO DE COMPRA.
//
// ── O Nº DO PEDIDO (DD12.1) ─────────────────────────────────────────────────
//
// Quem TEM a função Compras (mesmo acumulando outras) só assina com o pedido do
// orçamento. O pedido é UM SÓ para o orçamento: havendo um número único já
// registrado, os veículos sem número o herdam e nada se digita; sem ele, o
// signatário informa um número, o mesmo para todos, NO PRÓPRIO ATO de assinar
// (`orderNumbers` no corpo). É a mesma regra e o mesmo campo da página pública
// (`OrderNumberFields`), e quem julga é o servidor (`orderNumber` em cada
// pendência). A tela só impede o clique enquanto o campo obrigatório está vazio
// ou inválido — a recusa, se vier, é a frase do servidor.
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconFileText,
  IconLoader2,
  IconSignature,
} from "@tabler/icons-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalCard } from "./portal-detail";
import { Separator } from "@/components/ui/separator";
import type { PortalPendingSignature } from "@/api-client/portal";
import { formatDate } from "@/utils";
import {
  OrderNumberFields,
  orderNumberClientProblem,
} from "@/components/public/signature/order-number-fields";
import { AssinaturaDocumento } from "./assinatura-documento";

export interface AssinaturaCardProps {
  assinatura: PortalPendingSignature;
  /** Documento aberto? A expansão é ÚNICA — quem manda é a página. */
  expanded: boolean;
  onToggleExpanded: () => void;
  signing: boolean;
  /** O nº do pedido digitado neste cartão (DD12.1). Quem guarda é a página. */
  orderValue: string;
  onOrderValueChange: (value: string) => void;
  onSign: () => void;
}

export function AssinaturaCard({
  assinatura,
  expanded,
  onToggleExpanded,
  signing,
  orderValue,
  onOrderValueChange,
  onSign,
}: AssinaturaCardProps) {
  /**
   * Os veículos DESTE envelope, ditos pelo próprio envelope.
   *
   * ⚠️ Vazio significa "você não vê isto" quando o recorte não tem `VEHICLE`, e
   * não "o orçamento não tem veículos". O pedido é julgado pelo servidor sobre a
   * lista COMPLETA (`orderNumber`), não sobre esta.
   */
  const veiculos = assinatura.veiculos ?? [];

  const gate = assinatura.orderNumber;
  /** Falta o nº do pedido e o campo ainda não o tem num formato aceito. */
  const pedidoProblema = orderNumberClientProblem(gate, orderValue);

  /**
   * `podeAssinarAqui` é a cerimônia (uma coleta antiga, por código, se resolve
   * no link pessoal); o pedido só segura o botão enquanto o campo obrigatório
   * está vazio ou inválido.
   */
  const podeAssinar = assinatura.podeAssinarAqui && !pedidoProblema;

  /**
   * O rótulo do recorte vem PRONTO do servidor (`documento.label`).
   *
   * Compô-lo aqui a partir de `sections` obrigava a tela a conhecer a mesma
   * tabela de nomes que o PDF usa — e `describeSections([])` devolve "Somente
   * texto básico", que é uma AFIRMAÇÃO sobre o documento que um servidor calado
   * nunca fez.
   */
  const recorte = assinatura.documento?.label || null;
  const prazo = assinatura.envelope?.deadlineAt ?? null;
  const total = assinatura.total ?? null;

  return (
    // ⛔ ERA O TERCEIRO `<Card>` CRU DO PORTAL, e divergia exatamente onde mais
    // se nota: o título era um `<h2 className="text-base font-semibold">` à
    // mão, enquanto `CardTitle` — o corpo de letra de TODO card desta casa — é
    // `text-base font-medium`. Era o mesmo defeito que já custou a fusão dos
    // moldes (ver `components/cliente/portal-detail.tsx`), sobrevivendo neste
    // arquivo. E era o único cartão de seção do portal SEM ícone no cabeçalho.
    <PortalCard
      icon={IconSignature}
      title={`Orçamento nº ${assinatura.envelope?.budgetNumber ?? "—"}`}
      description={
        recorte || prazo || total
          ? [
              recorte,
              // Segue o recorte: `null` para quem não recebeu `PRICING`, e já
              // formatado em reais pelo servidor.
              total,
              prazo ? `válido até ${formatDate(prazo)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      actions={<Badge variant="pending">Aguardando sua assinatura</Badge>}
      contentClassName="space-y-4"
    >
      <>
        {/* ── Os veículos ─────────────────────────────────────────────────
            Aparecem SEMPRE que o recorte os libera, e não só quando o portão
            fecha: é aqui que a pessoa confere que está assinando pelo implemento
            certo, e é a mesma lista que o número do pedido vai carimbar. */}
        {veiculos.length > 0 && (
          // ⚠️ `bg-muted/50` SEM BORDA — a superfície do `DetailRow` da casa
          // (`ui/detail-row.tsx:69-74`, `rounded-lg` + `bg-muted/50`). Este
          // painel era `border border-border bg-muted/30`: contorno SOBRE
          // preenchimento, e num terceiro tom de cinza. O portal tinha três
          // (`/30` aqui, `/40` no aviso de recusa, `/50` no termo), e é o tipo
          // de diferença que só aparece quando dois deles caem na mesma tela.
          <div className="rounded-lg bg-muted/50 px-4 py-3">
            {/* Rótulo em `text-sm`: rótulo não pode ser menor que o conteúdo
                ao lado (§10), e o conteúdo abaixo é `text-sm`. */}
            <p className="mb-2 text-sm text-muted-foreground">
              {veiculos.length === 1 ? "Veículo" : `Veículos (${veiculos.length})`}
            </p>
            <ul className="space-y-1.5">
              {veiculos.map((veiculo) => {
                const numero =
                  veiculo.purchaseOrder?.number?.trim() ||
                  veiculo.customerOrderNumber?.trim() ||
                  null;
                return (
                  <li
                    key={veiculo.taskId}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm"
                  >
                    <span className="font-medium text-foreground">{veiculo.label}</span>
                    {gate ? (
                      <span className="text-sm text-muted-foreground">
                        {numero ? `Pedido ${numero}` : "Sem pedido de compra"}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ── O Nº DO PEDIDO (DD12.1) ──────────────────────────────────────
            Só para quem tem Compras. Com pedido único já registrado o campo
            mostra o número herdado e não pede nada. */}
        {gate && assinatura.podeAssinarAqui && (
          <OrderNumberFields
            gate={gate}
            value={orderValue}
            onChange={onOrderValueChange}
            disabled={signing}
          />
        )}

        {/* A CERIMÔNIA É OUTRA — uma coleta emitida por código, que se assina
            pelo link pessoal. Ela aparece na fila de propósito: escondê-la faria
            o portal dizer "nada esperando por você" enquanto um orçamento
            espera. O que não se pode é oferecer aqui um botão que o servidor
            recusaria. */}
        {!assinatura.podeAssinarAqui && (
          <Alert variant="warning">
            <AlertDescription>
              <span className="flex items-start gap-2">
                <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Este documento foi enviado para assinatura por{" "}
                  <strong>código de uso único</strong>, no link pessoal que você recebeu — e é por
                  lá que ele se assina. Se você não tem mais o link, fale com a Ankaa.
                </span>
              </span>
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* ── O DOCUMENTO ──────────────────────────────────────────────────
            Montado só quando ABERTO, e a expansão é única (a página guarda
            qual): cada folha é uma busca de PDF inteiro, e três cartões
            abertos seriam três downloads antes de a pessoa olhar o primeiro. */}
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
          >
            <span className="flex items-center gap-2">
              <IconFileText className="h-4 w-4" />
              {expanded ? "Ocultar documento" : "Ver o documento"}
            </span>
            {expanded ? (
              <IconChevronUp className="h-4 w-4" />
            ) : (
              <IconChevronDown className="h-4 w-4" />
            )}
          </Button>
          {expanded && (
            <AssinaturaDocumento signerId={assinatura.signerId} version={assinatura.status} />
          )}
        </div>

        <Button
          className="h-12 w-full"
          size="lg"
          disabled={!podeAssinar || signing}
          // Dica nativa no botão desabilitado: o motivo aparece no hover mesmo
          // desabilitado, e a faixa acima já o diz por extenso.
          title={pedidoProblema ?? undefined}
          onClick={onSign}
        >
          {signing ? (
            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : podeAssinar ? (
            <IconCheck className="mr-2 h-4 w-4" />
          ) : (
            <IconExternalLink className="mr-2 h-4 w-4" />
          )}
          Revisar e assinar
        </Button>
      </>
    </PortalCard>
  );
}
