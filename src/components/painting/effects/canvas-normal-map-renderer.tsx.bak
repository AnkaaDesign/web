import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { PAINT_FINISH } from "../../../constants";
import { getFinishProperties, hasNormalMap } from "./paint-finish-config";

interface CanvasNormalMapRendererProps {
  baseColor: string;
  finish: PAINT_FINISH;
  width?: number;
  height?: number;
  lightPosition?: { x: number; y: number };
  className?: string;
  quality?: "low" | "medium" | "high";
}

// Cache for gradients and processed data
const gradientCache = new Map<string, CanvasGradient>();
const processedNormalCache = new Map<string, ImageData>();
const flakeOverlayCache = new Map<string, HTMLCanvasElement>();

export function CanvasNormalMapRenderer({
  baseColor,
  finish,
  width = 400,
  height = 400,
  lightPosition: _initialLightPos = undefined,
  className = "",
  quality = "high",
}: CanvasNormalMapRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const normalMapRef = useRef<HTMLImageElement | null>(null);
  const flakeTextureRef = useRef<HTMLImageElement | null>(null);
  const [isTextureLoading, setIsTextureLoading] = useState(true);
  const [flakeTextureLoaded, setFlakeTextureLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [hasRendered, setHasRendered] = useState(false);
  const renderTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Quality settings
  const qualitySettings = useMemo(() => {
    switch (quality) {
      case "low":
        return { particleMultiplier: 0.2, normalMapIntensity: 0.1, skipFlakes: true };
      case "medium":
        return { particleMultiplier: 0.5, normalMapIntensity: 0.12, skipFlakes: false };
      case "high":
      default:
        return { particleMultiplier: 1, normalMapIntensity: 0.15, skipFlakes: false };
    }
  }, [quality]);

  // Static light positions for each finish
  const getLightPosition = useCallback(() => {
    switch (finish) {
      case PAINT_FINISH.METALLIC:
        return { x: width * 0.3, y: height * 0.3 };
      case PAINT_FINISH.PEARL:
        return { x: width * 0.75, y: height * 0.25 };
      case PAINT_FINISH.SOLID:
        return { x: width * 0.7, y: height * 0.3 };
      case PAINT_FINISH.SATIN:
        return { x: width * 0.8, y: height * 0.5 };
      case PAINT_FINISH.MATTE:
        return { x: width * 0.5, y: height * 0.5 };
      default:
        return { x: width * 0.5, y: height * 0.3 };
    }
  }, [finish, width, height]);

  const lightPosition = getLightPosition();
  const config = getFinishProperties(finish);

  // Intersection Observer for viewport detection
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Load normal map if available
  useEffect(() => {
    if (!hasNormalMap(finish)) {
      setIsTextureLoading(false);
      return;
    }

    const normalMap = new Image();
    normalMap.crossOrigin = "anonymous";

    normalMap.onload = () => {
      normalMapRef.current = normalMap;
      setIsTextureLoading(false);
    };

    normalMap.onerror = () => {
      console.warn(`Failed to load normal map for ${finish}`);
      setIsTextureLoading(false);
    };

    normalMap.src = config.normalMap!;

    return () => {
      normalMapRef.current = null;
    };
  }, [finish, config.normalMap]);

  // Load flake texture for metallic/pearl finishes
  useEffect(() => {
    if (qualitySettings.skipFlakes || (finish !== PAINT_FINISH.METALLIC && finish !== PAINT_FINISH.PEARL)) {
      setFlakeTextureLoaded(false);
      return;
    }

    const flakeTexture = new Image();
    flakeTexture.crossOrigin = "anonymous";

    flakeTexture.onload = () => {
      flakeTextureRef.current = flakeTexture;
      setFlakeTextureLoaded(true);
    };

    flakeTexture.onerror = () => {
      console.warn(`Failed to load flake texture`);
      setFlakeTextureLoaded(false);
    };

    flakeTexture.src = "/flake.jpg";

    return () => {
      flakeTextureRef.current = null;
      setFlakeTextureLoaded(false);
    };
  }, [finish, qualitySettings.skipFlakes]);

  // Convert hex to RGB
  const hexToRgb = useCallback((hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }, []);

  // Create lighter version of base color
  const getLighterColor = useCallback((rgb: { r: number; g: number; b: number }, factor: number = 1.3): string => {
    const r = Math.min(255, Math.floor(rgb.r * factor));
    const g = Math.min(255, Math.floor(rgb.g * factor));
    const b = Math.min(255, Math.floor(rgb.b * factor));
    return `${r}, ${g}, ${b}`;
  }, []);

  // Optimized normal mapping with caching
  const applyNormalMapping = useCallback(
    (ctx: CanvasRenderingContext2D, normalData: ImageData, baseRgb: { r: number; g: number; b: number }) => {
      const cacheKey = `${finish}_${width}_${height}_${baseColor}`;

      // Check cache first
      if (processedNormalCache.has(cacheKey)) {
        return processedNormalCache.get(cacheKey)!;
      }

      const output = ctx.createImageData(width, height);
      const outputData = output.data;
      const normalPixels = normalData.data;

      const lightZ = 100;
      const ambientLight = finish === PAINT_FINISH.MATTE ? 0.6 : finish === PAINT_FINISH.METALLIC ? 0.5 : finish === PAINT_FINISH.PEARL ? 0.45 : 0.3;
      const diffuseStrength = finish === PAINT_FINISH.MATTE ? 0.5 : 1.2;
      const specularStrength = config.specularIntensity * 1.3;
      const normalMapIntensity = qualitySettings.normalMapIntensity;

      // Process pixels in chunks for better performance
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;

          const nx = ((normalPixels[i] / 255) * 2 - 1) * normalMapIntensity;
          const ny = ((normalPixels[i + 1] / 255) * 2 - 1) * normalMapIntensity;
          const nz = Math.max(0.5, ((normalPixels[i + 2] / 255) * 2 - 1) * normalMapIntensity);

          const lx = lightPosition.x - x;
          const ly = lightPosition.y - y;
          const lz = lightZ;
          const lightDist = Math.sqrt(lx * lx + ly * ly + lz * lz);

          const lightXNorm = lx / lightDist;
          const lightYNorm = ly / lightDist;
          const lightZNorm = lz / lightDist;

          const dotProduct = Math.max(0, nx * lightXNorm + ny * lightYNorm + nz * lightZNorm);
          const diffuse = dotProduct * diffuseStrength;

          const viewZ = 1;
          const halfX = lightXNorm;
          const halfY = lightYNorm;
          const halfZ = (lightZNorm + viewZ) / 2;
          const halfLength = Math.sqrt(halfX * halfX + halfY * halfY + halfZ * halfZ);
          const specularDot = Math.max(0, nx * (halfX / halfLength) + ny * (halfY / halfLength) + nz * (halfZ / halfLength));
          const specular = Math.pow(specularDot, 32) * specularStrength;

          const lightBoost = finish === PAINT_FINISH.METALLIC || finish === PAINT_FINISH.PEARL ? 1.2 : 1.0;
          const totalLight = Math.min(1.2, (ambientLight + diffuse + specular * config.reflectivity) * lightBoost);

          outputData[i] = Math.min(255, baseRgb.r * totalLight + specular * 255 * config.metalness);
          outputData[i + 1] = Math.min(255, baseRgb.g * totalLight + specular * 255 * config.metalness);
          outputData[i + 2] = Math.min(255, baseRgb.b * totalLight + specular * 255 * config.metalness);
          outputData[i + 3] = 255;
        }
      }

      // Cache the result
      processedNormalCache.set(cacheKey, output);

      // Limit cache size
      if (processedNormalCache.size > 10) {
        const firstKey = processedNormalCache.keys().next().value;
        if (firstKey !== undefined) {
          processedNormalCache.delete(firstKey);
        }
      }

      return output;
    },
    [lightPosition, width, height, finish, config, baseColor, qualitySettings],
  );

  // Pre-create flake overlay
  const createFlakeOverlay = useCallback(() => {
    const cacheKey = `${finish}_${width}_${height}`;

    if (flakeOverlayCache.has(cacheKey)) {
      return flakeOverlayCache.get(cacheKey)!;
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: false });

    if (tempCtx && flakeTextureRef.current) {
      tempCtx.drawImage(flakeTextureRef.current, 0, 0, width, height);

      if (finish === PAINT_FINISH.PEARL) {
        const colors = [
          { h: 280, s: 20, l: 80 },
          { h: 200, s: 25, l: 82 },
          { h: 340, s: 20, l: 80 },
        ];

        colors.forEach((color, index) => {
          tempCtx.save();
          tempCtx.globalCompositeOperation = "overlay";
          tempCtx.globalAlpha = 0.1;

          const angle = ((index * 120 + 30) * Math.PI) / 180;
          const gradient = tempCtx.createLinearGradient(
            width / 2 + (Math.cos(angle) * width) / 2,
            height / 2 + (Math.sin(angle) * height) / 2,
            width / 2 - (Math.cos(angle) * width) / 2,
            height / 2 - (Math.sin(angle) * height) / 2,
          );

          gradient.addColorStop(0, "transparent");
          gradient.addColorStop(0.3, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.3)`);
          gradient.addColorStop(0.5, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.4)`);
          gradient.addColorStop(0.7, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.3)`);
          gradient.addColorStop(1, "transparent");

          tempCtx.fillStyle = gradient;
          tempCtx.fillRect(0, 0, width, height);
          tempCtx.restore();
        });
      }

      flakeOverlayCache.set(cacheKey, tempCanvas);
      // Limit cache size
      if (flakeOverlayCache.size > 5) {
        const firstKey = flakeOverlayCache.keys().next().value;
        if (firstKey !== undefined) {
          flakeOverlayCache.delete(firstKey);
        }
      }
    }

    return tempCanvas;
  }, [finish, width, height]);

  // Optimized sparkle particles
  const addSparkleParticles = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!config.particleEffect?.enabled || quality === "low") return;

      const particles = Math.floor(config.particleEffect.density * 5 * qualitySettings.particleMultiplier);
      const baseRgb = hexToRgb(baseColor);

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      // Pre-calculate all particle positions
      for (let i = 0; i < particles; i++) {
        const seed = i * 137.5;
        const x = (seed * 7.1) % width;
        const y = (seed * 13.7) % height;

        const sparkle = 0.9;
        const size = config.particleEffect.size * 0.02;

        const r = Math.floor(baseRgb.r + (255 - baseRgb.r) * sparkle);
        const g = Math.floor(baseRgb.g + (255 - baseRgb.g) * sparkle);
        const b = Math.floor(baseRgb.b + (255 - baseRgb.b) * sparkle);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
        ctx.fillRect(x - size, y - size, size * 2, size * 2);
      }

      ctx.restore();
    },
    [config, width, height, baseColor, quality, qualitySettings],
  );

  // Main render function - now static, no animation
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    const ctx = canvas.getContext("2d", {
      alpha: false,
      willReadFrequently: false,
    });
    if (!ctx) return;

    const baseRgb = hexToRgb(baseColor);

    // Clear canvas with base color
    if (finish === PAINT_FINISH.METALLIC || finish === PAINT_FINISH.PEARL) {
      const lighterBase = getLighterColor(baseRgb, 1.15);
      ctx.fillStyle = `rgba(${lighterBase})`;
    } else {
      ctx.fillStyle = baseColor;
    }
    ctx.fillRect(0, 0, width, height);

    // Apply normal mapping
    if (normalMapRef.current && hasNormalMap(finish)) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext("2d");

      if (tempCtx) {
        tempCtx.drawImage(normalMapRef.current, 0, 0, width, height);
        const normalData = tempCtx.getImageData(0, 0, width, height);
        const output = applyNormalMapping(ctx, normalData, baseRgb);
        ctx.putImageData(output, 0, 0);
      }
    }

    // Apply finish-specific effects
    switch (finish) {
      case PAINT_FINISH.METALLIC:
        ctx.save();
        ctx.globalCompositeOperation = "overlay";

        // Suppress unused parameter warning
        void _initialLightPos;

        // Get or create cached gradient
        const metallicKey = `metallic_${width}_${height}`;
        let metallicGradient = gradientCache.get(metallicKey);

        if (!metallicGradient) {
          metallicGradient = ctx.createLinearGradient(width * 0.1, height * 0.4, width * 0.9, height * 0.6);
          metallicGradient.addColorStop(0, "transparent");
          metallicGradient.addColorStop(0.35, "rgba(255,255,255,0.15)");
          metallicGradient.addColorStop(0.5, "rgba(255,255,255,0.25)");
          metallicGradient.addColorStop(0.65, "rgba(255,255,255,0.15)");
          metallicGradient.addColorStop(1, "transparent");
          gradientCache.set(metallicKey, metallicGradient);
        }

        ctx.fillStyle = metallicGradient;
        ctx.fillRect(0, 0, width, height);

        // Static anisotropic bands
        ctx.globalCompositeOperation = "soft-light";
        ctx.globalAlpha = 0.4;

        const bandKey = `band_${height}`;
        let bandGradient = gradientCache.get(bandKey);

        if (!bandGradient) {
          bandGradient = ctx.createLinearGradient(0, 0, 0, height);
          for (let i = 0; i < 20; i++) {
            const pos = i / 20;
            const intensity = Math.sin(pos * Math.PI * 8) * 0.5 + 0.5;
            bandGradient.addColorStop(pos, `rgba(255,255,255,${intensity * 0.3})`);
          }
          gradientCache.set(bandKey, bandGradient);
        }

        ctx.fillStyle = bandGradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        break;

      case PAINT_FINISH.PEARL:
        ctx.save();
        ctx.globalCompositeOperation = "overlay";

        const pearlKey = `pearl_${width}_${height}`;
        let pearlGradient = gradientCache.get(pearlKey);

        if (!pearlGradient) {
          pearlGradient = ctx.createLinearGradient(width * 0.8, 0, width * 0.2, height);
          pearlGradient.addColorStop(0, "transparent");
          pearlGradient.addColorStop(0.2, "rgba(255, 182, 193, 0.25)");
          pearlGradient.addColorStop(0.35, "rgba(255, 255, 255, 0.35)");
          pearlGradient.addColorStop(0.5, "rgba(173, 216, 230, 0.3)");
          pearlGradient.addColorStop(0.65, "rgba(255, 255, 255, 0.25)");
          pearlGradient.addColorStop(0.8, "rgba(255, 192, 203, 0.2)");
          pearlGradient.addColorStop(1, "transparent");
          gradientCache.set(pearlKey, pearlGradient);
        }

        ctx.fillStyle = pearlGradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        break;

      case PAINT_FINISH.MATTE:
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        break;

      case PAINT_FINISH.SOLID:
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.15;

        const varnishKey = `varnish_${width}_${height}`;
        let varnishGradient = gradientCache.get(varnishKey);

        if (!varnishGradient) {
          varnishGradient = ctx.createLinearGradient(0, 0, width, height);
          varnishGradient.addColorStop(0, "rgba(255,255,255,0.1)");
          varnishGradient.addColorStop(0.5, "rgba(255,255,255,0.05)");
          varnishGradient.addColorStop(1, "rgba(255,255,255,0.1)");
          gradientCache.set(varnishKey, varnishGradient);
        }

        ctx.fillStyle = varnishGradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        break;

      case PAINT_FINISH.SATIN:
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.12;

        const satinKey = `satin_${lightPosition.y}`;
        let satinGradient = gradientCache.get(satinKey);

        if (!satinGradient) {
          satinGradient = ctx.createLinearGradient(0, lightPosition.y - 80, 0, lightPosition.y + 80);
          satinGradient.addColorStop(0, "transparent");
          satinGradient.addColorStop(0.4, "rgba(255,255,255,0.1)");
          satinGradient.addColorStop(0.5, "rgba(255,255,255,0.15)");
          satinGradient.addColorStop(0.6, "rgba(255,255,255,0.1)");
          satinGradient.addColorStop(1, "transparent");
          gradientCache.set(satinKey, satinGradient);
        }

        ctx.fillStyle = satinGradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        break;
    }

    // Add flake texture effect
    if ((finish === PAINT_FINISH.METALLIC || finish === PAINT_FINISH.PEARL) && flakeTextureLoaded && !qualitySettings.skipFlakes) {
      const flakeOverlay = createFlakeOverlay();
      if (flakeOverlay) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = finish === PAINT_FINISH.METALLIC ? 0.3 : 0.2;
        ctx.drawImage(flakeOverlay, 0, 0);
        ctx.restore();
      }
    } else if (finish === PAINT_FINISH.METALLIC || finish === PAINT_FINISH.PEARL) {
      addSparkleParticles(ctx);
    }

    // Add clear coat effect
    if (config.clearCoat > 0) {
      ctx.save();

      const baseRgb = hexToRgb(baseColor);
      const lighterColor = getLighterColor(baseRgb, 1.3);
      const brightColor = getLighterColor(baseRgb, 1.5);

      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = config.clearCoat * 0.35;

      const clearCoatKey = `clearcoat_${finish}_${width}_${height}`;
      let glossGradient = gradientCache.get(clearCoatKey);

      if (!glossGradient) {
        const beamAngle = finish === PAINT_FINISH.METALLIC ? { x1: width * 0.1, y1: height * 0.4, x2: width * 0.9, y2: height * 0.6 } : { x1: width, y1: 0, x2: 0, y2: height };

        glossGradient = ctx.createLinearGradient(beamAngle.x1, beamAngle.y1, beamAngle.x2, beamAngle.y2);

        glossGradient.addColorStop(0, "transparent");
        glossGradient.addColorStop(0.35, `rgba(${lighterColor}, 0.05)`);
        glossGradient.addColorStop(0.45, `rgba(${lighterColor}, 0.15)`);
        glossGradient.addColorStop(0.5, `rgba(${brightColor}, 0.25)`);
        glossGradient.addColorStop(0.55, `rgba(${lighterColor}, 0.15)`);
        glossGradient.addColorStop(0.65, `rgba(${lighterColor}, 0.05)`);
        glossGradient.addColorStop(1, "transparent");

        gradientCache.set(clearCoatKey, glossGradient);
      }

      ctx.fillStyle = glossGradient;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // Mark as rendered successfully
    setHasRendered(true);
  }, [
    baseColor,
    finish,
    width,
    height,
    isVisible,
    applyNormalMapping,
    addSparkleParticles,
    config,
    flakeTextureLoaded,
    hexToRgb,
    getLighterColor,
    lightPosition,
    createFlakeOverlay,
    qualitySettings,
  ]);

  // Render when ready
  useEffect(() => {
    // Clear any existing timeout
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    // Only render when textures are loaded and visible
    if (!isTextureLoading && isVisible) {
      // Small delay to ensure DOM is ready
      renderTimeoutRef.current = setTimeout(() => {
        render();
      }, 50);
    }

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [isTextureLoading, isVisible, render]);

  // Re-render when props change
  useEffect(() => {
    setHasRendered(false);
  }, [baseColor, finish, width, height, quality]);

  // Show loading only while textures are loading OR canvas hasn't rendered yet
  const showLoading = isTextureLoading || !hasRendered;

  // Only use smaller rounding for very small sizes to prevent circular appearance
  const isSmallSize = width <= 24 || height <= 24;
  const borderRadiusStyle = isSmallSize ? { borderRadius: "0.25rem" } : {}; // 4px for small, default for others

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Fallback color background */}
      <div className="absolute inset-0 rounded-lg" style={{ backgroundColor: baseColor, ...borderRadiusStyle }} />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`relative rounded-lg shadow-lg ${className}`}
        style={{
          imageRendering: "auto",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: hasRendered ? 1 : 0,
          transition: "opacity 0.2s ease-in-out",
          ...borderRadiusStyle,
        }}
      />

      {/* Loading indicator */}
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg" style={borderRadiusStyle}>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/60"></div>
        </div>
      )}
    </div>
  );
}
