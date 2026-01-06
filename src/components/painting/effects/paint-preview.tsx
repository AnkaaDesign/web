import React, { useState, useMemo } from "react";
import { PAINT_FINISH, PAINT_FINISH_LABELS } from "../../../constants";
import { CanvasNormalMapRenderer } from "./canvas-normal-map-renderer";
import { getFinishProperties } from "./paint-finish-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PaintPreviewProps {
  name?: string;
  hex: string;
  finish: PAINT_FINISH;
  brand?: string;
  manufacturer?: string;
  showAllFinishes?: boolean;
}

export function PaintPreview({ name = "Amostra de Tinta", hex, finish, brand, manufacturer, showAllFinishes = false }: PaintPreviewProps) {
  const [selectedFinish, setSelectedFinish] = useState(finish);
  const [previewSize, setPreviewSize] = useState({ width: 400, height: 400 });
  const [viewMode, setViewMode] = useState<"canvas" | "css">("canvas");
  const [qualityMode, setQualityMode] = useState<"low" | "medium" | "high">("high");

  const config = getFinishProperties(selectedFinish);

  // Determine quality based on size and mode
  const quality = useMemo(() => {
    if (viewMode === "css") return "high"; // CSS mode doesn't need quality settings
    if (previewSize.width <= 200) return "medium"; // Small previews don't need high quality
    if (showAllFinishes) return "medium"; // Multiple previews = lower quality each
    return qualityMode;
  }, [viewMode, previewSize.width, showAllFinishes, qualityMode]);

  // CSS-based preview as fallback (simplified, no animations)
  const getCssEffectStyles = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      backgroundColor: hex,
      width: previewSize.width,
      height: previewSize.height,
    };

    switch (selectedFinish) {
      case PAINT_FINISH.METALLIC:
        return {
          ...baseStyle,
          background: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6) 2px, transparent 2px),
            radial-gradient(circle at 70% 80%, rgba(255,255,255,0.4) 1.5px, transparent 1.5px),
            radial-gradient(circle at 40% 60%, rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%),
            ${hex}
          `,
          backgroundSize: "50px 50px, 30px 30px, 40px 40px, 100% 100%, 100% 100%",
        };

      case PAINT_FINISH.PEARL:
        return {
          ...baseStyle,
          background: `
            linear-gradient(45deg, 
              rgba(255,255,255,0.4) 0%,
              rgba(255,192,203,0.3) 25%,
              rgba(173,216,230,0.3) 50%,
              rgba(255,255,255,0.4) 75%,
              rgba(255,255,255,0.2) 100%
            ),
            ${hex}
          `,
        };

      case PAINT_FINISH.MATTE:
        return {
          ...baseStyle,
          filter: "brightness(0.85) contrast(1.1)",
          boxShadow: "inset 0 0 20px rgba(0,0,0,0.1)",
        };

      case PAINT_FINISH.SATIN:
        return {
          ...baseStyle,
          background: `
            linear-gradient(135deg, 
              transparent 40%, 
              rgba(255,255,255,0.2) 50%, 
              transparent 60%
            ),
            ${hex}
          `,
        };

      default: // SOLID
        return {
          ...baseStyle,
          background: `
            linear-gradient(135deg, 
              transparent 30%, 
              rgba(255,255,255,0.15) 45%, 
              transparent 60%
            ),
            ${hex}
          `,
        };
    }
  };

  const renderPreview = () => {
    if (viewMode === "css") {
      return (
        <div className="relative rounded-lg overflow-hidden shadow-sm">
          <div className="transition-all duration-500" style={getCssEffectStyles()} />
        </div>
      );
    }

    return <CanvasNormalMapRenderer baseColor={hex} finish={selectedFinish} width={previewSize.width} height={previewSize.height} quality={quality} />;
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{name}</CardTitle>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{hex}</Badge>
              <Badge variant="outline">{PAINT_FINISH_LABELS[selectedFinish]}</Badge>
              {brand && <Badge variant="outline">{brand}</Badge>}
              {manufacturer && <Badge variant="outline">{manufacturer}</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode(viewMode === "canvas" ? "css" : "canvas")}
              className="px-3 py-1 text-sm bg-secondary rounded-md hover:bg-secondary/80"
              title={viewMode === "canvas" ? "Mudar para CSS" : "Mudar para Canvas"}
            >
              {viewMode === "canvas" ? "🎨 Canvas" : "🖼️ CSS"}
            </button>
            {viewMode === "canvas" && (
              <select
                value={qualityMode}
                onChange={(e) => setQualityMode(e.target.value as "low" | "medium" | "high")}
                className="px-3 py-1 text-sm bg-secondary rounded-md"
                title="Qualidade de renderização"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            )}
            <select
              value={`${previewSize.width}x${previewSize.height}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split("x").map(Number);
                setPreviewSize({ width: w, height: h });
              }}
              className="px-3 py-1 text-sm bg-secondary rounded-md"
            >
              <option value="200x200">200x200</option>
              <option value="300x300">300x300</option>
              <option value="400x400">400x400</option>
              <option value="500x500">500x500</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showAllFinishes ? (
          <Tabs value={selectedFinish} onValueChange={(v) => setSelectedFinish(v as PAINT_FINISH)}>
            <TabsList className="grid grid-cols-5 w-full mb-6">
              {Object.values(PAINT_FINISH).map((finishType) => (
                <TabsTrigger key={finishType} value={finishType}>
                  {PAINT_FINISH_LABELS[finishType]}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.values(PAINT_FINISH).map((finishType) => (
              <TabsContent key={finishType} value={finishType} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    {renderPreview()}
                    <p className="text-sm text-muted-foreground mt-2">
                      {viewMode === "canvas" ? `💡 Renderização realista com qualidade ${quality}` : "🎨 Visualização CSS (leve e rápida)"}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Propriedades do Acabamento</h3>
                      <p className="text-sm text-muted-foreground mb-4">{config.description}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rugosidade:</span>
                          <span>{(config.roughness * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Metalicidade:</span>
                          <span>{(config.metalness * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Verniz:</span>
                          <span>{(config.clearCoat * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Refletividade:</span>
                          <span>{(config.reflectivity * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>

                    {config.particleEffect?.enabled && (
                      <div>
                        <h3 className="font-semibold mb-2">Efeito de Partículas</h3>
                        <div className="text-sm text-muted-foreground">
                          <p>Densidade: {config.particleEffect.density} partículas</p>
                          <p>Tamanho: {config.particleEffect.size}px</p>
                        </div>
                      </div>
                    )}

                    {config.normalMap && (
                      <div>
                        <h3 className="font-semibold mb-2">Mapa Normal</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="success">Ativo</Badge>
                          <span className="text-sm text-muted-foreground">{config.normalMap}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              {renderPreview()}
              <p className="text-sm text-muted-foreground mt-2">
                {viewMode === "canvas" ? `💡 Renderização realista com qualidade ${quality}` : "🎨 Visualização CSS (leve e rápida)"}
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Propriedades do Acabamento</h3>
                <p className="text-sm text-muted-foreground mb-4">{config.description}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rugosidade:</span>
                    <span>{(config.roughness * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Metalicidade:</span>
                    <span>{(config.metalness * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verniz:</span>
                    <span>{(config.clearCoat * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Refletividade:</span>
                    <span>{(config.reflectivity * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {config.normalMap && (
                <div>
                  <h3 className="font-semibold mb-2">Mapa Normal</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Ativo</Badge>
                    <span className="text-sm text-muted-foreground">{config.normalMap}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
