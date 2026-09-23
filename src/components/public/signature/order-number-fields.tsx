/**
 * Nº do pedido de compra na cerimônia de assinatura.
 *
 * Só aparece para quem assina pelo setor de COMPRAS do cliente: o servidor
 * manda `orderNumber` apenas para esse signatário, e só aceita a assinatura
 * dele quando cada veículo do orçamento tem o pedido — o que já estava na
 * tarefa, ou o que ele informa aqui. A regra de verdade é a do servidor
 * (`api/.../signature/order-number-gate.ts`); esta tela a espelha para que a
 * exigência apareça ANTES do botão, e não como um erro depois do código.
 *
 * Número já registrado pela Ankaa é exibido e não é editável: pode já estar
 * numa nota emitida, e trocá-lo não é assunto de uma página pública.
 */

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/** Veículos que o signatário precisa preencher. */
export function missingOrderVehicles(gate: PublicOrderNumberGate | null | undefined) {
  return (gate?.vehicles ?? []).filter(v => !normalizeOrderNumber(v.value));
}

/** O que vai no corpo do `sign` — só os veículos que estão sem número. */
export function orderNumberPayload(
  gate: PublicOrderNumberGate | null | undefined,
  values: Record<string, string>,
  sameForAll: boolean,
): Array<{ taskId: string; value: string }> {
  const missing = missingOrderVehicles(gate);
  const shared = normalizeOrderNumber(values.__all);
  return missing.map(v => ({
    taskId: v.taskId,
    value: sameForAll && missing.length > 1 ? shared : normalizeOrderNumber(values[v.taskId]),
  }));
}

/** Primeira pendência, na mesma linguagem da recusa do servidor; `null` quando pronto. */
export function orderNumberClientProblem(
  gate: PublicOrderNumberGate | null | undefined,
  values: Record<string, string>,
  sameForAll: boolean,
): string | null {
  if (!gate?.required) return null;
  const missing = missingOrderVehicles(gate);
  const payload = orderNumberPayload(gate, values, sameForAll);
  for (const row of payload) {
    const problem = problemOf(row.value, gate.maxLength);
    if (!problem) continue;
    if (missing.length > 1 && !sameForAll) {
      const label = missing.find(v => v.taskId === row.taskId)?.label ?? "Veículo";
      return `${label}: ${problem}`;
    }
    return problem;
  }
  return null;
}

export function OrderNumberFields({
  gate,
  values,
  onChange,
  sameForAll,
  onSameForAllChange,
  disabled,
}: {
  gate: PublicOrderNumberGate;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  sameForAll: boolean;
  onSameForAllChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const missing = missingOrderVehicles(gate);
  const registered = gate.vehicles.filter(v => normalizeOrderNumber(v.value));
  const multi = missing.length > 1;

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-left">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Nº do pedido de compra{gate.required ? <span className="text-destructive"> *</span> : null}
        </p>
        {gate.required ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Como você assina pelo setor de compras, a assinatura só é concluída com o nº do
            pedido de compra{multi ? " de cada veículo" : ""}. Ele sai impresso na nota fiscal e
            no boleto.
          </p>
        ) : null}
      </div>

      {registered.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {registered.map(v => (
            <li key={v.taskId} className="flex flex-wrap justify-between gap-x-3">
              <span>{gate.vehicles.length > 1 ? v.label : "Registrado"}</span>
              <span className="font-medium text-foreground">{v.value}</span>
            </li>
          ))}
        </ul>
      )}

      {missing.length > 0 && (
        <>
          {multi && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={sameForAll}
                onCheckedChange={v => onSameForAllChange(v === true)}
                disabled={disabled}
              />
              <span>Mesmo pedido para os {missing.length} veículos</span>
            </label>
          )}

          {multi && !sameForAll ? (
            <div className="space-y-2">
              {missing.map(v => (
                <div key={v.taskId} className="space-y-1">
                  <Label htmlFor={`order-${v.taskId}`} className="text-xs">
                    {v.label}
                  </Label>
                  <Input
                    id={`order-${v.taskId}`}
                    className="h-11 text-base"
                    placeholder="Ex.: 4500123456"
                    maxLength={gate.maxLength}
                    autoComplete="off"
                    value={values[v.taskId] ?? ""}
                    onChange={next => onChange(v.taskId, String(next ?? ""))}
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Input
              id="order-all"
              aria-label="Nº do pedido de compra"
              className="h-11 text-base"
              placeholder="Ex.: 4500123456"
              maxLength={gate.maxLength}
              autoComplete="off"
              value={(multi ? values.__all : values[missing[0].taskId]) ?? ""}
              onChange={next => onChange(multi ? "__all" : missing[0].taskId, String(next ?? ""))}
              disabled={disabled}
            />
          )}
        </>
      )}
    </div>
  );
}
