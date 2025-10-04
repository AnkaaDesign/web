import React, { useMemo, useRef, useEffect } from "react";
import { PAINT_FINISH } from "../../../constants";
import { formatHexColor, getContrastingTextColor } from "../catalogue/list/color-utils";
import { PAINT_FINISH_CONFIGS, generateSparkleParticles, type SparkleParticle } from "./paint-finish-config";
import "./paint-finish-effects.css";

export interface PaintFinishEffectProps {
  /**
   * Base color in hex format
   */
  baseColor: string;

  /**
   * Paint finish type
   */
  finish: PAINT_FINISH;

  /**
   * Container class name
   */
  className?: string;

  /**
   * Container style overrides
   */
  style?: React.CSSProperties;

  /**
   * Children to render over the paint effect
   */
  children?: React.ReactNode;

  /**
   * Whether to use Canvas API for complex effects (metallic sparkles)
   */
  useCanvas?: boolean;

  /**
   * Size of the container (affects particle density)
   */
  size?: "small" | "medium" | "large";

  /**
   * Whether animations should be disabled (for accessibility)
   */
  disableAnimations?: boolean;
}

/**
 * Canvas-based sparkle effect for metallic and pearl finishes
 */
const CanvasSparkles: React.FC<{
  particles: SparkleParticle[];
  color: string;
  width: number;
  height: number;
  disableAnimations?: boolean;
}> = ({ particles, width, height, disableAnimations }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    const animate = () => {
      if (disableAnimations) return;

      const currentTime = Date.now();
      const elapsed = (currentTime - startTimeRef.current) / 1000;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw particles
      particles.forEach((particle) => {
        const cycleTime = (elapsed + particle.delay / 1000) % 3;
        const intensity = Math.sin(cycleTime * Math.PI) * particle.intensity;

        if (intensity > 0) {
          const x = (particle.x / 100) * width;
          const y = (particle.y / 100) * height;
          const radius = particle.size * intensity;

          // Create gradient for sparkle
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
          gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (!disableAnimations) {
      animate();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [particles, width, height, disableAnimations]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ borderRadius: "inherit" }} />;
};

/**
 * SVG-based texture patterns for paint finishes
 */
const TexturePattern: React.FC<{
  finish: PAINT_FINISH;
  color: string;
  patternId: string;
}> = ({ finish, patternId }) => {
  const renderPattern = () => {
    switch (finish) {
      case PAINT_FINISH.MATTE:
        return (
          <pattern id={patternId} x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <rect width="50" height="50" fill="rgba(0,0,0,0.05)" />
            <circle cx="10" cy="10" r="0.5" fill="rgba(0,0,0,0.1)" />
            <circle cx="30" cy="20" r="0.3" fill="rgba(0,0,0,0.08)" />
            <circle cx="20" cy="35" r="0.4" fill="rgba(0,0,0,0.12)" />
            <circle cx="40" cy="40" r="0.2" fill="rgba(0,0,0,0.06)" />
          </pattern>
        );

      case PAINT_FINISH.METALLIC:
        return (
          <pattern id={patternId} x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
            <rect width="30" height="30" fill="rgba(200,200,200,0.1)" />
            <polygon points="15,5 17,8 20,7 18,11 22,13 18,15 20,19 17,18 15,22 13,18 10,19 12,15 8,13 12,11 10,7 13,8" fill="rgba(255,255,255,0.3)" />
            <circle cx="8" cy="8" r="0.5" fill="rgba(255,255,255,0.4)" />
            <circle cx="22" cy="22" r="0.3" fill="rgba(255,255,255,0.5)" />
          </pattern>
        );

      case PAINT_FINISH.PEARL:
        return (
          <pattern id={patternId} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="rgba(255,255,255,0.05)" />
            <ellipse cx="12" cy="12" rx="2" ry="1" fill="rgba(255,192,203,0.3)" />
            <ellipse cx="28" cy="8" rx="1.5" ry="0.8" fill="rgba(173,216,230,0.3)" />
            <ellipse cx="8" cy="28" rx="1.8" ry="0.9" fill="rgba(255,255,224,0.3)" />
            <ellipse cx="32" cy="32" rx="1.2" ry="0.6" fill="rgba(221,160,221,0.3)" />
          </pattern>
        );

      default:
        return null;
    }
  };

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius: "inherit" }}>
      <defs>{renderPattern()}</defs>
      {renderPattern() && <rect width="100%" height="100%" fill={`url(#${patternId})`} style={{ borderRadius: "inherit" }} />}
    </svg>
  );
};

export const PaintFinishEffect: React.FC<PaintFinishEffectProps> = ({
  baseColor,
  finish,
  className = "",
  style = {},
  children,
  useCanvas = false,
  size = "medium",
  disableAnimations = false,
}) => {
  const config = PAINT_FINISH_CONFIGS[finish];
  const formattedColor = formatHexColor(baseColor);
  const textColor = getContrastingTextColor(baseColor);

  // Generate sparkle particles for metallic and pearl finishes
  const sparkleParticles = useMemo(() => {
    if (!config.effects?.hasSparkle) return [];

    const particleCount = {
      small: 20,
      medium: 35,
      large: 50,
    }[size];

    return generateSparkleParticles(particleCount);
  }, [config.effects?.hasSparkle, size]);

  // Generate unique pattern ID for SVG textures
  const patternId = useMemo(() => `texture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);

  // Container dimensions for canvas
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 200, height: 100 });

  useEffect(() => {
    if (containerRef.current) {
      const { offsetWidth, offsetHeight } = containerRef.current;
      setDimensions({ width: offsetWidth, height: offsetHeight });
    }
  }, []);

  const containerStyle: React.CSSProperties = {
    backgroundColor: formattedColor,
    color: textColor,
    filter: config.effects?.opacity ? `opacity(${config.effects.opacity})` : undefined,
    ...style,
  };

  return (
    <div ref={containerRef} className={`paint-finish-container ${config.cssClass} ${className}`} style={containerStyle}>
      {/* SVG texture patterns for certain finishes */}
      {config.effects?.hasTexture && !useCanvas && <TexturePattern finish={finish} color={formattedColor} patternId={patternId} />}

      {/* Canvas-based sparkles for metallic/pearl finishes */}
      {config.effects?.hasSparkle && useCanvas && sparkleParticles.length > 0 && (
        <CanvasSparkles particles={sparkleParticles} color={formattedColor} width={dimensions.width} height={dimensions.height} disableAnimations={disableAnimations} />
      )}

      {/* CSS-based sparkles for simpler implementation */}
      {config.effects?.hasSparkle && !useCanvas && (
        <div className="paint-finish-sparkles">
          {sparkleParticles.slice(0, 10).map((particle) => (
            <div
              key={particle.id}
              className="sparkle-particle"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                animationDelay: `${particle.delay}ms`,
                animationDuration: config.animations?.duration ? `${config.animations.duration}ms` : "2s",
                transform: `scale(${particle.size})`,
                opacity: particle.intensity,
              }}
            />
          ))}
        </div>
      )}

      {children}
    </div>
  );
};

export default PaintFinishEffect;
