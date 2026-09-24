import { useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useToast } from "@/hooks/common/use-toast";
import { airbrushingCreationRowsSchema } from "@/schemas/airbrushing";

type GuardedForm = Pick<UseFormReturn<any>, "getValues" | "setError" | "clearErrors">;

/**
 * Trava de envio das aerografias NOVAS de um formulário de criação: uma aerografia marcada como
 * "Já aprovada" precisa de aerografista.
 *
 * As linhas das aerografias são `z.array(z.any())` nos schemas de tarefa e orçamento (carregam
 * arquivos), então a regra não mora no resolver de cada formulário — ela roda aqui, pelo MESMO
 * schema zod (`airbrushingCreationRowSchema`), e publica o erro no caminho da linha
 * (`<name>.<i>.painterId`), onde o `MultiAirbrushingSelector` o mostra sob o campo Pintor.
 *
 * `names` são os campos que guardam as listas (`airbrushings` ou `vehicles.<i>.airbrushings`).
 * Devolve `true` quando pode enviar.
 */
export function useAirbrushingCreationGuard() {
  const { error } = useToast();

  return useCallback(
    (form: GuardedForm, names: string[]): boolean => {
      const messages: string[] = [];
      for (const name of names) {
        const rows = form.getValues(name as any);
        const list = Array.isArray(rows) ? rows : [];
        // Limpa o erro da tentativa anterior: sem resolver cobrindo as linhas, nada mais o apagaria.
        list.forEach((_, index) => form.clearErrors(`${name}.${index}.painterId` as any));
        const result = airbrushingCreationRowsSchema.safeParse(list);
        if (result.success) continue;
        for (const issue of result.error.issues) {
          form.setError(`${name}.${issue.path.join(".")}` as any, { type: "manual", message: issue.message });
          messages.push(issue.message);
        }
      }
      if (messages.length === 0) return true;
      error(
        messages.length > 1 ? `${messages.length} aerografias já aprovadas estão sem aerografista` : "Aerografia já aprovada sem aerografista",
        messages[0],
      );
      return false;
    },
    [error],
  );
}
