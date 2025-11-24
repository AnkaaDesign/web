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

// =====================
// Types
// =====================

export type PaintFinishType = "SOLID" | "METALLIC" | "PEARL";

export interface PaintPreviewSettings {
  baseColor: string;
  finish: PaintFinishType;

  // Common Light Controls
  lightPosition: number; // 0-100 diagonal position
  lightIntensity: number; // 0-100 brightness
  lightSpread: number; // 0-100 how wide the beam spreads

  // Metallic Controls
  flakeSize: number; // 0-100 (scales texture pattern - now more granular)
  flakeDensity: number; // 0-100 (sparkle count and visibility)
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

const DEFAULT_SETTINGS: PaintPreviewSettings = {
  baseColor: "#3498db",
  finish: "SOLID",
  lightPosition: 50,
  lightIntensity: 70,
  lightSpread: 50,
  flakeSize: 30,
  flakeDensity: 40,
  flakeColor: "#c0c0c0", // Silver default - can be gold, bronze, etc.
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
// Main Render Function
// =====================

function renderToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: PaintPreviewSettings,
  textures: LoadedTextures
): void {
  const beamPosition = settings.lightPosition / 100;
  const intensity = settings.lightIntensity / 100;
  const spread = settings.lightSpread / 100;
  const beamWidth = 0.15 + spread * 0.7; // 0.15 to 0.85 based on spread

  const baseRgb = hexToRgb(settings.baseColor);
  const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);

  // Light position for normal map (moves with beam)
  const lightX = (beamPosition - 0.5) * 2;
  const lightY = (0.5 - beamPosition) * 2;
  const lightZ = 0.8;

  // Step 1: Draw base color
  ctx.fillStyle = settings.baseColor;
  ctx.fillRect(0, 0, width, height);

  // Calculate beam boundaries (used by multiple layers)
  const beamStart = Math.max(0, beamPosition - beamWidth / 2);
  const beamEnd = Math.min(1, beamPosition + beamWidth / 2);

  // Step 2: Draw beam highlight gradient (only if intensity > 0)
  if (intensity > 0) {
    const beamGradient = ctx.createLinearGradient(0, 0, width, height);

    // Darkening and brightening scale with intensity
    const darkL = Math.max(baseHsl.l - 8 * intensity, 0);
    const midL = baseHsl.l;
    const brightL = Math.min(baseHsl.l + 20 * intensity, 100);

    beamGradient.addColorStop(0, `hsl(${baseHsl.h}, ${baseHsl.s}%, ${darkL}%)`);
    beamGradient.addColorStop(
      Math.max(0, beamStart - 0.05),
      `hsl(${baseHsl.h}, ${baseHsl.s}%, ${midL}%)`
    );
    beamGradient.addColorStop(beamStart, `hsl(${baseHsl.h}, ${baseHsl.s}%, ${midL + 5 * intensity}%)`);
    beamGradient.addColorStop(beamPosition, `hsl(${baseHsl.h}, ${baseHsl.s}%, ${brightL}%)`);
    beamGradient.addColorStop(beamEnd, `hsl(${baseHsl.h}, ${baseHsl.s}%, ${midL + 5 * intensity}%)`);
    beamGradient.addColorStop(
      Math.min(1, beamEnd + 0.05),
      `hsl(${baseHsl.h}, ${baseHsl.s}%, ${midL}%)`
    );
    beamGradient.addColorStop(1, `hsl(${baseHsl.h}, ${baseHsl.s}%, ${darkL}%)`);

    ctx.fillStyle = beamGradient;
    ctx.fillRect(0, 0, width, height);
  }

