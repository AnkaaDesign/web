/**
 * Nº do pedido de compra na cerimônia de assinatura.
 *
 * Só aparece para quem assina pelo setor de COMPRAS do cliente: o servidor
 * manda `orderNumber` apenas para esse signatário, e só aceita a assinatura
 * dele quando cada veículo do orçamento tem o pedido — o que já estava na
 * tarefa, ou o que ele informa aqui. O pedido é UM SÓ para o orçamento: um
 * campo único vale para todos os veículos, e quando algum veículo já tem o
 * número registrado os demais o herdam no servidor — não há o que digitar. A regra de verdade é a do servidor
 * (`api/.../signature/order-number-gate.ts`); esta tela a espelha para que a
 * exigência apareça ANTES do botão, e não como um erro depois do código.
 *
 * Número já registrado pela Ankaa é exibido e não é editável: pode já estar
 * numa nota emitida, e trocá-lo não é assunto de uma página pública.
 */

import { Input } from "@/components/ui/input";
import type { PublicOrderNumberGate } from "@/api-client/signature";

/** Mesmo teto e mesmos caracteres do servidor (`orderNumberProblem`). */
const ORDER_NUMBER_PATTERN = /^[\p{L}\p{N} .\-/#_]+$/u;

export function normalizeOrderNumber(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function problemOf(value: string, maxLength: number): string | null {
  if (!value) return "Informe o nº do pedido de compra.";
  if (value.length > maxLength) return `Máximo de ${maxLength} caracteres.`;
  if (!ORDER_NUMBER_PATTERN.test(value) || !/[\p{L}\p{N}]/u.test(value))
    return "Use só letras, números, espaço e . - / # _";
  return null;
}

/** Veículos que ainda estão sem número. */
export function missingOrderVehicles(gate: PublicOrderNumberGate | null | undefined) {
  return (gate?.vehicles ?? []).filter(v =>
    typeof v.hasNumber === "boolean" ? !v.hasNumber : !normalizeOrderNumber(v.value),
  );
}

/**
 * O que vai no corpo do `sign`: o MESMO número em cada veículo sem número.
 * Vazio quando nada precisa ser digitado (tudo registrado, ou herança do
 * número já registrado — o servidor replica sozinho).
 */
export function orderNumberPayload(
  gate: PublicOrderNumberGate | null | undefined,
  value: string,
): Array<{ taskId: string; value: string }> {
  if (!gate?.required) return [];
  const typed = normalizeOrderNumber(value);
  return missingOrderVehicles(gate).map(v => ({ taskId: v.taskId, value: typed }));
}

/** Pendência na mesma linguagem da recusa do servidor; `null` quando pronto. */
export function orderNumberClientProblem(
  gate: PublicOrderNumberGate | null | undefined,
  value: string,
): string | null {
  if (!gate?.required) return null;
  return problemOf(normalizeOrderNumber(value), gate.maxLength);
}

export function OrderNumberFields({
  gate,
  value,
  onChange,
  disabled,
}: {
  gate: PublicOrderNumberGate;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const missing = missingOrderVehicles(gate);
  const total = gate.vehicles.length;
  const registered = Array.from(
    new Set(gate.vehicles.map(v => normalizeOrderNumber(v.value)).filter(Boolean)),
  );
  // Número único já registrado: é o pedido do orçamento; nada a digitar.
  const shown = gate.inherited ?? (missing.length === 0 && registered.length === 1 ? registered[0] : null);

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-left">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Nº do pedido de compra{gate.required ? <span className="text-destructive"> *</span> : null}
        </p>
        {gate.required ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Como você assina pelo setor de compras, a assinatura só é concluída com o nº do
            pedido de compra{total > 1 ? `, que vale para os ${total} veículos` : ""}. Ele sai
            impresso na nota fiscal e no boleto.
          </p>
        ) : null}
      </div>

      {shown ? (
        <p className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
          <span>{total > 1 ? `Registrado para os ${total} veículos` : "Registrado"}</span>
          <span className="font-medium text-foreground">{shown}</span>
        </p>
      ) : registered.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {gate.vehicles
            .filter(v => normalizeOrderNumber(v.value))
            .map(v => (
              <li key={v.taskId} className="flex flex-wrap justify-between gap-x-3">
                <span>{v.label}</span>
                <span className="font-medium text-foreground">{v.value}</span>
              </li>
            ))}
        </ul>
      ) : null}

      {gate.required && (
        <Input
          id="order-number"
          aria-label="Nº do pedido de compra"
          className="h-11 text-base"
          placeholder="Ex.: 4500123456"
          maxLength={gate.maxLength}
          autoComplete="off"
          value={value}
          onChange={next => onChange(String(next ?? ""))}
          disabled={disabled}
        />
      )}
    </div>
  );
}
