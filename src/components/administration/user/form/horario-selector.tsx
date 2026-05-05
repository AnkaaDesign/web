import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { IconCalendarTime } from "@tabler/icons-react";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecullumHorarios } from "@/hooks/integrations/use-secullum-mapping";
import { useSector } from "@/hooks";

type HorarioOption = {
  Id: number;
  Numero: number;
  Descricao: string;
  Tipo?: string;
  Desativar?: boolean;
};

const toHorarioArray = (v: unknown): HorarioOption[] => {
  if (Array.isArray(v)) return v as HorarioOption[];
  if (v && typeof v === "object" && Array.isArray((v as any).data)) {
    return (v as any).data as HorarioOption[];
  }
  return [];
};

/**
 * Per-user override for Secullum HorarioId. Visible only when the
 * "Criar / sincronizar no Secullum" switch is ON. When left empty, the
 * bridge falls back to the user's Sector.secullumHorarioId, then to 1.
 *
 * The dropdown is pre-filled with the sector's default horario as a hint
 * but the operator can override it on a per-user basis.
 */
export function HorarioSelector({ disabled }: { disabled?: boolean }) {
  const form = useFormContext();
  const horariosQ = useSecullumHorarios();

  // Subscribe to syncEnabled and sectorId so we can react to them.
  const syncEnabled = useWatch({ control: form.control, name: "secullumSyncEnabled" });
  const sectorId = useWatch({ control: form.control, name: "sectorId" });
  const currentValue = useWatch({ control: form.control, name: "secullumHorarioId" });

  // Pull the selected sector to surface its default horario as a hint.
  const sectorQ = useSector(sectorId, { include: {} } as any);
  const sectorDefault = (sectorQ?.data as any)?.data?.secullumHorarioId as
    | number
    | null
    | undefined;

  // When switch flips ON and the field is empty but sector has a default,
  // pre-fill so the user doesn't have to pick again.
  useEffect(() => {
    if (
      syncEnabled &&
      (currentValue == null || currentValue === undefined) &&
      sectorDefault != null
    ) {
      form.setValue("secullumHorarioId", sectorDefault, { shouldDirty: false });
    }
  }, [syncEnabled, sectorDefault, currentValue, form]);

  if (!syncEnabled) return null;

  return (
    <FormField
      control={form.control}
      name="secullumHorarioId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconCalendarTime className="h-4 w-4" />
            Horário Secullum
          </FormLabel>
          {horariosQ.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <FormControl>
              <Select
                value={field.value != null ? String(field.value) : ""}
                onValueChange={(v) =>
                  field.onChange(v === "" ? null : Number(v))
                }
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um horário Secullum" />
                </SelectTrigger>
                <SelectContent>
                  {toHorarioArray(horariosQ.data)
                    .filter((h) => !h.Desativar)
                    .map((h) => (
                      <SelectItem key={h.Id} value={String(h.Id)}>
                        #{h.Numero} — {h.Descricao} ({h.Tipo})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormControl>
          )}
          <FormDescription className="text-xs">
            {sectorDefault != null
              ? `Padrão do setor: #${sectorDefault}. Você pode sobrescrever para este usuário.`
              : "Nenhum padrão definido no setor — selecione manualmente. Recomendado: ajuste o padrão do setor na página de Mapeamento."}
          </FormDescription>
        </FormItem>
      )}
    />
  );
}
