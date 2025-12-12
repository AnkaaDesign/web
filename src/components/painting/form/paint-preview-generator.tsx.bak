import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Sun, ArrowDownRight } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";

// =====================
// Types
// =====================

export type PaintFinishType = "SOLID" | "METALLIC" | "PEARL";
export type LightType = "BEAM" | "LINEAR";

export interface LightSource {
  id: string;
  type: LightType;
  color: string; // Light color (default white)
  position: number; // 0-100 diagonal position
  intensity: number; // 0-100 brightness
  spread: number; // 0-100 how wide the light spreads (aperture)
}

export interface PaintPreviewSettings {
  baseColor: string;
  finish: PaintFinishType;

  // Light sources - can have multiple
  lights: LightSource[];

  // Finish Effect Controls (separate from light)
  effectIntensity: number; // 0-100 for metallic flakes / pearl interference

  // Metallic Controls
  flakeColor: string; // Metallic flake tint color (default silver)

  // Pearl Controls
  flipColor: string; // Interference color
}

export interface PaintPreviewGeneratorRef {
  exportImage: () => string;
  getSettings: () => PaintPreviewSettings;
}

export interface PaintPreviewGeneratorProps {
  baseColor: string;
  finish: PaintFinishType; // Required - comes from form step 1
  initialSettings?: Partial<PaintPreviewSettings>;
  onSettingsChange?: (settings: PaintPreviewSettings) => void;
  className?: string;
}

// =====================
// Default Settings
// =====================

const createDefaultLight = (id: string, type: LightType = "BEAM"): LightSource => ({
  id,
  type,
  color: "#ffffff",
  position: 50,
  intensity: 70,
  spread: 50,
});

const DEFAULT_SETTINGS: PaintPreviewSettings = {
  baseColor: "#3498db",
  finish: "SOLID",
  lights: [createDefaultLight("light-1", "BEAM")],
  effectIntensity: 60, // Separate from light intensity
  flakeColor: "#c0c0c0", // Silver default
  flipColor: "#ffd700",
};

// =====================
// Texture URLs
// =====================

const TEXTURE_URLS = {
  metallicNormal: "/metallic-normal-map.jpg",
  pearlNormal: "/pearl-normal-map.jpg",
};

// =====================
// Color Utilities
// =====================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}

function blendColors(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number },
  factor: number
): { r: number; g: number; b: number } {
  return {
    r: color1.r + (color2.r - color1.r) * factor,
    g: color1.g + (color2.g - color1.g) * factor,
    b: color1.b + (color2.b - color1.b) * factor,
  };
}

// =====================
// Texture Loading
// =====================

