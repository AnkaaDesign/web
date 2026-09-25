// web/src/components/cliente/assinatura-card.tsx
//
// UM ENVELOPE ESPERANDO A ASSINATURA DESTA PESSOA.
//
// O cartão é um DOCUMENTO, não um formulário: número do orçamento, o recorte que
// esta pessoa recebeu, os veículos cobertos, a folha, e um botão. Tudo o que se
// digita aqui cabe num campo só — e é o do ⛔ PORTÃO DO COMPRAS.
//
// ── O PORTÃO DO COMPRAS (§7) ────────────────────────────────────────────────
//
// Responsável cujo ÚNICO papel é `PURCHASING` só assina se o veículo tiver
// número de pedido de compra. A régua é `roles.length === 1 && roles[0] ===
// 'PURCHASING'` — quem acumula Compras com Comercial, Vendedor, Representante ou
// Coordenador NÃO é barrado.
//
// ⛔ E QUEM APLICA A RÉGUA É O SERVIDOR, NÃO ESTE ARQUIVO. `pedidoDeCompra`
// chega pronto em cada pendência: `exigido` (o papel único), `pendente` (o
// veredito sobre TODOS os veículos do envelope) e `mensagem` (a frase literal do
// 403). A versão anterior deste cartão recalculava o veredito aqui, e para isso
// precisava da frota inteira do cliente — `GET /cliente/me/veiculos?take=500`,
// filtrada no navegador por `vehicle.budget.id`. Eram 358 linhas para responder
// sobre 4, um 400 do teto de `take`, e duas réguas que podiam divergir.
//
// ⚠️ A TELA NUNCA CONTRADIZ O SERVIDOR, e agora nem tem como: ela DESENHA o
// veredito dele. O que sobra de decisão local é `podeAssinarAqui` — a cerimônia
// antiga, por código, que se resolve no link pessoal e não aqui.
import { useMemo } from "react";
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
import { PORTAL_CAPABILITY, hasPortalCapability } from "@/utils/portal-capabilities";
import { formatDate } from "@/utils";
import { AssinaturaDocumento } from "./assinatura-documento";
import { PedidoCompraField } from "./pedido-compra-field";

/**
 * A MENSAGEM DO PORTÃO — o recuo, e só o recuo.
 *
 * O servidor manda a frase em `pedidoDeCompra.mensagem`, e é ela que a tela
 * imprime: as duas não podem divergir por uma vírgula. Esta constante fica como
 * texto de reserva para o caso de o veredito chegar bloqueado e sem frase, e
 * continua exportada porque o teste de tela a cita.
 */
export const COMPRAS_GATE_MESSAGE = "Informe o número do pedido de compra antes de assinar.";

export interface AssinaturaCardProps {
  assinatura: PortalPendingSignature;
  /** Os papéis DESTE contato — decidem se o campo de conserto aparece. */
  roles: string[];
  /** Documento aberto? A expansão é ÚNICA — quem manda é a página. */
  expanded: boolean;
  onToggleExpanded: () => void;
  signing: boolean;
  onSign: () => void;
}

export function AssinaturaCard({
  assinatura,
  roles,
  expanded,
  onToggleExpanded,
  signing,
  onSign,
}: AssinaturaCardProps) {
  /**
   * Os veículos DESTE envelope, ditos pelo próprio envelope.
   *
   * ⚠️ Vazio significa "você não vê isto" quando o recorte não tem `VEHICLE`, e
   * não "o orçamento não tem veículos". Quem responde a segunda pergunta é
   * `pedidoDeCompra.pendente`, julgado no servidor sobre a lista COMPLETA.
   */
  const veiculos = assinatura.veiculos ?? [];

  /** Os que ainda não têm número — a escrita dupla conta dos dois lados. */
  const semPedido = useMemo(
    () =>
      veiculos.filter(
        (veiculo) =>
          !veiculo.purchaseOrder?.number?.trim() && !veiculo.customerOrderNumber?.trim(),
      ),
    [veiculos],
  );

  const gate = assinatura.pedidoDeCompra;
  const comprasGateFechado = !!gate?.pendente;
  const canWritePurchaseOrder = hasPortalCapability(
    roles,
    PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER,
  );

  /**
   * O servidor é soberano, e desta vez literalmente: `podeAssinarAqui` é a
   * cerimônia (uma coleta antiga, por código, se resolve no link pessoal) e
   * `pedidoDeCompra.pendente` é o portão. A tela não acrescenta condição própria.
   */
  const podeAssinar = assinatura.podeAssinarAqui && !comprasGateFechado;

  /** Os veículos que o campo do portão vai carimbar. */
  const alvoDoPedido = semPedido.length ? semPedido : veiculos;

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
                    <span className="text-sm text-muted-foreground">
                      {numero ? `Pedido ${numero}` : "Sem pedido de compra"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ── O PORTÃO DO COMPRAS ─────────────────────────────────────────
            Faixa âmbar com a mensagem LITERAL que o servidor mandou e, logo
            abaixo, o campo que a resolve. */}
        {comprasGateFechado && (
          <Alert variant="warning">
            <AlertDescription className="space-y-3">
              <p className="font-medium text-foreground">
                {gate?.mensagem || COMPRAS_GATE_MESSAGE}
              </p>
              <p className="text-sm">
                Seu cadastro tem <strong>Compras</strong> como única função, e nessa função a
                assinatura depende do número do pedido de compra do veículo. Informe-o aqui e o
                botão de assinar libera.
              </p>

              {alvoDoPedido.length === 0 ? (
                // O servidor diz que falta pedido e o recorte não deixa listar
                // os veículos: não há o que carimbar daqui. Dizer isso é melhor
                // do que oferecer um campo que não tem onde gravar.
                <p className="text-sm">
                  Não foi possível identificar os veículos deste orçamento. Fale com a Ankaa para
                  registrar o pedido de compra.
                </p>
              ) : canWritePurchaseOrder ? (
                <PedidoCompraField
                  id={`pedido-${assinatura.signerId}`}
                  taskIds={alvoDoPedido.map((veiculo) => veiculo.taskId)}
                  label={
                    alvoDoPedido.length === 1
                      ? "Número do pedido de compra"
                      : `Número do pedido de compra (vale para os ${alvoDoPedido.length} veículos)`
                  }
                />
              ) : (
                <p className="text-sm">
                  Peça a quem emite os pedidos de compra da sua empresa para registrar o número.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* A CERIMÔNIA É OUTRA — uma coleta emitida por código, que se assina
            pelo link pessoal. Ela aparece na fila de propósito: escondê-la faria
            o portal dizer "nada esperando por você" enquanto um orçamento
            espera. O que não se pode é oferecer aqui um botão que o servidor
            recusaria. */}
        {!assinatura.podeAssinarAqui && !comprasGateFechado && (
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
          className="w-full"
          size="lg"
          disabled={!podeAssinar || signing}
          // Dica nativa no botão desabilitado: o motivo aparece no hover mesmo
          // desabilitado, e a faixa acima já o diz por extenso.
          title={comprasGateFechado ? gate?.mensagem || COMPRAS_GATE_MESSAGE : undefined}
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
