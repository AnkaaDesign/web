import { useFieldArray, useWatch } from "react-hook-form";
import { useState, useRef } from "react";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IconHash, IconX } from "@tabler/icons-react";

interface SerialNumberRangeInputProps {
  control: any;
  disabled?: boolean;
}

export function SerialNumberRangeInput({ control, disabled }: SerialNumberRangeInputProps) {
  const [inputValue, setInputValue] = useState<string>("");
  const removedNumbersRef = useRef<Set<number>>(new Set());
  const justCommittedRef = useRef(false);

  // Watch the serial numbers array
  const watchedSerialNumbers = useWatch({
    control,
    name: "serialNumbers",
  });

  // Ensure serialNumbers is always an array
  const serialNumbers: number[] = Array.isArray(watchedSerialNumbers) ? watchedSerialNumbers : [];

  const { append, remove } = useFieldArray({
    control,
    name: "serialNumbers",
  });

  const handleInputChange = (value: string) => {
    // Allow only numbers and spaces
    const sanitizedValue = value.replace(/[^\d\s]/g, "");
    setInputValue(sanitizedValue);
    // Texto novo no campo ⇒ a trava do blur não vale mais: o que está aqui
    // agora ainda não foi gravado por ninguém. Ver `handleGenerateRange`.
    justCommittedRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGenerateRange("enter");
    }
  };

  /**
   * `origin` decide quem pode ser engolido pela trava.
   *
   * A trava existe para o BLUR que vem logo depois de um Enter — o Enter já
   * gravou, e o blur gravaria a mesma coisa de novo. Só que ela era consumida
   * por QUEM CHEGASSE PRIMEIRO, e quem chega primeiro em quem digita vários
   * números seguidos é o Enter do número SEGUINTE.
   *
   * O estrago não era só perder um número sim, outro não. Como o Enter engolido
   * também não limpava o campo, o número seguinte era digitado GRUDADO no que
   * ficou: 9001 ⏎ 9002 ⏎ 9003 ⏎ 9004 ⏎ produzia as tags `9001` e `90029003` —
   * um veículo com número de série que nunca existiu, e que segue dali para o
   * documento assinado e para a nota fiscal.
   */
  const handleGenerateRange = (origin: "enter" | "blur" = "blur") => {
    if (origin === "blur" && justCommittedRef.current) {
      justCommittedRef.current = false;
      return;
    }
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;

    // Split by space
    const parts = trimmedValue.split(/\s+/).filter(p => p.length > 0);

    if (parts.length === 0) return;

    // Parse numbers
    const numbers = parts.map(p => parseInt(p, 10)).filter(n => !isNaN(n) && n > 0);

    if (numbers.length === 0) return;

    let newNumbers: number[] = [];
    // Um número digitado SOZINHO é um pedido explícito; um INTERVALO é uma
    // conveniência que preenche o meio. A diferença decide quem obedece à lista
    // do que já foi removido — ver logo abaixo.
    const isRange = numbers.length > 1;

    if (numbers.length === 1) {
      // Single number case
      newNumbers = [numbers[0]];
    } else {
      // Range case: from first to last number
      const from = Math.min(...numbers);
      const to = Math.max(...numbers);

      for (let i = from; i <= to; i++) {
        newNumbers.push(i);
      }
    }

    // ─── O QUE FOI REMOVIDO À MÃO ──────────────────────────────────────────
    //
    // `removedNumbersRef` existe para o INTERVALO: quem digita "1 10", tira o 5
    // e digita "1 10" de novo não quer o 5 de volta — ele o removeu de
    // propósito, e refazer o intervalo é gesto de conveniência, não um pedido
    // pelo 5.
    //
    // Mas a lista valia para TUDO e nunca era esvaziada. Digitar o 5 sozinho,
    // depois de removê-lo, não fazia nada: sem tag, sem mensagem, sem erro — e
    // não havia como reavê-lo a não ser recarregando a tela. Corrigir um engano
    // de clique ficava impossível na própria tela que o produziu.
    //
    // Agora o número digitado SOZINHO é sempre um pedido explícito: ele entra e
    // sai da lista de removidos, para que um intervalo posterior também o
    // respeite.
    if (!isRange) removedNumbersRef.current.delete(newNumbers[0]);

    // Filter out numbers that already exist or were removed
    const numbersToAdd = newNumbers.filter(
      num => !serialNumbers.includes(num) && (!isRange || !removedNumbersRef.current.has(num))
    );

    // Add new numbers
    if (numbersToAdd.length > 0) {
      numbersToAdd.forEach(num => {
        append(num as any);
      });
      justCommittedRef.current = true;
    }

    // Clear input
    setInputValue("");
  };

  const handleRemoveBadge = (index: number) => {
    const numberToRemove = serialNumbers[index];
    removedNumbersRef.current.add(numberToRemove);
    remove(index);
  };

  return (
    <FormField
      control={control}
      name="serialNumbers"
      render={({ field }) => {
        // Ensure field.value is always an array
        const fieldValue: number[] = Array.isArray(field.value) ? field.value : [];

        return (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <IconHash className="h-4 w-4" />
              Números de Série
            </FormLabel>

            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  value={inputValue}
                  onChange={(value) => {
                    const newValue = typeof value === "string"
                      ? value
                      : (value as any)?.target?.value || "";
                    handleInputChange(newValue);
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={() => handleGenerateRange("blur")}
                  placeholder={disabled ? "Desabilitado (remova placas extras)" : "Digite um número (ex: 5) ou intervalo (ex: 5 10) e pressione Enter"}
                  disabled={disabled}
                  transparent={true}
                  className="flex-1"
                />
                {disabled && (
                  <p className="text-xs text-muted-foreground">
                    Você só pode adicionar números de série se tiver no máximo 1 placa
                  </p>
                )}
              </div>

              {fieldValue.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fieldValue.map((serialNumber: number, index: number) => (
                    <Badge
                      key={`serial-${index}-${serialNumber}`}
                      variant="secondary"
                      className="flex items-center gap-1.5 text-sm pr-1.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleRemoveBadge(index)}
                    >
                      <span>{serialNumber}</span>
                      <IconX className="h-3.5 w-3.5" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