interface LoadedTextures {
  metallicNormal: HTMLImageElement | null;
  pearlNormal: HTMLImageElement | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadAllTextures(): Promise<LoadedTextures> {
  const results: LoadedTextures = {
    metallicNormal: null,
    pearlNormal: null,
  };

  try {
    const [metallicNormal, pearlNormal] = await Promise.all([
      loadImage(TEXTURE_URLS.metallicNormal).catch(() => null),
      loadImage(TEXTURE_URLS.pearlNormal).catch(() => null),
    ]);

    results.metallicNormal = metallicNormal;
    results.pearlNormal = pearlNormal;
  } catch (e) {
    console.warn("Failed to load some textures:", e);
  }

  return results;
}

// =====================
// Normal Map Lighting
// =====================

function applyNormalMapLighting(
  ctx: CanvasRenderingContext2D,
  normalMap: HTMLImageElement,
  width: number,
  height: number,
  lightX: number,
  lightY: number,
  lightZ: number,
  baseColor: { r: number; g: number; b: number },
  intensity: number
): ImageData {
  const imageData = ctx.getImageData(0, 0, width, height);

  // Skip processing if intensity is 0 - just return the current image
  if (intensity <= 0) {
    return imageData;
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d")!;

  tempCtx.drawImage(normalMap, 0, 0, width, height);
  const normalData = tempCtx.getImageData(0, 0, width, height);

  const pixels = imageData.data;
  const normals = normalData.data;

  const lightLen = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
  const lx = lightX / lightLen;
  const ly = lightY / lightLen;
  const lz = lightZ / lightLen;

  for (let i = 0; i < pixels.length; i += 4) {
    const nx = (normals[i] / 255) * 2 - 1;
    const ny = (normals[i + 1] / 255) * 2 - 1;
    const nz = normals[i + 2] / 255;

    const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
    const halfZ = (lz + 1) / 2;
    const specular = Math.pow(Math.max(0, nz * halfZ), 16) * intensity;

    // Scale lighting effect by intensity: at 0 = base color, at 1 = full lighting
    const lightMix = diffuse * intensity;
    const baseFactor = 1.0 - intensity * 0.5; // 1.0 at intensity=0, 0.5 at intensity=1
    const r = baseColor.r * (baseFactor + lightMix * 0.5) + specular * 255 * 0.5;
    const g = baseColor.g * (baseFactor + lightMix * 0.5) + specular * 255 * 0.5;
    const b = baseColor.b * (baseFactor + lightMix * 0.5) + specular * 255 * 0.5;

    pixels[i] = Math.min(255, r);
    pixels[i + 1] = Math.min(255, g);
    pixels[i + 2] = Math.min(255, b);
  }

  return imageData;
}

// =====================
// Light Rendering Helpers
// =====================

/**
 * BEAM Light (Focal/Point Light)
 * - Renders as a visible colored ball/circle
 * - Center: Full light color with high opacity
 * - Edges: Fades to transparent based on spread (aperture)
 * - Position: Moves diagonally from top-left (0) to bottom-right (100)
 */
function renderBeamLight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  light: LightSource
): void {
  const position = light.position / 100;
  const intensity = light.intensity / 100;
  const spread = light.spread / 100;
  const lightRgb = hexToRgb(light.color);

  if (intensity <= 0) return;

  // Position: diagonal from top-left (0,0) to bottom-right (width, height)
  const centerX = width * position;
  const centerY = height * position;

  // Radius based on spread: small spread = small tight ball, large spread = big soft glow
  const minRadius = Math.min(width, height) * 0.1;
  const maxRadius = Math.max(width, height) * 0.7;
  const radius = minRadius + spread * (maxRadius - minRadius);

  // Create radial gradient - actual light color!
  const beamGradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, radius
  );

  // INCREASED intensity values for more visible light
  // Core: bright light color (very visible)
  const coreAlpha = Math.min(1, 0.95 * intensity); // Almost fully opaque at max
  const midAlpha = 0.6 * intensity * (0.3 + spread * 0.7); // Visible even at low spread
  const edgeAlpha = 0.15 * intensity * spread;

  beamGradient.addColorStop(0, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},${coreAlpha})`);
  beamGradient.addColorStop(0.25, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},${midAlpha})`);
  beamGradient.addColorStop(0.6, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},${edgeAlpha})`);
  beamGradient.addColorStop(1, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},0)`);

  ctx.save();
  ctx.globalCompositeOperation = "screen"; // Additive blending for light
  ctx.fillStyle = beamGradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * LINEAR Light (Strip/Band Light)
 * - Renders as a visible colored stripe going diagonally
 * - Peak: Full light color at the position line
 * - Edges: Gradient to transparent based on spread (aperture)
 * - Position: Moves the stripe along the diagonal
 */
