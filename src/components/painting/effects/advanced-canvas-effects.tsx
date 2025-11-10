import React, { useRef, useEffect, useCallback } from "react";
import { PAINT_FINISH } from "../../../constants";

export interface AdvancedCanvasEffectsProps {
  /**
   * Base color in hex format
   */
  baseColor: string;

  /**
   * Paint finish type
   */
  finish: PAINT_FINISH;

  /**
   * Canvas dimensions
   */
  width: number;
  height: number;

  /**
   * Whether animations should be disabled
   */
  disableAnimations?: boolean;

  /**
   * Additional CSS class for the canvas
   */
  className?: string;
}

/**
 * Hex color to RGB conversion
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

/**
 * Create metallic sparkle effect
 */
const renderMetallicEffect = (ctx: CanvasRenderingContext2D, width: number, height: number, baseColor: string, time: number) => {
  const rgb = hexToRgb(baseColor);

  // Base color
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  // Metallic gradient overlay
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `rgba(${rgb.r + 30}, ${rgb.g + 30}, ${rgb.b + 30}, 0.3)`);
  gradient.addColorStop(0.5, `rgba(${Math.min(255, rgb.r + 60)}, ${Math.min(255, rgb.g + 60)}, ${Math.min(255, rgb.b + 60)}, 0.1)`);
  gradient.addColorStop(1, `rgba(${rgb.r + 20}, ${rgb.g + 20}, ${rgb.b + 20}, 0.2)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Animated sparkles
  const sparkleCount = Math.floor((width * height) / 1000);
  for (let i = 0; i < sparkleCount; i++) {
    const x = (Math.sin(time * 0.001 + i) * 0.5 + 0.5) * width;
    const y = (Math.cos(time * 0.0008 + i * 0.7) * 0.5 + 0.5) * height;
    const size = Math.sin(time * 0.003 + i * 0.3) * 2 + 3;
    const opacity = Math.sin(time * 0.005 + i * 0.5) * 0.5 + 0.5;

    const sparkleGradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    sparkleGradient.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.8})`);
    sparkleGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = sparkleGradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
};

/**
 * Create pearl iridescent effect
 */
const renderPearlEffect = (ctx: CanvasRenderingContext2D, width: number, height: number, baseColor: string, time: number) => {
  const rgb = hexToRgb(baseColor);

  // Base color
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  // Iridescent overlay with color shifting
  const hueShift = Math.sin(time * 0.001) * 30;
  const iridescent1 = ctx.createRadialGradient(width * 0.3, height * 0.3, 0, width * 0.3, height * 0.3, width * 0.7);

  // Calculate shifted colors
  const hsl1 = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hsl2 = { ...hsl1, h: (hsl1.h + hueShift + 60) % 360 };
  const hsl3 = { ...hsl1, h: (hsl1.h + hueShift - 60) % 360 };

  const rgb2 = hslToRgb(hsl2.h, hsl2.s, hsl2.l);
  const rgb3 = hslToRgb(hsl3.h, hsl3.s, hsl3.l);

  iridescent1.addColorStop(0, `rgba(${rgb2.r}, ${rgb2.g}, ${rgb2.b}, 0.4)`);
  iridescent1.addColorStop(0.5, `rgba(${rgb3.r}, ${rgb3.g}, ${rgb3.b}, 0.3)`);
  iridescent1.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);

  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = iridescent1;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";

  // Pearl particles
  const particleCount = Math.floor((width * height) / 2000);
  for (let i = 0; i < particleCount; i++) {
    const x = (Math.sin(time * 0.0008 + i * 1.2) * 0.5 + 0.5) * width;
    const y = (Math.cos(time * 0.0006 + i * 0.9) * 0.5 + 0.5) * height;
    const sizeX = Math.sin(time * 0.002 + i) * 3 + 5;
    const sizeY = sizeX * 0.6;
    const opacity = Math.sin(time * 0.004 + i * 0.8) * 0.3 + 0.4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 0.001 + i);

    const pearlGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, sizeX);
    pearlGradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
    pearlGradient.addColorStop(0.7, `rgba(255, 255, 255, ${opacity * 0.3})`);
    pearlGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = pearlGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, sizeX, sizeY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

