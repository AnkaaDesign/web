// web/src/components/cliente/pedido-compra-field.tsx
//
// O CAMPO DO NÚMERO DO PEDIDO DE COMPRA — e o conserto no lugar.
//
// Existe para o ⛔ PORTÃO DO COMPRAS (§7 do contrato): o contato cujo ÚNICO
// papel é `PURCHASING` só assina se o veículo tiver número de pedido. Quando o
// portão fecha, mandar a pessoa para outra tela e depois de volta seria desenhar
// um beco: ela está com o documento aberto, sabe o número de cor, e a única
// coisa que falta é digitá-lo. Então o campo aparece ALI, dentro do cartão da
// assinatura barrada.
//
// ⚠️ NÃO é rota nova. É o mesmo `POST /cliente/me/pedidos` do §4, com os
// `taskIds` dos veículos que estão sem número — o mesmo endereço que a tela de
// Pedidos usa. Um caminho só para um ato só.
//
// ── Duplicata não é erro ────────────────────────────────────────────────────
//
// A unicidade é por (cliente, número) — `@@unique([customerId, number])`.
// Digitar um número que já existe é o caso NORMAL ("esses três também são do
// 8842"), e a tela diz exatamente isso ANTES de enviar, trocando o rótulo do
// botão para "Adicionar ao pedido 8842". Tratar como erro obrigaria a pessoa a
// inventar um número novo por lote, que é o oposto do que um pedido de compra é.
import { useState } from "react";
import { IconLoader2, IconPlus, IconShoppingCartPlus } from "@tabler/icons-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { portalErrorMessage, usePortalCreatePurchaseOrder } from "@/api-client/portal";
import { usePortalPedidoPorNumero } from "./usar-pedido-por-numero";

export interface PedidoCompraFieldProps {
  /** Os veículos que receberão o número. Vazio desabilita o envio. */
  taskIds: string[];
  /** Chamado depois de gravar, para quem quiser reagir além da invalidação. */
  onSaved?: () => void;
  /** Rótulo do campo. O padrão serve ao portão da assinatura. */
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function PedidoCompraField({
  taskIds,
  onSaved,
  label = "Número do pedido de compra",
  disabled = false,
  id = "numero-pedido-compra",
}: PedidoCompraFieldProps) {
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  // A mutation já invalida TODO o cache do portal no sucesso — a fila de
  // assinaturas volta com `pedidoDeCompra.pendente: false` sem que esta tela
  // precise saber disso.
  const createPedido = usePortalCreatePurchaseOrder();

  const trimmed = number.trim();

  /**
   * O pedido que já existe com este número — PERGUNTADO ao servidor.
   *
   * ⛔ Este componente recebia a LISTA INTEIRA de pedidos do cliente por prop,
   * e a tela que a montava pedia `?take=500` para tê-la (400, pelo teto de 100).
   * Reconhecer duplicata é uma pergunta pontual — "existe um pedido com ESTE
   * número?" —, e a resposta certa é um `WHERE`, não um universo carregado por
   * precaução. Ver `usar-pedido-por-numero.ts`.
   */
  const existente = usePortalPedidoPorNumero(trimmed);

  const busy = createPedido.isPending;
  const canSubmit = !disabled && !busy && trimmed.length > 0 && taskIds.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await createPedido.mutateAsync({ number: trimmed, taskIds });
      setNumber("");
      onSaved?.();
    } catch (e) {
      // O interceptor de `api-client/portal.ts` JÁ toastou. Isto é a cópia
      // inline, no lugar onde a pessoa digitou — a mesma doutrina da cerimônia
      // pública, que mantém `stepError` sob o campo mesmo com o toast ligado:
      // um toast some em 8 segundos, e o campo que causou o erro fica.
      setError(portalErrorMessage(e, "Não foi possível gravar o número do pedido."));
    }
  };

  return (
    <div className="space-y-2">
      {/* Rótulo em `text-sm`, do mesmo tamanho do `Input` ao lado — §10: rótulo
          não pode ser menor que o controle ao lado. */}
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          value={number}
          // ⚠️ `Input` entrega o VALOR, não o evento (§10). `Textarea` é que
          // entrega o evento — a troca é o erro mais barato de cometer aqui.
          onChange={(value) => {
            setError(null);
            setNumber(String(value ?? ""));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Ex.: 8842"
          disabled={disabled || busy}
          className="sm:flex-1"
          autoComplete="off"
        />
        <Button onClick={() => void submit()} disabled={!canSubmit} className="shrink-0">
          {busy ? (
            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : existente ? (
            <IconPlus className="mr-2 h-4 w-4" />
          ) : (
            <IconShoppingCartPlus className="mr-2 h-4 w-4" />
          )}
          {existente ? `Adicionar ao pedido ${existente.number}` : "Gravar pedido"}
        </Button>
      </div>

      {existente ? (
        <p className="text-sm text-muted-foreground">
          Este pedido já existe
          {existente.veiculos?.length
            ? ` e cobre ${existente.veiculos.length} ${existente.veiculos.length === 1 ? "veículo" : "veículos"}`
            : ""}
          .{" "}
          {taskIds.length === 1 ? "O veículo será acrescentado" : "Os veículos serão acrescentados"} a
          ele.
        </p>
      ) : null}

      {error ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