  // Step 3: Apply finish-specific effects
  if (settings.finish === "METALLIC") {
    // Effect color for metallic highlights (similar to pearl's interference color)
    const effectRgb = hexToRgb(settings.flakeColor);

    // Apply metallic normal map lighting
    if (textures.metallicNormal) {
      const metallicBase = blendColors(baseRgb, effectRgb, intensity * 0.15);

      const litData = applyNormalMapLighting(
        ctx,
        textures.metallicNormal,
        width,
        height,
        lightX,
        lightY,
        lightZ,
        metallicBase,
        intensity * 0.6
      );
      ctx.putImageData(litData, 0, 0);
    }

    // Strong radial effect color at beam center - spread controls the radius
    const beamCenterX = width * beamPosition;
    const beamCenterY = height * (1 - beamPosition);
    const beamRadius = Math.max(width, height) * (0.2 + spread * 0.6);

    const metallicRadial = ctx.createRadialGradient(
      beamCenterX,
      beamCenterY,
      0,
      beamCenterX,
      beamCenterY,
      beamRadius
    );

    // Effect color intensity controlled by light intensity (stronger than pearl for metallic shine)
    const peakAlpha = 0.7 * intensity;
    metallicRadial.addColorStop(0, `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},${peakAlpha})`);
    metallicRadial.addColorStop(0.25, `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},${peakAlpha * 0.6})`);
    metallicRadial.addColorStop(0.5, `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},${peakAlpha * 0.2})`);
    metallicRadial.addColorStop(1, `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},0)`);

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = metallicRadial;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Additional color layer using "color" blend for stronger tint
    ctx.save();
    ctx.globalCompositeOperation = "color";
    ctx.globalAlpha = intensity * 0.35;
    ctx.fillStyle = metallicRadial;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Linear gradient for angle-dependent metallic reflection
    const halfSpread = beamWidth / 2;
    const metallicGrad = ctx.createLinearGradient(0, 0, width, height);
    metallicGrad.addColorStop(0, `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},0)`);
    metallicGrad.addColorStop(
      Math.max(0, beamPosition - halfSpread),
      `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},${0.08 * intensity})`
    );
    metallicGrad.addColorStop(
      beamPosition,
      `rgba(${Math.min(255, effectRgb.r + 50)},${Math.min(255, effectRgb.g + 50)},${Math.min(255, effectRgb.b + 50)},${0.4 * intensity})`
    );
    metallicGrad.addColorStop(
      Math.min(1, beamPosition + halfSpread),
      `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},${0.08 * intensity})`
    );
    metallicGrad.addColorStop(1, `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},0)`);

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = metallicGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Subtle brightness variation at edges (metallic characteristic)
    const effectHsl = rgbToHsl(effectRgb.r, effectRgb.g, effectRgb.b);
    const brightShift = hslToRgb(effectHsl.h, Math.max(0, effectHsl.s - 20), Math.min(100, effectHsl.l + 30));
    const darkShift = hslToRgb(effectHsl.h, Math.min(100, effectHsl.s + 10), Math.max(0, effectHsl.l - 20));

    const edgeGrad = ctx.createLinearGradient(0, height, width, 0);
    edgeGrad.addColorStop(
      0,
      `rgba(${darkShift.r},${darkShift.g},${darkShift.b},${0.06 * intensity})`
    );
    edgeGrad.addColorStop(
      0.5,
      `rgba(${effectRgb.r},${effectRgb.g},${effectRgb.b},${0.03 * intensity})`
    );
    edgeGrad.addColorStop(
      1,
      `rgba(${brightShift.r},${brightShift.g},${brightShift.b},${0.06 * intensity})`
    );

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } else if (settings.finish === "PEARL") {
    // Apply pearl normal map
    const flipRgb = hexToRgb(settings.flipColor);

    if (textures.pearlNormal) {
      const pearlBase = blendColors(baseRgb, flipRgb, intensity * 0.15);

      const litData = applyNormalMapLighting(
        ctx,
        textures.pearlNormal,
        width,
        height,
        lightX,
        lightY,
        lightZ,
        pearlBase,
        intensity * 0.5
      );
      ctx.putImageData(litData, 0, 0);
    }

    // Strong radial flip color at beam center - spread controls the radius
    const beamCenterX = width * beamPosition;
    const beamCenterY = height * (1 - beamPosition);
    const beamRadius = Math.max(width, height) * (0.2 + spread * 0.6);

    const flipRadial = ctx.createRadialGradient(
      beamCenterX,
      beamCenterY,
      0,
      beamCenterX,
      beamCenterY,
      beamRadius
    );

    // Flip color intensity controlled by light intensity
    const peakAlpha = 0.6 * intensity;
    flipRadial.addColorStop(0, `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},${peakAlpha})`);
    flipRadial.addColorStop(0.3, `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},${peakAlpha * 0.5})`);
    flipRadial.addColorStop(0.6, `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},${peakAlpha * 0.15})`);
    flipRadial.addColorStop(1, `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},0)`);

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = flipRadial;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Additional color layer using "color" blend for stronger tint
    ctx.save();
    ctx.globalCompositeOperation = "color";
    ctx.globalAlpha = intensity * 0.3;
    ctx.fillStyle = flipRadial;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Linear gradient for angle-dependent color shift (pearl characteristic)
    const halfSpread = beamWidth / 2;
    const iridescentGrad = ctx.createLinearGradient(0, 0, width, height);
    iridescentGrad.addColorStop(0, `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},0)`);
    iridescentGrad.addColorStop(
      Math.max(0, beamPosition - halfSpread),
      `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},${0.05 * intensity})`
    );
    iridescentGrad.addColorStop(
      beamPosition,
      `rgba(${Math.min(255, flipRgb.r + 30)},${Math.min(255, flipRgb.g + 30)},${Math.min(255, flipRgb.b + 30)},${0.3 * intensity})`
    );
    iridescentGrad.addColorStop(
      Math.min(1, beamPosition + halfSpread),
      `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},${0.05 * intensity})`
    );
    iridescentGrad.addColorStop(1, `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},0)`);

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = iridescentGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Subtle hue shift at edges
    const baseHslFlip = rgbToHsl(flipRgb.r, flipRgb.g, flipRgb.b);
    const hueShift1 = hslToRgb((baseHslFlip.h + 25) % 360, baseHslFlip.s, baseHslFlip.l);
    const hueShift2 = hslToRgb((baseHslFlip.h - 25 + 360) % 360, baseHslFlip.s, baseHslFlip.l);

    const hueShiftGrad = ctx.createLinearGradient(0, height, width, 0);
    hueShiftGrad.addColorStop(
      0,
      `rgba(${hueShift1.r},${hueShift1.g},${hueShift1.b},${0.04 * intensity})`
    );
    hueShiftGrad.addColorStop(
      0.5,
      `rgba(${flipRgb.r},${flipRgb.g},${flipRgb.b},${0.02 * intensity})`
    );
    hueShiftGrad.addColorStop(
      1,
      `rgba(${hueShift2.r},${hueShift2.g},${hueShift2.b},${0.04 * intensity})`
    );

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = hueShiftGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Step 4: Final clearcoat highlight
  const clearcoatGrad = ctx.createRadialGradient(
    width * beamPosition,
    height * (1 - beamPosition),
    0,
    width * beamPosition,
    height * (1 - beamPosition),
    width * 0.8
  );
  clearcoatGrad.addColorStop(0, `rgba(255,255,255,${0.15 * intensity})`);
  clearcoatGrad.addColorStop(0.3, `rgba(255,255,255,${0.05 * intensity})`);
  clearcoatGrad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = clearcoatGrad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
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

  const showMetallicControls = settings.finish === "METALLIC";
  const showPearlControls = settings.finish === "PEARL";

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
          {/* Metallic Controls - simplified like Pearl */}
          {showMetallicControls && (
            <Card>
              <CardHeader className="py-3">
                <span className="text-base font-semibold">Efeito Metálico</span>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Flake Color - now labeled like pearl */}
                <div className="flex items-center justify-between">
                  <Label>Cor do Efeito</Label>
                  <input
                    type="color"
                    value={settings.flakeColor}
                    onChange={(e) => updateSetting("flakeColor", e.target.value)}
                    className="w-16 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>

                {/* Position */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Posição</Label>
                    <span className="text-sm text-muted-foreground">{settings.lightPosition}</span>
                  </div>
                  <Slider
                    value={[settings.lightPosition]}
                    onValueChange={([v]) => updateSetting("lightPosition", v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                {/* Intensity */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Intensidade</Label>
                    <span className="text-sm text-muted-foreground">{settings.lightIntensity}</span>
                  </div>
                  <Slider
                    value={[settings.lightIntensity]}
                    onValueChange={([v]) => updateSetting("lightIntensity", v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                {/* Spread */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Abertura</Label>
                    <span className="text-sm text-muted-foreground">{settings.lightSpread}</span>
                  </div>
                  <Slider
                    value={[settings.lightSpread]}
                    onValueChange={([v]) => updateSetting("lightSpread", v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                  </div>
                </CardContent>
              </Card>
          )}

          {/* Pearl Controls - unified with light */}
          {showPearlControls && (
            <Card>
              <CardHeader className="py-3">
                <span className="text-base font-semibold">Efeito Perolado</span>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Flip Color */}
                <div className="flex items-center justify-between">
                  <Label>Cor de Interferência</Label>
                  <input
                    type="color"
                    value={settings.flipColor}
                    onChange={(e) => updateSetting("flipColor", e.target.value)}
                    className="w-16 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>

                {/* Position */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Posição</Label>
                    <span className="text-sm text-muted-foreground">{settings.lightPosition}</span>
                  </div>
                  <Slider
                    value={[settings.lightPosition]}
                    onValueChange={([v]) => updateSetting("lightPosition", v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                {/* Intensity */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Intensidade</Label>
                    <span className="text-sm text-muted-foreground">{settings.lightIntensity}</span>
                  </div>
                  <Slider
                    value={[settings.lightIntensity]}
                    onValueChange={([v]) => updateSetting("lightIntensity", v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                {/* Spread */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Abertura</Label>
                    <span className="text-sm text-muted-foreground">{settings.lightSpread}</span>
                  </div>
                  <Slider
                    value={[settings.lightSpread]}
                    onValueChange={([v]) => updateSetting("lightSpread", v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Solid finish - basic light controls */}
          {settings.finish === "SOLID" && (
            <Card>
              <CardHeader className="py-3">
                <span className="text-base font-semibold">Luz</span>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Position */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Posição</Label>
                    <span className="text-sm text-muted-foreground">{settings.lightPosition}</span>
                  </div>
                  <Slider
                    value={[settings.lightPosition]}
                    onValueChange={([v]) => updateSetting("lightPosition", v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                {/* Intensity */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Intensidade</Label>
                    <span className="text-sm text-muted-foreground">{settings.lightIntensity}</span>
                  </div>
                  <Slider
                    value={[settings.lightIntensity]}
                    onValueChange={([v]) => updateSetting("lightIntensity", v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                {/* Spread */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Abertura</Label>
                    <span className="text-sm text-muted-foreground">{settings.lightSpread}</span>
                  </div>
                  <Slider
                    value={[settings.lightSpread]}
                    onValueChange={([v]) => updateSetting("lightSpread", v)}
                    min={0}
                    max={100}
                    step={1}
                  />
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