/**
 * Create matte texture effect
 */
const renderMatteEffect = (ctx: CanvasRenderingContext2D, width: number, height: number, baseColor: string) => {
  const rgb = hexToRgb(baseColor);

  // Base color with reduced brightness
  ctx.fillStyle = `rgb(${Math.floor(rgb.r * 0.9)}, ${Math.floor(rgb.g * 0.9)}, ${Math.floor(rgb.b * 0.9)})`;
  ctx.fillRect(0, 0, width, height);

  // Add texture noise
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 20;
    data[i] = Math.max(0, Math.min(255, data[i] + noise)); // R
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
  }

  ctx.putImageData(imageData, 0, 0);
};

/**
 * Create solid/varnish effect with reflection
 */
const renderSolidEffect = (ctx: CanvasRenderingContext2D, width: number, height: number, baseColor: string) => {
  // Base color
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  // Glossy reflection
  const reflection = ctx.createLinearGradient(0, 0, width, height * 0.6);
  reflection.addColorStop(0, `rgba(255, 255, 255, 0.4)`);
  reflection.addColorStop(0.3, `rgba(255, 255, 255, 0.1)`);
  reflection.addColorStop(1, `rgba(255, 255, 255, 0)`);

  ctx.fillStyle = reflection;
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.2, width * 0.4, height * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sharp highlight
  const highlight = ctx.createRadialGradient(width * 0.3, height * 0.2, 0, width * 0.3, height * 0.2, width * 0.2);
  highlight.addColorStop(0, `rgba(255, 255, 255, 0.6)`);
  highlight.addColorStop(0.5, `rgba(255, 255, 255, 0.2)`);
  highlight.addColorStop(1, `rgba(255, 255, 255, 0)`);

  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.arc(width * 0.3, height * 0.2, width * 0.15, 0, Math.PI * 2);
  ctx.fill();
};

/**
 * HSL to RGB conversion helper
 */
const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
  h /= 360;
  s /= 100;
  l /= 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

/**
 * RGB to HSL conversion helper
 */
const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
      default:
        h = 0;
    }
    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
};

export const AdvancedCanvasEffects: React.FC<AdvancedCanvasEffectsProps> = ({ baseColor, finish, width, height, disableAnimations = false, className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const render = useCallback(
    (time?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      const currentTime = time || Date.now();

      // Render based on finish type
      switch (finish) {
        case PAINT_FINISH.METALLIC:
          renderMetallicEffect(ctx, width, height, baseColor, currentTime);
          break;
        case PAINT_FINISH.PEARL:
          renderPearlEffect(ctx, width, height, baseColor, currentTime);
          break;
        case PAINT_FINISH.MATTE:
          renderMatteEffect(ctx, width, height, baseColor);
          break;
        case PAINT_FINISH.SOLID:
          renderSolidEffect(ctx, width, height, baseColor);
          break;
        case PAINT_FINISH.SATIN:
          // Similar to solid but with reduced reflection
          renderSolidEffect(ctx, width, height, baseColor);
          break;
        default:
          // Fallback to base color
          ctx.fillStyle = baseColor;
          ctx.fillRect(0, 0, width, height);
      }
    },
    [baseColor, finish, width, height],
  );

  const animate = useCallback(() => {
    if (disableAnimations) {
      render();
      return;
    }

    const currentTime = Date.now();
    render(currentTime);

    // Continue animation for effects that need it
    if (finish === PAINT_FINISH.METALLIC || finish === PAINT_FINISH.PEARL) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [render, disableAnimations, finish]);

  useEffect(() => {
    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  return <canvas ref={canvasRef} className={`absolute inset-0 pointer-events-none ${className}`} style={{ borderRadius: "inherit" }} />;
};

export default AdvancedCanvasEffects;