function renderLinearLight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  light: LightSource
): void {
  const position = light.position / 100;
  const intensity = light.intensity / 100;
  const spread = light.spread / 100;
  const lightRgb = hexToRgb(light.color);

  if (intensity <= 0) return;

  // Stripe width based on spread: small = thin strip, large = wide band
  const stripeWidth = 0.08 + spread * 0.5; // 8% to 58% of diagonal

  // Calculate stripe boundaries
  const stripeStart = Math.max(0, position - stripeWidth / 2);
  const stripeEnd = Math.min(1, position + stripeWidth / 2);

  // INCREASED alpha values for more visible light
  const peakAlpha = Math.min(1, 0.95 * intensity); // Almost fully opaque at max
  const edgeAlpha = 0.25 * intensity * (0.2 + spread * 0.8); // Visible even at low spread

  // Linear gradient across diagonal (top-left to bottom-right)
  const linearGradient = ctx.createLinearGradient(0, 0, width, height);

  // Outside the stripe: transparent
  linearGradient.addColorStop(0, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},0)`);

  // Fade in to stripe
  if (stripeStart > 0.03) {
    linearGradient.addColorStop(stripeStart - 0.03, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},0)`);
  }
  linearGradient.addColorStop(stripeStart, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},${edgeAlpha})`);

  // Peak at position
  linearGradient.addColorStop(position, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},${peakAlpha})`);

  // Fade out from stripe
  linearGradient.addColorStop(stripeEnd, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},${edgeAlpha})`);
  if (stripeEnd < 0.97) {
    linearGradient.addColorStop(stripeEnd + 0.03, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},0)`);
  }

  // Outside the stripe: transparent
  linearGradient.addColorStop(1, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},0)`);

  ctx.save();
  ctx.globalCompositeOperation = "screen"; // Additive blending for light
  ctx.fillStyle = linearGradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// =====================
// Main Render Function
// =====================

/**
 * Layer order (bottom to top):
 * 1. Metallic/Pearl texture from normal map (base layer with texture)
 * 2. Base color tinted over the texture
 * 3. Flakes/Interference color overlay (controlled by effectIntensity)
 * 4. Lights - visible light sources ON TOP
 * 5. Clearcoat - subtle highlight
 */
function renderToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: PaintPreviewSettings,
  textures: LoadedTextures
): void {
  const baseRgb = hexToRgb(settings.baseColor);
  const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
  const effectIntensity = settings.effectIntensity / 100;

  // FIXED light direction for normal map
  const fixedLightX = 0.5;
  const fixedLightY = -0.5;
  const fixedLightZ = 0.8;

  // ========================================
  // LAYER 1: Base Color
  // ========================================
  ctx.fillStyle = settings.baseColor;
  ctx.fillRect(0, 0, width, height);

  // ========================================
  // LAYER 2: Metallic/Pearl Texture (controlled by effectIntensity)
  // The normal map creates the flake texture - effectIntensity controls visibility
  // ========================================
  if (settings.finish === "METALLIC" && textures.metallicNormal && effectIntensity > 0) {
    const effectRgb = hexToRgb(settings.flakeColor);

    // Apply normal map with intensity controlled by effectIntensity
    const metallicBase = blendColors(baseRgb, effectRgb, effectIntensity * 0.3);
    const litData = applyNormalMapLighting(
      ctx,
      textures.metallicNormal,
      width,
      height,
      fixedLightX,
      fixedLightY,
      fixedLightZ,
      metallicBase,
      effectIntensity * 0.9 // Strong effect when intensity is high
    );
    ctx.putImageData(litData, 0, 0);

    // Flake color overlay - enhances the metallic look
    const flakeOverlay = ctx.createRadialGradient(
      width * 0.5, height * 0.5, 0,
      width * 0.5, height * 0.5, Math.max(width, height) * 0.9
    );
    const flakeAlpha = 0.7 * effectIntensity;
    flakeOverlay.addColorStop(0, `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},${flakeAlpha})`);
    flakeOverlay.addColorStop(0.4, `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},${flakeAlpha * 0.6})`);
    flakeOverlay.addColorStop(1, `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},${flakeAlpha * 0.25})`);

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = flakeOverlay;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Additional specular highlights from flakes
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = effectIntensity * 0.3;
    ctx.fillStyle = `rgba(${Math.min(255, effectRgb.r + 100)},${Math.min(255, effectRgb.g + 100)},${Math.min(255, effectRgb.b + 100)},0.5)`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

  } else if (settings.finish === "PEARL" && textures.pearlNormal && effectIntensity > 0) {
    const flipRgb = hexToRgb(settings.flipColor);

    // Apply normal map with intensity controlled by effectIntensity
    const pearlBase = blendColors(baseRgb, flipRgb, effectIntensity * 0.25);
    const litData = applyNormalMapLighting(
      ctx,
      textures.pearlNormal,
      width,
      height,
      fixedLightX,
      fixedLightY,
      fixedLightZ,
      pearlBase,
      effectIntensity * 0.8
    );
    ctx.putImageData(litData, 0, 0);

    // Pearl interference overlay
    const pearlOverlay = ctx.createRadialGradient(
      width * 0.5, height * 0.5, 0,
      width * 0.5, height * 0.5, Math.max(width, height) * 0.9
    );
    const pearlAlpha = 0.6 * effectIntensity;
    pearlOverlay.addColorStop(0, `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},${pearlAlpha})`);
    pearlOverlay.addColorStop(0.5, `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},${pearlAlpha * 0.5})`);
    pearlOverlay.addColorStop(1, `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},${pearlAlpha * 0.15})`);

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = pearlOverlay;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Iridescent hue shift
    const baseHslFlip = rgbToHsl(flipRgb.r, flipRgb.g, flipRgb.b);
    const hueShift1 = hslToRgb((baseHslFlip.h + 30) % 360, baseHslFlip.s, baseHslFlip.l);
    const hueShift2 = hslToRgb((baseHslFlip.h - 30 + 360) % 360, baseHslFlip.s, baseHslFlip.l);

    const hueShiftGrad = ctx.createLinearGradient(0, height, width, 0);
    hueShiftGrad.addColorStop(0, `rgba(${hueShift1.r},${hueShift1.g},${hueShift1.b},${0.2 * effectIntensity})`);
    hueShiftGrad.addColorStop(0.5, `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},${0.08 * effectIntensity})`);
    hueShiftGrad.addColorStop(1, `rgba(${hueShift2.r},${hueShift2.g},${hueShift2.b},${0.2 * effectIntensity})`);

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = hueShiftGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // ========================================
  // LAYER 4: Light Sources (ON TOP, clearly visible)
  // ========================================
  for (const light of settings.lights) {
    if (light.type === "BEAM") {
      renderBeamLight(ctx, width, height, light);
    } else {
      renderLinearLight(ctx, width, height, light);
    }
  }

  // ========================================
  // LAYER 5: Clearcoat Highlight
  // ========================================
  if (settings.lights.length > 0) {
    const primaryLight = settings.lights[0];
    const primaryPosition = primaryLight.position / 100;
    const primaryIntensity = primaryLight.intensity / 100;

    if (primaryIntensity > 0) {
      const clearcoatGrad = ctx.createRadialGradient(
        width * primaryPosition,
        height * primaryPosition,
        0,
        width * primaryPosition,
        height * primaryPosition,
        width * 0.6
      );
      clearcoatGrad.addColorStop(0, `rgba(255,255,255,${0.15 * primaryIntensity})`);
      clearcoatGrad.addColorStop(0.4, `rgba(255,255,255,${0.05 * primaryIntensity})`);
      clearcoatGrad.addColorStop(1, "rgba(255,255,255,0)");

      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = clearcoatGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
}

// Canvas dimensions - higher resolution for better quality exports
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// =====================
// Component
// =====================

export const PaintPreviewGenerator = forwardRef<
  PaintPreviewGeneratorRef,
  PaintPreviewGeneratorProps
>(function PaintPreviewGenerator(
  { baseColor, finish, initialSettings, onSettingsChange, className },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [textures, setTextures] = useState<LoadedTextures>({
    metallicNormal: null,
    pearlNormal: null,
  });

  const [settings, setSettings] = useState<PaintPreviewSettings>(() => ({
    ...DEFAULT_SETTINGS,
    baseColor,
    finish,
    ...initialSettings,
  }));

  // Load textures on mount
  useEffect(() => {
    loadAllTextures().then((loaded) => {
      setTextures(loaded);
    });
  }, []);

  // Update base color when prop changes
  useEffect(() => {
    setSettings((prev) => ({ ...prev, baseColor }));
  }, [baseColor]);

  // Update finish when prop changes
  useEffect(() => {
    setSettings((prev) => ({ ...prev, finish }));
  }, [finish]);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderToCanvas(ctx, canvas.width, canvas.height, settings, textures);
  }, [settings, textures]);

  // Re-render when settings or textures change
  useEffect(() => {
    render();
    onSettingsChange?.(settings);
  }, [render, settings, onSettingsChange]);

  // Export as WebP data URL
  const exportImage = useCallback((): string => {
    const canvas = canvasRef.current;
    if (!canvas) return "";

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderToCanvas(ctx, canvas.width, canvas.height, settings, textures);
    }

    return canvas.toDataURL("image/webp", 0.95);
  }, [settings, textures]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      exportImage,
      getSettings: () => settings,
    }),
    [exportImage, settings]
  );

  // Update a single setting
  const updateSetting = useCallback(
    <K extends keyof PaintPreviewSettings>(key: K, value: PaintPreviewSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Light management functions
  const updateLight = useCallback(
    (lightId: string, key: keyof LightSource, value: LightSource[keyof LightSource]) => {
      setSettings((prev) => ({
        ...prev,
        lights: prev.lights.map((light) =>
          light.id === lightId ? { ...light, [key]: value } : light
        ),
      }));
    },
    []
  );

  const addLight = useCallback(() => {
    const newId = `light-${Date.now()}`;
    setSettings((prev) => ({
      ...prev,
      lights: [...prev.lights, createDefaultLight(newId, "BEAM")],
    }));
  }, []);

  // Light type options for combobox
  const lightTypeOptions = [
    { value: "BEAM", label: "Focal" },
    { value: "LINEAR", label: "Linear" },
  ];

  const removeLight = useCallback((lightId: string) => {
    setSettings((prev) => ({
      ...prev,
      lights: prev.lights.filter((light) => light.id !== lightId),
    }));
  }, []);

  const showEffectControls = settings.finish === "METALLIC" || settings.finish === "PEARL";

  return (
    <div className={className}>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Canvas Preview */}
        <div className="flex justify-center items-start">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="rounded-lg shadow-inner w-full"
            style={{ maxWidth: "100%", height: "auto" }}
          />
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Light Sources */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">Fontes de Luz</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addLight}
                  title="Adicionar luz"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.lights.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhuma luz configurada. Adicione uma luz acima.
                </p>
              )}

              {settings.lights.map((light, index) => (
                <div key={light.id} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {light.type === "BEAM" ? (
                        <Sun className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-blue-500" />
                      )}
                      <span className="text-sm font-medium">
                        Luz {index + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Light Type - Combobox */}
                      <Combobox
                        value={light.type}
                        onValueChange={(v) => updateLight(light.id, "type", v as LightType)}
                        options={lightTypeOptions}
                        placeholder="Tipo"
                        searchable={false}
                        clearable={false}
                        className="w-24 h-8"
                        triggerClassName="h-8 text-xs"
                      />

                      {/* Light Color */}
                      <input
                        type="color"
                        value={light.color}
                        onChange={(e) => updateLight(light.id, "color", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                        title="Cor da luz"
                      />

                      {/* Remove button */}
                      {settings.lights.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLight(light.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Position */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Posição</Label>
                      <span className="text-xs text-muted-foreground">{light.position}</span>
                    </div>
                    <Slider
                      value={[light.position]}
                      onValueChange={([v]) => updateLight(light.id, "position", v)}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* Intensity */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Intensidade</Label>
                      <span className="text-xs text-muted-foreground">{light.intensity}</span>
                    </div>
                    <Slider
                      value={[light.intensity]}
                      onValueChange={([v]) => updateLight(light.id, "intensity", v)}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* Spread/Aperture */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Abertura</Label>
                      <span className="text-xs text-muted-foreground">{light.spread}</span>
                    </div>
                    <Slider
                      value={[light.spread]}
                      onValueChange={([v]) => updateLight(light.id, "spread", v)}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Effect Controls - only for Metallic/Pearl */}
          {showEffectControls && (
            <Card>
              <CardHeader className="py-3">
                <span className="text-base font-semibold">
                  {settings.finish === "METALLIC" ? "Efeito Metálico" : "Efeito Perolado"}
                </span>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Effect Color */}
                <div className="flex items-center justify-between">
                  <Label>
                    {settings.finish === "METALLIC" ? "Cor dos Flocos" : "Cor de Interferência"}
                  </Label>
                  <input
                    type="color"
                    value={settings.finish === "METALLIC" ? settings.flakeColor : settings.flipColor}
                    onChange={(e) =>
                      updateSetting(
                        settings.finish === "METALLIC" ? "flakeColor" : "flipColor",
                        e.target.value
                      )
                    }
                    className="w-16 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>

                {/* Effect Intensity - independent from light */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Intensidade do Efeito</Label>
                    <span className="text-sm text-muted-foreground">{settings.effectIntensity}</span>
                  </div>
                  <Slider
                    value={[settings.effectIntensity]}
                    onValueChange={([v]) => updateSetting("effectIntensity", v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings.finish === "METALLIC"
                      ? "Controla a visibilidade dos flocos metálicos"
                      : "Controla a iridescência perolada"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
});

export default PaintPreviewGenerator;
