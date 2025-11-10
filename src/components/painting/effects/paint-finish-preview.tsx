import React, { useState } from "react";
import { PAINT_FINISH, PAINT_FINISH_LABELS } from "../../../constants";
import { PaintFinishEffect } from "./paint-finish-effect";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { IconPalette, IconSparkles, IconEye } from "@tabler/icons-react";

interface PaintFinishPreviewProps {
  /**
   * Current color in hex format
   */
  color: string;

  /**
   * Current finish selection
   */
  finish?: PAINT_FINISH;

  /**
   * Callback when finish changes
   */
  onFinishChange?: (finish: PAINT_FINISH) => void;

  /**
   * Whether the preview is interactive (allows finish selection)
   */
  interactive?: boolean;

  /**
   * Size of the preview
   */
  size?: "small" | "medium" | "large";

  /**
   * Show comparison mode with all finishes
   */
  showComparison?: boolean;
}

export const PaintFinishPreview: React.FC<PaintFinishPreviewProps> = ({
  color,
  finish = PAINT_FINISH.SOLID,
  onFinishChange,
  interactive = false,
  size = "medium",
  showComparison = false,
}) => {
  const [useAdvancedEffects, setUseAdvancedEffects] = useState(true);
  const [disableAnimations, setDisableAnimations] = useState(false);
  const [selectedFinish, setSelectedFinish] = useState(finish);

  const handleFinishChange = (newFinish: PAINT_FINISH) => {
    setSelectedFinish(newFinish);
    onFinishChange?.(newFinish);
  };

  const previewSizes = {
    small: "h-16 w-24",
    medium: "h-24 w-32",
    large: "h-32 w-48",
  };

  const cardSizes = {
    small: "h-20 w-28",
    medium: "h-28 w-36",
    large: "h-36 w-52",
  };

  if (showComparison) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconEye className="h-5 w-5" />
            Comparação de Acabamentos
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch id="advanced-effects" checked={useAdvancedEffects} onCheckedChange={setUseAdvancedEffects} />
              <Label htmlFor="advanced-effects">Efeitos Avançados</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="disable-animations" checked={disableAnimations} onCheckedChange={setDisableAnimations} />
              <Label htmlFor="disable-animations">Desabilitar Animações</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.values(PAINT_FINISH).map((finishType) => (
              <div key={finishType} className="space-y-2">
                <div className={cardSizes[size]} onClick={() => interactive && handleFinishChange(finishType)}>
                  <PaintFinishEffect
                    baseColor={color}
                    finish={finishType}
                    className={`${previewSizes[size]} rounded-lg ${
                      interactive ? "cursor-pointer hover:ring-2 hover:ring-primary" : ""
                    } ${selectedFinish === finishType ? "ring-2 ring-primary" : ""}`}
                    useCanvas={useAdvancedEffects}
                    size={size}
                    disableAnimations={disableAnimations}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{PAINT_FINISH_LABELS[finishType]}</p>
                  <p className="text-xs text-muted-foreground">{finishType}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconPalette className="h-5 w-5" />
          Visualização da Tinta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {interactive && (
            <div className="flex items-center gap-2">
              <Label htmlFor="finish-select">Acabamento:</Label>
              <div className="w-40">
                <Combobox
                  options={Object.values(PAINT_FINISH).map((finishType) => ({
                    value: finishType,
                    label: PAINT_FINISH_LABELS[finishType],
                  }))}
                  value={selectedFinish}
                  onValueChange={handleFinishChange}
                  placeholder="Selecione o acabamento"
                  searchable={false}
                  renderOption={(option) => (
                    <div className="flex items-center gap-2">
                      <IconSparkles className="h-4 w-4" />
                      {option.label}
                    </div>
                  )}
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch id="advanced-effects" checked={useAdvancedEffects} onCheckedChange={setUseAdvancedEffects} />
            <Label htmlFor="advanced-effects">Efeitos Avançados</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="disable-animations" checked={disableAnimations} onCheckedChange={setDisableAnimations} />
            <Label htmlFor="disable-animations">Desabilitar Animações</Label>
          </div>
        </div>

        {/* Main Preview */}
        <div className="flex justify-center">
          <PaintFinishEffect
            baseColor={color}
            finish={selectedFinish}
            className={`${previewSizes[size]} rounded-lg border border-border`}
            useCanvas={useAdvancedEffects}
            size={size}
            disableAnimations={disableAnimations}
          >
            {/* Color information overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-black/50 backdrop-blur-sm text-white p-2 rounded-b-lg">
              <p className="text-xs font-mono text-center">{color.toUpperCase()}</p>
            </div>
          </PaintFinishEffect>
        </div>

        {/* Finish Information */}
        <div className="text-center space-y-1">
          <p className="font-medium">{PAINT_FINISH_LABELS[selectedFinish]}</p>
          <p className="text-sm text-muted-foreground">
            {selectedFinish === PAINT_FINISH.MATTE && "Acabamento fosco que absorve a luz, criando uma superfície sem reflexos."}
            {selectedFinish === PAINT_FINISH.SOLID && "Acabamento com brilho uniforme, criando reflexos suaves na superfície."}
            {selectedFinish === PAINT_FINISH.METALLIC && "Acabamento com partículas metálicas que criam brilhos direcionais."}
            {selectedFinish === PAINT_FINISH.PEARL && "Acabamento perolado com efeito iridescente que muda com a luz."}
            {selectedFinish === PAINT_FINISH.SATIN && "Acabamento com brilho suave entre o fosco e o brilhante."}
          </p>
        </div>

        {/* Quick comparison button */}
        {!showComparison && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => window.open(`?comparison=true&color=${encodeURIComponent(color)}`, "_blank")}>
              <IconEye className="h-4 w-4 mr-2" />
              Ver Comparação Completa
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaintFinishPreview;
