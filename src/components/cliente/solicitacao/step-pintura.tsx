// web/src/components/cliente/solicitacao/step-pintura.tsx
//
// PASSO 4 — A COR GERAL E OS ARQUIVOS-BASE.
//
// `Budget` NÃO tem campo de tinta: a cor geral mora em `Task.paintId`
// (`generalPainting`), uma por veículo da requisição. A cor que o catálogo não
// tem é descrita no diálogo e viaja em `novaTinta`.
//
// ⚠️ OS ARQUIVOS NÃO SOBEM SOZINHOS. `FileCardUploadField` é um PICKER — ele
// entrega os `File` e nunca faz POST. E no portal não há `POST /files` para
// chamar antes: os blobs viajam no MESMO POST da requisição, campo `baseFiles`
// (contrato §5), que é o que `portalService.requestBudget` monta. O caminho de
// faixa de série do sistema interno, além disso, DESCARTA os arquivos que
// recebe (§5, armadilha 5) — mais uma razão para não reusá-lo.
import { useCallback, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { IconPaint, IconPencil, IconPhoto } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCardUploadField, type FileWithPreview } from "@/components/common/file";
import { PAINT_FINISH_LABELS } from "@/constants";
import type { PAINT_FINISH } from "@/constants";
import { NovaTintaDialog } from "./nova-tinta-dialog";
import { buscarTintasDoPortal, type PortalPaintOption } from "./solicitacao-api";
import {
  MAX_BASE_FILES,
  NOVA_TINTA_VALUE,
  type NovaTintaFormData,
  type SolicitacaoFormData,
} from "./solicitacao-schema";

interface StepPinturaProps {
  disabled?: boolean;
  baseFiles: FileWithPreview[];
  onBaseFilesChange: (files: FileWithPreview[]) => void;
  /** Alimenta o cache de nomes que o Resumo lê — ver `solicitar.tsx`. */
  onPaintsSeen?: (options: PortalPaintOption[]) => void;
}

const ACCEPTED_BASE_FILES = {
  "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg"],
  "application/pdf": [".pdf"],
  "application/postscript": [".eps", ".ai"],
};

