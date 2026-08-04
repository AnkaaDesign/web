import { useEffect, useRef, useState } from "react";
import { IconLoader2, IconTrash, IconUpload } from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import {
  useAddPaintingAnalysisFace,
  useComputePaintingAnalysis,
  useDeletePaintingAnalysisFace,
  usePaintingAnalysisMutations,
  usePaintingConfig,
  useUpdatePaintingAnalysisFace,
} from "@/hooks";
import { PAINTING_BACKGROUND_MODE_LABELS, PAINTING_FACE_VIEW_LABELS, PAINTING_REFERENCE_KIND_LABELS } from "@/types";
import type { PaintingAnalysis, PaintingAnalysisFace, PaintingBackgroundMode, PaintingFaceView, PaintingReferenceKind } from "@/types";
import { formatNumber, serveFileUrl } from "./common";

const FACE_VIEWS = Object.keys(PAINTING_FACE_VIEW_LABELS) as PaintingFaceView[];

const VIEW_OPTIONS: ComboboxOption[] = Object.entries(PAINTING_FACE_VIEW_LABELS).map(([value, label]) => ({ value, label }));
const BACKGROUND_MODE_OPTIONS: ComboboxOption[] = Object.entries(PAINTING_BACKGROUND_MODE_LABELS).map(([value, label]) => ({ value, label }));

/** Largura padrão do implemento — espelha a regra IMPLEMENT_DEFAULTS da API. */
const INFERRED_WIDTH_CM = 260;

/**
 * A calibração (px/cm) sai das medidas do implemento: lateral e teto usam o
 * comprimento; traseira e frente usam a largura inferida. Nada é redigitado por face.
 */
function referenceForView(
  view: PaintingFaceView,
  lengthCm: number | null | undefined,
  widthCm: number,
): { kind: PaintingReferenceKind; valueCm: number | null } {
  if (view === "BACK" || view === "FRONT") return { kind: "WIDTH", valueCm: widthCm };
  return { kind: "TOTAL_LENGTH", valueCm: lengthCm ?? null };
}

const BACKGROUND_MODE_HINT =
  'Arquivos de mockup raramente têm branco puro — se a chapa é branca de fábrica, selecione "Chapa Branca" e o motor deixa de orçar a pintura do fundo.';

interface FacesCardProps {
  analysis: PaintingAnalysis;
}

/**
 * Medidas do implemento editáveis no próprio passo: são elas que calibram a
 * escala das artes, então o conserto tem que estar onde o erro aparece — mandar
 * o usuário "para o passo anterior" era um beco sem saída.
 */
