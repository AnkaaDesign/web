// web/src/components/cliente/solicitacao/nova-tinta-dialog.tsx
//
// CADASTRAR A COR DE DENTRO DO COMBOBOX DE PINTURA.
//
// Mesmo desenho do cadastro de cliente: a cor que o catálogo não tem é descrita
// aqui e viaja no payload (`novaTinta` de §5), com o MÍNIMO que
// `POST /paints` exige — `{ name, hex, finish, paintTypeId }`. Quem cria a
// tinta de verdade é o servidor, dentro da mesma transação da requisição.
//
// ⚠️ Este diálogo NÃO é o `PaintQuickCreateDialog` do sistema interno. Aquele
// faz `POST /paints` pelo `apiClient` do FUNCIONÁRIO — no portal ele mandaria
// (ou deixaria de mandar) o bearer errado e receberia 401.
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { IconPalette } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { PAINT_FINISH, PAINT_FINISH_LABELS } from "@/constants";
import { listarTiposDeTinta } from "./solicitacao-api";
import { novaTintaSchema, type NovaTintaFormData } from "./solicitacao-schema";

interface NovaTintaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialValues?: NovaTintaFormData | null;
  onConfirm: (data: NovaTintaFormData) => void;
}

const HEX_FALLBACK = "#1F2937";

export function NovaTintaDialog({
  open,
  onOpenChange,
  initialName,
  initialValues,
  onConfirm,
}: NovaTintaDialogProps) {
  const form = useForm<NovaTintaFormData>({
    resolver: zodResolver(novaTintaSchema),
    mode: "onTouched",
    defaultValues: { name: "", hex: HEX_FALLBACK, finish: PAINT_FINISH.SOLID, paintTypeId: "" },
  });

  const { data: paintTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ["portal", "paint-types"],
    queryFn: listarTiposDeTinta,
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      initialValues ?? {
        name: initialName ?? "",
        hex: HEX_FALLBACK,
        finish: PAINT_FINISH.SOLID,
        paintTypeId: "",
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName]);

  const finishOptions = useMemo(
    () =>
      Object.values(PAINT_FINISH).map((finish) => ({
        value: finish,
        label: PAINT_FINISH_LABELS[finish],
      })),
    [],
  );

  const typeOptions = useMemo(
    () => paintTypes.map((t) => ({ value: t.id, label: t.name })),
    [paintTypes],
  );

  const hex = form.watch("hex");

  const handleConfirm = form.handleSubmit((data) => {
    onConfirm(data);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPalette className="h-5 w-5" />
            Cadastrar cor
          </DialogTitle>
          <DialogDescription>
            A cor é criada junto com a requisição. Informe o nome, a cor aproximada, o acabamento
            e o tipo de tinta.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Nome da cor</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value ?? ""}
                      onChange={(value) => field.onChange(value ?? "")}
                      onBlur={field.onBlur}
                      placeholder="Ex.: Azul Frota"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Cor aproximada</FormLabel>
                  <div className="flex items-center gap-3">
                    {/* Seletor nativo: o portal abre muito no celular, onde o
                        seletor do sistema é melhor que qualquer roda desenhada
                        — e não custa nenhum KB de bundle. */}
                    <input
                      type="color"
                      aria-label="Escolher a cor"
                      value={/^#[0-9A-Fa-f]{6}$/.test(field.value ?? "") ? field.value : HEX_FALLBACK}
                      onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                      className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent p-1"
                    />
                    <FormControl>
                      <Input
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(String(value ?? "").toUpperCase())}
                        onBlur={field.onBlur}
                        placeholder="#1F2937"
                        maxLength={7}
                        className="flex-1"
                      />
                    </FormControl>
                    <span
                      aria-hidden
                      className="h-10 w-10 shrink-0 rounded-md border border-border"
                      style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(hex ?? "") ? hex : HEX_FALLBACK }}
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="finish"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Acabamento</FormLabel>
                  <Combobox
                    value={field.value || ""}
                    onValueChange={(value) => field.onChange(value ?? "")}
                    options={finishOptions}
                    placeholder="Selecione o acabamento"
                    searchPlaceholder="Buscar acabamento..."
                    emptyText="Nenhum acabamento"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paintTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Tipo de tinta</FormLabel>
                  <Combobox
                    value={field.value || ""}
                    onValueChange={(value) => field.onChange(value ?? "")}
                    options={typeOptions}
                    placeholder={loadingTypes ? "Carregando..." : "Selecione o tipo de tinta"}
                    searchPlaceholder="Buscar tipo..."
                    emptyText="Nenhum tipo de tinta disponível"
                    disabled={loadingTypes}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleConfirm()}>
            Usar esta cor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
