import React, { useState } from "react";
import { PAINT_FINISH, PAINT_FINISH_LABELS } from "../../../constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaintFinishEffect, PaintFinishPreview, PaintCard } from "./index";
import { IconPalette, IconSettings, IconCards } from "@tabler/icons-react";
import type { Paint } from "../../../types";
import "./paint-finish-effects.css";

/**
 * Comprehensive showcase component demonstrating all paint finish effects
 * This component serves as both a demo and integration example
 */
export const PaintEffectsShowcase: React.FC = () => {
  const [selectedColor, setSelectedColor] = useState("#FF6B35");
  const [selectedFinish, setSelectedFinish] = useState<PAINT_FINISH>(PAINT_FINISH.METALLIC);
  const [useAdvancedEffects, setUseAdvancedEffects] = useState(true);
  const [disableAnimations, setDisableAnimations] = useState(false);
  const [cardSize, setCardSize] = useState<"small" | "medium" | "large">("medium");

  // Sample paint data for card demonstration
  const samplePaint: Paint = {
    id: "sample-paint",
    name: "Cor Personalizada",
    hex: selectedColor,
    finish: selectedFinish,
    brand: "SUVINIL" as any,
    manufacturer: null,
    tags: ["personalizada", "showcase"],
    palette: "RED" as any,
    paletteOrder: 1,
    paintTypeId: "sample-type",
    createdAt: new Date(),
    updatedAt: new Date(),
    paintType: {
      id: "sample-type",
      name: "Tinta Automotiva",
      type: "POLYESTER" as any,
      needGround: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    formulas: [
      {
        id: "sample-formula",
        description: "Fórmula de exemplo",
        paintId: "sample-paint",
        density: 1.2,
        pricePerLiter: 45.99,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const presetColors = [
    { name: "Vermelho Ferrari", hex: "#FF2800" },
    { name: "Azul Metalizado", hex: "#1E3A8A" },
    { name: "Verde Esmeralda", hex: "#059669" },
    { name: "Dourado", hex: "#F59E0B" },
    { name: "Prata", hex: "#9CA3AF" },
    { name: "Preto Fosco", hex: "#111827" },
    { name: "Branco Pérola", hex: "#F8FAFC" },
    { name: "Rosa Perolado", hex: "#EC4899" },
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
          <IconPalette className="h-8 w-8" />
          Sistema de Efeitos de Tinta
        </h1>
        <p className="text-muted-foreground">Demonstração completa dos efeitos de acabamento de tinta implementados no sistema Ankaa</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Controls Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSettings className="h-5 w-5" />
              Controles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Color Selection */}
            <div className="space-y-3">
              <Label>Cor Base</Label>
              <div className="flex gap-2">
                <Input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="w-16 h-10 p-1 rounded border" />
                <Input type="text" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} placeholder="#FF6B35" className="flex-1" />
              </div>

              {/* Preset Colors */}
              <div className="grid grid-cols-4 gap-2">
                {presetColors.map((color) => (
                  <Button
                    key={color.hex}
                    variant="outline"
                    className="h-10 p-0"
                    style={{ backgroundColor: color.hex }}
                    onClick={() => setSelectedColor(color.hex)}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Finish Selection */}
            <div className="space-y-3">
              <Label>Acabamento</Label>
              <div className="grid grid-cols-1 gap-2">
                {Object.values(PAINT_FINISH).map((finish) => (
                  <Button key={finish} variant={selectedFinish === finish ? "default" : "outline"} onClick={() => setSelectedFinish(finish)} className="justify-start">
                    {PAINT_FINISH_LABELS[finish]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Effect Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="advanced-effects">Efeitos Avançados</Label>
                <Switch id="advanced-effects" checked={useAdvancedEffects} onCheckedChange={setUseAdvancedEffects} />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="disable-animations">Desabilitar Animações</Label>
                <Switch id="disable-animations" checked={disableAnimations} onCheckedChange={setDisableAnimations} />
              </div>

              <div className="space-y-2">
                <Label>Tamanho do Card</Label>
                <div className="flex gap-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <Button key={size} variant={cardSize === size ? "default" : "outline"} size="sm" onClick={() => setCardSize(size)} className="capitalize">
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="effects" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="effects">Efeitos Individuais</TabsTrigger>
              <TabsTrigger value="preview">Preview Interativo</TabsTrigger>
              <TabsTrigger value="card">Card Demo</TabsTrigger>
            </TabsList>

            {/* Individual Effects Tab */}
            <TabsContent value="effects" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.values(PAINT_FINISH).map((finish) => (
                  <Card key={finish} className="overflow-hidden">
                    <PaintFinishEffect baseColor={selectedColor} finish={finish} className="h-24" useCanvas={useAdvancedEffects} size="small" disableAnimations={disableAnimations}>
                      <div className="absolute inset-x-0 bottom-0 bg-black/50 backdrop-blur-sm text-white p-2 text-center">
                        <p className="text-sm font-medium">{PAINT_FINISH_LABELS[finish]}</p>
                      </div>
                    </PaintFinishEffect>
                  </Card>
                ))}
              </div>

              {/* Large Preview */}
              <Card className="overflow-hidden">
                <PaintFinishEffect
                  baseColor={selectedColor}
                  finish={selectedFinish}
                  className="h-32"
                  useCanvas={useAdvancedEffects}
                  size="large"
                  disableAnimations={disableAnimations}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-center">
                      <p className="text-lg font-bold">{PAINT_FINISH_LABELS[selectedFinish]}</p>
                      <p className="text-sm opacity-90">{selectedColor.toUpperCase()}</p>
                    </div>
                  </div>
                </PaintFinishEffect>
              </Card>
            </TabsContent>

            {/* Interactive Preview Tab */}
            <TabsContent value="preview" className="space-y-4">
              <PaintFinishPreview color={selectedColor} finish={selectedFinish} onFinishChange={setSelectedFinish} interactive={true} size={cardSize} showComparison={false} />

              <Card>
                <CardHeader>
                  <CardTitle>Comparação de Acabamentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <PaintFinishPreview color={selectedColor} finish={selectedFinish} interactive={false} size="small" showComparison={true} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Card Demo Tab */}
            <TabsContent value="card" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Enhanced Card */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <IconCards className="h-5 w-5" />
                    Card com Efeitos
                  </h3>
                  <PaintCard paint={samplePaint} showEffects={useAdvancedEffects} />
                </div>

                {/* Standard Card for Comparison */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Card Padrão</h3>
                  <Card className="overflow-hidden cursor-pointer h-full flex flex-col">
                    <div className="h-32 relative flex-shrink-0" style={{ backgroundColor: selectedColor }}>
                      <div className="absolute bottom-2 right-2 text-xs font-mono px-2 py-1 rounded bg-black/70 text-white">{selectedColor.toUpperCase()}</div>
                    </div>
                    <div className="p-4 space-y-3 flex-1">
                      <h3 className="font-semibold text-base">Cor Personalizada</h3>
                      <p className="text-sm text-muted-foreground">Tinta Automotiva</p>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Implementation Code Example */}
              <Card>
                <CardHeader>
                  <CardTitle>Exemplo de Implementação</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                    {`// Usando o PaintFinishEffect
<PaintFinishEffect
  baseColor="${selectedColor}"
  finish={PAINT_FINISH.${selectedFinish}}
  className="h-24 rounded-lg"
  useCanvas={${useAdvancedEffects}}
  size="${cardSize}"
  disableAnimations={${disableAnimations}}
>
  {/* Seu conteúdo aqui */}
</PaintFinishEffect>

// Usando o PaintCard
<PaintCard
  paint={paintData}
  useAdvancedEffects={true}
  disableAnimations={false}
/>`}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default PaintEffectsShowcase;
