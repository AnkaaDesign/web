/**
 * O PRODUTO CARTESIANO placas × números de série — os veículos que a criação de
 * um orçamento vai gravar.
 *
 * A tela de criação aceita N placas e N números de série e cria uma tarefa para
 * cada combinação; o orçamento cobre todas. Esta função é a ÚNICA definição
 * dessa regra: o passo 1 a usa para dizer quantas tarefas nascerão, e o submit
 * a usa para montá-las. Duas cópias deslizariam no primeiro ajuste — e o
 * sintoma (um dado gravado no caminhão errado) só apareceria na nota fiscal.
 */

export interface VehicleCombination {
  plate?: string;
  serialNumber?: string;
}

export function vehicleCombinations(
  plates: readonly string[] | null | undefined,
  serialNumbers: readonly (string | number)[] | null | undefined,
): VehicleCombination[] {
  const p = (plates ?? []).filter((x) => String(x ?? "").trim() !== "");
  const s = (serialNumbers ?? []).filter((x) => String(x ?? "").trim() !== "");
  const out: VehicleCombination[] = [];
  if (p.length > 0 && s.length > 0) {
    for (const plate of p) for (const sn of s) out.push({ plate, serialNumber: String(sn) });
  } else if (p.length > 0) {
    for (const plate of p) out.push({ plate });
  } else if (s.length > 0) {
    for (const sn of s) out.push({ serialNumber: String(sn) });
  } else {
    out.push({});
  }
  return out;
}

/** Quantos veículos as placas e séries digitadas produzem. */
export function vehicleCombinationCount(
  plates: readonly string[] | null | undefined,
  serialNumbers: readonly (string | number)[] | null | undefined,
): number {
  return vehicleCombinations(plates, serialNumbers).length;
}
