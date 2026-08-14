import type { ReactNode } from "react";
import { useFormContext, useWatch, useFormState } from "react-hook-form";
import { AirbrushingFields, type AirbrushingFieldErrors, type AirbrushingFieldValues, type AirbrushingPainterRef } from "./airbrushing-fields";

interface AirbrushingFormFieldsProps {
  control: any;
  disabled?: boolean;
  initialPainter?: AirbrushingPainterRef;
  /**
   * Whether the current user may see monetary/payment information.
   * Gate for `price` + toda a configuração de pagamento — derivado do canônico
   * `canViewAirbrushingFinancials(user)`. Quando falso, esses campos somem.
   */
  canViewFinancials?: boolean;
  /** Seletor de layouts — o rótulo e a posição são do `AirbrushingFields` (ver o slot lá). */
  layoutsSlot?: ReactNode;
}

/** Campos escalares que este bloco escreve no react-hook-form. */
const FIELD_NAMES = [
  "status",
  "paymentStatus",
  "paymentMethod",
  "dueDateRule",
  "paymentTermDays",
  "dueDayOfMonth",
  "dueDate",
  "price",
  "description",
  "startDate",
  "finishDate",
  "startedAt",
  "finishedAt",
  "painterId",
] as const;

/**
 * Adaptador react-hook-form do bloco compartilhado `AirbrushingFields`.
 *
 * O LAYOUT vive inteiro no componente compartilhado — este arquivo só liga o patch
 * `{campo: valor}` ao `setValue` e devolve as mensagens de erro do resolver. É isso que
 * mantém criação (linhas do `MultiAirbrushingSelector`, estado local) e edição (RHF)
 * pixel a pixel iguais.
 */
export function AirbrushingFormFields({ control, disabled, initialPainter, canViewFinancials = true, layoutsSlot }: AirbrushingFormFieldsProps) {
  const { setValue } = useFormContext();
  // useWatch (nunca `useState` espelhando o form): resets e refetches continuam refletidos.
  const watched = useWatch({ control }) as Record<string, any>;
  // useFormState, e não `form.formState` do contexto — o proxy do formState não assina
  // atualizações quando lido direto no render.
  const { errors } = useFormState({ control });

  const value: AirbrushingFieldValues = {};
  for (const name of FIELD_NAMES) {
    (value as Record<string, any>)[name] = watched?.[name] ?? null;
  }

  const fieldErrors: AirbrushingFieldErrors = {};
  for (const name of FIELD_NAMES) {
    const message = (errors as Record<string, any>)?.[name]?.message;
    if (typeof message === "string") fieldErrors[name] = message;
  }

  const handleChange = (patch: Partial<AirbrushingFieldValues>) => {
    for (const [name, next] of Object.entries(patch)) {
      setValue(name, next, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    }
  };

  return (
    <AirbrushingFields
      value={value}
      onChange={handleChange}
      disabled={disabled}
      canViewFinancials={canViewFinancials}
      initialPainter={initialPainter}
      idPrefix="airbrushing"
      layoutsSlot={layoutsSlot}
    />
  );
}