export function SolicitacaoStepPintura({
  disabled,
  baseFiles,
  onBaseFilesChange,
  onPaintsSeen,
}: StepPinturaProps) {
  const { control, setValue } = useFormContext<SolicitacaoFormData>();
  const paintId = useWatch({ control, name: "paintId" });
  const novaTinta = useWatch({ control, name: "novaTinta" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogName, setDialogName] = useState("");
  const pendingCreateResolve = useRef<((option: PortalPaintOption | null) => void) | null>(null);

  /** A opção sintética da cor que ainda não existe no catálogo. */
  const opcaoNovaTinta = useMemo<PortalPaintOption | null>(() => {
    if (!novaTinta) return null;
    return {
      id: NOVA_TINTA_VALUE,
      name: novaTinta.name,
      hex: novaTinta.hex,
      finish: novaTinta.finish,
    };
  }, [novaTinta]);

  const initialOptions = useMemo(
    () => (opcaoNovaTinta ? [opcaoNovaTinta] : []),
    [opcaoNovaTinta],
  );

  const queryFn = useCallback(
    async (search: string, page = 1) => {
      const result = await buscarTintasDoPortal(search, page);
      // A cor em cadastro obedece ao texto buscado. ⚠️ O combobox só oferece
      // "Cadastrar cor" quando a busca não devolve NADA — empurrar um item fixo
      // em toda busca apagaria essa opção da tela.
      const termo = (search ?? "").trim().toLowerCase();
      const extras =
        opcaoNovaTinta &&
        (!termo || opcaoNovaTinta.name.toLowerCase().includes(termo)) &&
        !result.data.some((p) => p.id === opcaoNovaTinta.id)
          ? [opcaoNovaTinta]
          : [];
      const options = [...extras, ...result.data];
      onPaintsSeen?.(options);
      return { data: options, hasMore: result.hasMore };
    },
    [opcaoNovaTinta, onPaintsSeen],
  );

  const handleCreateRequested = useCallback((searchText: string) => {
    setDialogName(searchText);
    setDialogOpen(true);
    return new Promise<PortalPaintOption | null>((resolve) => {
      pendingCreateResolve.current = resolve;
    });
  }, []);

  const handleNovaTintaConfirmada = useCallback(
    (data: NovaTintaFormData) => {
      setValue("novaTinta", data, { shouldDirty: true, shouldValidate: true });
      setValue("paintId", NOVA_TINTA_VALUE, { shouldDirty: true, shouldValidate: true });
      pendingCreateResolve.current?.({
        id: NOVA_TINTA_VALUE,
        name: data.name,
        hex: data.hex,
        finish: data.finish,
      });
      pendingCreateResolve.current = null;
    },
    [setValue],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open && pendingCreateResolve.current) {
      pendingCreateResolve.current(null);
      pendingCreateResolve.current = null;
    }
  }, []);

  const handlePaintChange = useCallback(
    (value: string | null) => {
      setValue("paintId", value, { shouldDirty: true, shouldValidate: true });
      if (value !== NOVA_TINTA_VALUE) {
        // Trocar por uma cor do catálogo descarta o rascunho — senão o payload
        // levaria `paintId` E `novaTinta`, que o schema recusa.
        setValue("novaTinta", null, { shouldDirty: true, shouldValidate: true });
      }
    },
    [setValue],
  );

  const handleFilesChange = useCallback(
    (files: FileWithPreview[]) => onBaseFilesChange(files),
    [onBaseFilesChange],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconPaint className="h-5 w-5" />
            Pintura geral
          </CardTitle>
          <CardDescription>
            A cor do veículo como um todo. Se a cor não estiver na lista, cadastre pela opção
            "Cadastrar cor" dentro da própria lista — ela é criada junto com a requisição.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={control}
            name="paintId"
            render={() => (
              <FormItem>
                <FormLabel>Cor</FormLabel>
                <Combobox<PortalPaintOption>
                  value={paintId ?? ""}
                  onValueChange={(next) =>
                    handlePaintChange(typeof next === "string" && next ? next : null)
                  }
                  mode="single"
                  async
                  queryKey={["portal", "paints", "solicitacao"]}
                  queryFn={queryFn}
                  initialOptions={initialOptions}
                  getOptionLabel={(paint) => paint.name}
                  getOptionValue={(paint) => paint.id}
                  placeholder="Selecione ou cadastre a cor"
                  searchPlaceholder="Pesquisar cor..."
                  emptyText="Nenhuma cor encontrada"
                  disabled={disabled}
                  clearable
                  minSearchLength={0}
                  debounceMs={400}
                  pageSize={20}
                  allowCreate
                  createLabel={(text) => `Cadastrar cor "${text}"`}
                  onCreate={(text: string) =>
                    handleCreateRequested(text) as Promise<PortalPaintOption>
                  }
                  renderOption={(paint) => (
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        className="h-5 w-5 shrink-0 rounded ring-1 ring-border"
                        style={{ backgroundColor: paint.hex || "#888888" }}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{paint.name}</span>
                        <span className="truncate text-sm opacity-70">
                          {[
                            paint.paintType?.name,
                            paint.finish
                              ? PAINT_FINISH_LABELS[paint.finish as PAINT_FINISH]
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Sem detalhes"}
                        </span>
                      </div>
                    </div>
                  )}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {novaTinta && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-border p-3">
              <span
                aria-hidden
                className="h-8 w-8 shrink-0 rounded ring-1 ring-border"
                style={{ backgroundColor: novaTinta.hex }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{novaTinta.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {PAINT_FINISH_LABELS[novaTinta.finish as PAINT_FINISH] ?? novaTinta.finish} ·{" "}
                  {novaTinta.hex}
                </p>
              </div>
              <Badge variant="secondary">Será cadastrada no envio</Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  setDialogName(novaTinta.name);
                  setDialogOpen(true);
                }}
              >
                <IconPencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <IconPhoto className="h-5 w-5" />
                Arquivos-base
              </CardTitle>
              <CardDescription>
                Fotos do veículo, logomarcas, referências de layout — o que ajudar a entender o
                que você quer. Até {MAX_BASE_FILES} arquivos, enviados junto com a requisição.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {baseFiles.length} de {MAX_BASE_FILES}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <FileCardUploadField
            variant="card"
            showStatus={false}
            maxFiles={MAX_BASE_FILES}
            acceptedFileTypes={ACCEPTED_BASE_FILES}
            existingFiles={baseFiles}
            onFilesChange={handleFilesChange}
            disabled={disabled}
            placeholder="Arraste as imagens aqui ou clique para escolher"
            label="Arquivos-base"
          />
        </CardContent>
      </Card>

      <NovaTintaDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        initialName={dialogName}
        initialValues={novaTinta ?? null}
        onConfirm={handleNovaTintaConfirmada}
      />
    </div>
  );
}