function MeasuresRow({ analysis }: { analysis: PaintingAnalysis }) {
  const { updateMutation } = usePaintingAnalysisMutations();
  const [lengthCm, setLengthCm] = useState<number | null>(analysis.lengthCm ?? null);
  const [heightCm, setHeightCm] = useState<number | null>(analysis.heightCm ?? null);

  useEffect(() => {
    setLengthCm(analysis.lengthCm ?? null);
    setHeightCm(analysis.heightCm ?? null);
  }, [analysis.lengthCm, analysis.heightCm]);

  const commit = (field: "lengthCm" | "heightCm", value: number | null) => {
    const current = field === "lengthCm" ? analysis.lengthCm ?? null : analysis.heightCm ?? null;
    if (value === current || (value != null && value <= 0)) return;
    updateMutation.mutate(
      { id: analysis.id, data: { [field]: value } },
      { onSuccess: () => toast.success("Medidas atualizadas") },
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 rounded-md border border-border p-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label>Comprimento (cm)</Label>
        <Input
          type="number"
          min={1}
          placeholder="ex.: 1470"
          value={lengthCm}
          disabled={updateMutation.isPending}
          onChange={(value) => setLengthCm(typeof value === "number" ? value : value ? Number(value) : null)}
          onBlur={() => commit("lengthCm", lengthCm)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Altura (cm)</Label>
        <Input
          type="number"
          min={1}
          placeholder="ex.: 260"
          value={heightCm}
          disabled={updateMutation.isPending}
          onChange={(value) => setHeightCm(typeof value === "number" ? value : value ? Number(value) : null)}
          onBlur={() => commit("heightCm", heightCm)}
        />
      </div>
    </div>
  );
}

/** Cadastro das artes (faces) do implemento + disparo do processamento da análise. */
export function FacesCard({ analysis }: FacesCardProps) {
  const addFaceMutation = useAddPaintingAnalysisFace();
  const deleteFaceMutation = useDeletePaintingAnalysisFace();
  const updateFaceMutation = useUpdatePaintingAnalysisFace();
  const computeMutation = useComputePaintingAnalysis();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<PaintingFaceView>("LEFT_SIDE");
  const [faceToRemove, setFaceToRemove] = useState<PaintingAnalysisFace | null>(null);

  const faces = analysis.faces ?? [];
  const isProcessing = analysis.status === "PROCESSING";

  const { data: configResponse } = usePaintingConfig();
  const ruleWidth = configResponse?.data?.rules?.find((rule) => rule.key === "IMPLEMENT_DEFAULTS")?.params?.widthCm;
  const widthCm = typeof ruleWidth === "number" && ruleWidth > 0 ? ruleWidth : INFERRED_WIDTH_CM;
  const reference = referenceForView(view, analysis.lengthCm, widthCm);

  /** Selecionar a imagem JÁ adiciona a arte — não existe botão intermediário. */
  const handleFileSelected = async (selected: globalThis.File | null) => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!selected) return;
    if (!reference.valueCm || reference.valueCm <= 0) {
      toast.error("Informe o comprimento do implemento acima — é ele que calibra a escala da arte.");
      return;
    }
    try {
      await addFaceMutation.mutateAsync({
        analysisId: analysis.id,
        data: { file: selected, view, referenceKind: reference.kind, referenceValueCm: reference.valueCm },
      });
      toast.success("Arte adicionada");
      // Sugere a próxima vista ainda não cadastrada
      const usedViews = new Set([...faces.map((face) => face.view), view]);
      const nextView = FACE_VIEWS.find((faceView) => !usedViews.has(faceView));
      if (nextView) setView(nextView);
    } catch {
      // Error toast is handled by the API client interceptor
    }
  };

  const handleConfirmRemove = () => {
    if (faceToRemove) deleteFaceMutation.mutate(faceToRemove.id);
    setFaceToRemove(null);
  };

  // Fundo é propriedade da face: PATCH aqui + recálculo automático das etapas de negócio.
  const handleBackgroundChange = async (face: PaintingAnalysisFace, value: string | string[] | null | undefined) => {
    if (typeof value !== "string" || !value || value === face.backgroundMode) return;
    try {
      await updateFaceMutation.mutateAsync({ faceId: face.id, data: { backgroundMode: value as PaintingBackgroundMode } });
      toast.success("Fundo da face atualizado — recalculando estratégias e plano...");
      computeMutation.mutate(
        { id: analysis.id, data: { stages: ["MATCH", "STRATEGY", "PLAN"] } },
        { onSuccess: () => toast.success("Estratégias e plano recalculados") },
      );
    } catch {
      // toast de erro tratado pelo interceptor do api-client
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Artes do Implemento
          {isProcessing && (
            <Badge variant="processing" size="sm" className="animate-pulse">
              Processando…
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Uma imagem por vista do implemento. A escala (px/cm) é calibrada pelas medidas abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <MeasuresRow analysis={analysis} />

        {faces.length > 0 && (
          <div className="flex flex-col gap-2">
            {faces.map((face) => (
              <div key={face.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                <img
                  src={serveFileUrl(face.fileId)}
                  alt={PAINTING_FACE_VIEW_LABELS[face.view]}
                  className="h-14 w-20 rounded bg-muted object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{PAINTING_FACE_VIEW_LABELS[face.view]}</span>
                    {!face.processedAt && (
                      <Badge variant="secondary" size="sm">
                        Não processada
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {face.widthCm != null && face.heightCm != null
                      ? `${formatNumber(face.widthCm, 0)} × ${formatNumber(face.heightCm, 0)} cm · ${formatNumber(face.areaM2)} m²`
                      : `${PAINTING_REFERENCE_KIND_LABELS[face.referenceKind]}: ${formatNumber(face.referenceValueCm, 0)} cm`}
                  </span>
                </div>
                {face.processedAt && (
                  <div className="w-44 shrink-0" title={BACKGROUND_MODE_HINT}>
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      Fundo da face
                      {face.backgroundModeSource === "MANUAL" && (
                        <Badge variant="amber" size="sm">
                          MANUAL
                        </Badge>
                      )}
                    </p>
                    <Combobox
                      options={BACKGROUND_MODE_OPTIONS}
                      value={face.backgroundMode ?? undefined}
                      onValueChange={(value) => handleBackgroundChange(face, value)}
                      clearable={false}
                      searchable={false}
                      disabled={updateFaceMutation.isPending || computeMutation.isPending || isProcessing}
                      placeholder="Modo do fundo"
                      triggerClassName="h-8"
                    />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFaceToRemove(face)}
                  disabled={deleteFaceMutation.isPending || isProcessing}
                  title="Remover arte"
                >
                  <IconTrash className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Nova arte: escolha a vista e selecione a imagem — a escala vem das medidas. */}
        <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Vista</Label>
              <Combobox
                options={VIEW_OPTIONS}
                value={view}
                onValueChange={(value) => {
                  if (typeof value === "string" && value) setView(value as PaintingFaceView);
                }}
                clearable={false}
                searchable={false}
                placeholder="Selecione a vista"
                disabled={addFaceMutation.isPending || isProcessing}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Imagem da arte</Label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleFileSelected(event.target.files?.[0] ?? null)} />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="justify-start"
                disabled={addFaceMutation.isPending || isProcessing}
              >
                {addFaceMutation.isPending ? <IconLoader2 className="h-4 w-4 shrink-0 animate-spin" /> : <IconUpload className="h-4 w-4 shrink-0" />}
                <span className="truncate">{addFaceMutation.isPending ? "Enviando..." : "Selecionar imagem"}</span>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {reference.valueCm
              ? `Escala calibrada por ${PAINTING_REFERENCE_KIND_LABELS[reference.kind].toLowerCase()}: ${formatNumber(reference.valueCm, 0)} cm.`
              : "Preencha o comprimento acima para poder anexar a arte — é ele que calibra a escala."}
          </p>
        </div>
      </CardContent>

      <AlertDialog open={!!faceToRemove} onOpenChange={(open) => !open && setFaceToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover arte</AlertDialogTitle>
            <AlertDialogDescription>
              {faceToRemove
                ? `Remover a arte "${PAINTING_FACE_VIEW_LABELS[faceToRemove.view]}"? As regiões e fronteiras processadas desta face serão perdidas.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
