import {
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
import { Plus, Trash2, Sun, ArrowDownRight, Eclipse } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";

// =====================
// Types
// =====================

export type PaintFinishType = "SOLID" | "METALLIC" | "PEARL";
export type LightType = "BEAM" | "LINEAR";

export interface LightSource {
  id: string;
  type: LightType;
  color: string; // Color determines behavior: light colors → screen (brighten), dark colors → multiply (darken)
  positionX: number; // 0-100 horizontal position
  positionY: number; // 0-100 vertical position
  rotation: number; // 0-360 degrees — angle of LINEAR band (0=horizontal, 90=vertical, 45=diagonal)
  intensity: number; // 0-100 strength
  spread: number; // 0-100 how wide the source spreads (aperture)
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
  positionX: 50,
  positionY: 50,
  rotation: 45, // Default diagonal (matches original behavior)
  intensity: 70,
  spread: 50,
});

const DEFAULT_SETTINGS: PaintPreviewSettings = {
  baseColor: "#3498db",
  finish: "SOLID",
  lights: [],
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

/**
 * Perceived brightness (0-1). Uses standard luminance weights.
 * > 0.5 = light color → screen blend (brightens)
 * ≤ 0.5 = dark color → multiply blend (darkens)
 */
function getColorLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

function isLightColor(hex: string): boolean {
  return getColorLuminance(hex) > 0.5;
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
    if (process.env.NODE_ENV !== 'production') {
      console.warn("Failed to load some textures:", e);
    }
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
// Light Rendering (screen blend — brightens)
// =====================

/**
 * BEAM Light (Focal/Point)
 * Uses screen composite — light colors brighten the surface.
 */
function renderBeamLight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  light: LightSource
): void {
  const intensity = light.intensity / 100;
  const spread = light.spread / 100;
  const lightRgb = hexToRgb(light.color);

  if (intensity <= 0) return;

  const centerX = width * (light.positionX / 100);
  const centerY = height * (light.positionY / 100);

  const minRadius = Math.min(width, height) * 0.1;
  const maxRadius = Math.max(width, height) * 0.7;
  const radius = minRadius + spread * (maxRadius - minRadius);

  const beamGradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, radius
  );

  const coreAlpha = Math.min(1, 0.95 * intensity);
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k = 3.0 + (1 - spread) * 5.0;
    const falloff = Math.exp(-k * t * t);
    const alpha = coreAlpha * falloff;
    beamGradient.addColorStop(t, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},${alpha})`);
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = beamGradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Compute linear gradient endpoints from rotation angle.
 * The gradient runs perpendicular to the band direction.
 * positionX/positionY offset the band center on the canvas.
 * rotation: 0=horizontal band, 90=vertical band, 45=diagonal.
 */
function getLinearGradientEndpoints(
  width: number,
  height: number,
  light: LightSource
): { x1: number; y1: number; x2: number; y2: number; peakT: number } {
  const angleRad = (light.rotation * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // Center the band at the positionX/positionY point
  const cx = width * (light.positionX / 100);
  const cy = height * (light.positionY / 100);

  // Extend gradient long enough to cover the full canvas
  const diag = Math.sqrt(width * width + height * height);
  const halfLen = diag / 2;

  return {
    x1: cx - cos * halfLen,
    y1: cy - sin * halfLen,
    x2: cx + cos * halfLen,
    y2: cy + sin * halfLen,
    peakT: 0.5, // Band peak is always at the center of our gradient
  };
}

/**
 * LINEAR Light (Strip/Band)
 * Uses screen composite — light colors brighten along a rotatable band.
 */
function renderLinearLight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  light: LightSource
): void {
  const intensity = light.intensity / 100;
  const spread = light.spread / 100;
  const lightRgb = hexToRgb(light.color);

  if (intensity <= 0) return;

  const halfWidth = 0.04 + spread * 0.25;
  const peakAlpha = Math.min(1, 0.95 * intensity);

  const { x1, y1, x2, y2, peakT } = getLinearGradientEndpoints(width, height, light);
  const linearGradient = ctx.createLinearGradient(x1, y1, x2, y2);

  const steps = 20;
  const k = 3.0 + (1 - spread) * 5.0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const dist = (t - peakT) / halfWidth;
    const falloff = Math.exp(-k * dist * dist);
    const alpha = peakAlpha * falloff;
    linearGradient.addColorStop(t, `rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},${alpha})`);
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = linearGradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// =====================
// Shadow Rendering (multiply blend — darkens)
// =====================

/**
 * BEAM Shadow (Focal/Point)
 * Uses multiply composite — dark colors darken the surface.
 */
function renderBeamShadow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  light: LightSource
): void {
  const intensity = light.intensity / 100;
  const spread = light.spread / 100;
  const shadowRgb = hexToRgb(light.color);

  if (intensity <= 0) return;

  const centerX = width * (light.positionX / 100);
  const centerY = height * (light.positionY / 100);

  const minRadius = Math.min(width, height) * 0.1;
  const maxRadius = Math.max(width, height) * 0.7;
  const radius = minRadius + spread * (maxRadius - minRadius);

  const beamGradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, radius
  );

  // For multiply: interpolate from shadow color (dark) at center to white (no effect) at edges
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k = 3.0 + (1 - spread) * 5.0;
    const falloff = Math.exp(-k * t * t);
    const factor = falloff * intensity;
    const r = Math.round(255 - (255 - shadowRgb.r) * factor);
    const g = Math.round(255 - (255 - shadowRgb.g) * factor);
    const b = Math.round(255 - (255 - shadowRgb.b) * factor);
    beamGradient.addColorStop(t, `rgb(${r},${g},${b})`);
  }

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = beamGradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * LINEAR Shadow (Strip/Band)
 * Uses multiply composite — dark colors darken along a rotatable band.
 */
function renderLinearShadow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  light: LightSource
): void {
  const intensity = light.intensity / 100;
  const spread = light.spread / 100;
  const shadowRgb = hexToRgb(light.color);

  if (intensity <= 0) return;

  const halfWidth = 0.04 + spread * 0.25;

  const { x1, y1, x2, y2, peakT } = getLinearGradientEndpoints(width, height, light);
  const linearGradient = ctx.createLinearGradient(x1, y1, x2, y2);

  const steps = 20;
  const k = 3.0 + (1 - spread) * 5.0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const dist = (t - peakT) / halfWidth;
    const falloff = Math.exp(-k * dist * dist);
    const factor = falloff * intensity;
    const r = Math.round(255 - (255 - shadowRgb.r) * factor);
    const g = Math.round(255 - (255 - shadowRgb.g) * factor);
    const b = Math.round(255 - (255 - shadowRgb.b) * factor);
    linearGradient.addColorStop(t, `rgb(${r},${g},${b})`);
  }

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
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
 * 4. Light & Shadow sources — blend mode auto-detected from color brightness
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
  // LAYER 4: Light & Shadow Sources
  // Blend mode is auto-detected from color brightness:
  //   Light color (luminance > 50%) → screen (brightens)
  //   Dark color (luminance ≤ 50%) → multiply (darkens)
  // ========================================
  for (const light of settings.lights) {
    if (isLightColor(light.color)) {
      if (light.type === "BEAM") renderBeamLight(ctx, width, height, light);
      else renderLinearLight(ctx, width, height, light);
    } else {
      if (light.type === "BEAM") renderBeamShadow(ctx, width, height, light);
      else renderLinearShadow(ctx, width, height, light);
    }
  }

  // ========================================
  // LAYER 5: Clearcoat Highlight (based on first light-colored source)
  // ========================================
  const primaryLight = settings.lights.find((l) => isLightColor(l.color));
  if (primaryLight) {
    const primaryIntensity = primaryLight.intensity / 100;

    if (primaryIntensity > 0) {
      const clearcoatGrad = ctx.createRadialGradient(
        width * (primaryLight.positionX / 100),
        height * (primaryLight.positionY / 100),
        0,
        width * (primaryLight.positionX / 100),
        height * (primaryLight.positionY / 100),
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

  const [settings, setSettings] = useState<PaintPreviewSettings>(() => {
    const merged = {
      ...DEFAULT_SETTINGS,
      baseColor,
      finish,
      ...initialSettings,
    };
    // Backward compatibility: migrate old fields
    if (merged.lights) {
      merged.lights = merged.lights.map((light: any) => ({
        ...light,
        positionX: light.positionX ?? light.position ?? 50,
        positionY: light.positionY ?? light.position ?? 50,
        rotation: light.rotation ?? 45,
      }));
    }
    return merged;
  });

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
                <span className="text-base font-semibold">Fontes de Luz / Sombra</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addLight}
                  title="Adicionar fonte"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.lights.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhuma fonte configurada. Adicione uma acima.
                </p>
              )}

              {settings.lights.map((light, index) => {
                const lightIsLight = isLightColor(light.color);
                return (
                <div key={light.id} className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {lightIsLight ? (
                        light.type === "BEAM" ? (
                          <Sun className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-blue-500" />
                        )
                      ) : (
                        <Eclipse className="h-4 w-4 text-purple-500" />
                      )}
                      <span className="text-sm font-medium">
                        {lightIsLight ? "Luz" : "Sombra"} {index + 1}
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

                      {/* Source Color — light colors brighten, dark colors darken */}
                      <input
                        type="color"
                        value={light.color}
                        onChange={(e) => updateLight(light.id, "color", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                        title={lightIsLight ? "Cor clara = luz" : "Cor escura = sombra"}
                      />

                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLight(light.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Horizontal Position */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Horizontal</Label>
                      <span className="text-xs text-muted-foreground">{light.positionX}</span>
                    </div>
                    <Slider
                      value={[light.positionX]}
                      onValueChange={([v]) => updateLight(light.id, "positionX", v)}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* Vertical Position */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Vertical</Label>
                      <span className="text-xs text-muted-foreground">{light.positionY}</span>
                    </div>
                    <Slider
                      value={[light.positionY]}
                      onValueChange={([v]) => updateLight(light.id, "positionY", v)}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* Rotation — only for LINEAR type */}
                  {light.type === "LINEAR" && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Rotação</Label>
                        <span className="text-xs text-muted-foreground">{light.rotation}°</span>
                      </div>
                      <Slider
                        value={[light.rotation]}
                        onValueChange={([v]) => updateLight(light.id, "rotation", v)}
                        min={0}
                        max={360}
                        step={1}
                      />
                      <p className="text-xs text-muted-foreground">
                        0° horizontal · 90° vertical · 45° diagonal
                      </p>
                    </div>
                  )}

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
                );
              })}
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
