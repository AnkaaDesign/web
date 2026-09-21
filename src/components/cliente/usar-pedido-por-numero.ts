// web/src/components/cliente/usar-pedido-por-numero.ts
//
// "JÁ EXISTE UM PEDIDO COM ESTE NÚMERO?" — uma pergunta, uma consulta.
//
// ── Por que isto existe ─────────────────────────────────────────────────────
//
// Duplicata NÃO é erro no pedido de compra. A unicidade é por (cliente, número)
// — `@@unique([customerId, number])` — e digitar um número que já existe é o
// caso NORMAL: "esses três também são do 8842". As duas telas que escrevem
// pedido (o campo do portão da assinatura e o diálogo de novo pedido) dizem isso
// ANTES de enviar, trocando o rótulo do botão para "Adicionar ao pedido 8842".
//
// ⛔ E ANTES ELAS PAGAVAM O UNIVERSO POR ESSA FRASE. Cada uma recebia a lista
// INTEIRA de pedidos do cliente por prop, e a página que a montava pedia
// `GET /cliente/me/pedidos?take=500` — que o schema da borda recusa com 400,
// porque o teto é 100. Carregar todos os pedidos de um cliente para responder
// "existe ESTE?" é procurar com os olhos o que o banco responde com um índice.
//
// ── Por que a busca do servidor basta, e por que ainda se compara aqui ──────
//
// `?searchingFor=` faz `contains` — "88" casa com "8842". Então o servidor
// ESTREITA (uma página curta, não o acervo) e esta função DECIDE, com igualdade
// exata e sem caixa, que é a mesma comparação que o `@@unique` faz. Confiar só
// no `contains` faria "88" anunciar "Adicionar ao pedido 8842" para quem ainda
// estava digitando o número novo.
import { useMemo } from "react";
import {
  usePortalPurchaseOrders,
  type PortalPurchaseOrder,
} from "@/api-client/portal";

/** Comparação de número de pedido: sem espaços nas pontas e sem caixa. */
export const mesmoNumeroDePedido = (a: string, b: string) =>
  a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * O pedido que já existe com este número, ou `null`.
 *
 * ⚠️ `take: 10` e não 1: a busca é `contains`, e o exato pode não ser o
 * primeiro da página ("8842" × "18842"). Dez cabem numa resposta minúscula e
 * cobrem com folga o número de pedidos de um cliente cujos números se parecem.
 *
 * ⚠️ Sem `debounce` próprio: a consulta só é habilitada com texto, cada tecla
 * reusa o cache do react-query pela chave, e o par de recusas do portal
 * (`retry: false`) impede a cascata de tentativas. Um `debounce` aqui só
 * atrasaria a troca do rótulo do botão.
 */
export function usePortalPedidoPorNumero(numero: string): PortalPurchaseOrder | null {
  const termo = numero.trim();
  const { data } = usePortalPurchaseOrders(
    { searchingFor: termo, take: 10 },
    { enabled: termo.length > 0 },
  );

  return useMemo(() => {
    if (!termo) return null;
    return (data?.data ?? []).find((pedido) => mesmoNumeroDePedido(pedido.number, termo)) ?? null;
  }, [data, termo]);
}
