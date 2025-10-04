import { PAINT_FINISH } from "../../../constants";

export interface FinishConfig {
  label: string;
  description: string;
  normalMap?: string;
  roughness: number;
  metalness: number;
  clearCoat: number;
  clearCoatRoughness: number;
  reflectivity: number;
  specularIntensity: number;
  cssClass?: string;
  effects?: {
    hasSparkle?: boolean;
    hasTexture?: boolean;
    opacity?: number;
  };
  animations?: {
    duration?: number;
  };
  animation?: {
    type: "shimmer" | "sparkle" | "iridescent" | "none";
    speed: number;
    intensity: number;
  };
  particleEffect?: {
    enabled: boolean;
    size: number;
    density: number;
    color: string;
  };
}

export interface SparkleParticle {
  id: string;
  x: number;
  y: number;
  size: number;
  delay: number;
  intensity: number;
}

export function generateSparkleParticles(count: number): SparkleParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `sparkle-${i}`,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 0.5 + Math.random() * 1.5,
    delay: Math.random() * 3000,
    intensity: 0.5 + Math.random() * 0.5,
  }));
}

export const PAINT_FINISH_CONFIG: Record<PAINT_FINISH, FinishConfig> = {
  [PAINT_FINISH.SOLID]: {
    label: "Lisa",
    description: "Acabamento sólido com brilho uniforme",
    roughness: 0.3,
    metalness: 0.0,
    clearCoat: 1.0,
    clearCoatRoughness: 0.1,
    reflectivity: 0.5,
    specularIntensity: 1.0,
    cssClass: "paint-finish-solid",
    effects: {
      hasSparkle: false,
      hasTexture: false,
    },
    animation: {
      type: "none",
      speed: 0,
      intensity: 0,
    },
  },
  [PAINT_FINISH.METALLIC]: {
    label: "Metálico",
    description: "Partículas metálicas com reflexão direcional",
    normalMap: "/metallic-normal-map.jpg", // Will use when you add it
    roughness: 0.15,
    metalness: 0.8,
    clearCoat: 1.0,
    clearCoatRoughness: 0.05,
    reflectivity: 0.9,
    specularIntensity: 1.5,
    cssClass: "paint-finish-metallic",
    effects: {
      hasSparkle: true,
      hasTexture: true,
    },
    animations: {
      duration: 2000,
    },
    animation: {
      type: "none", // Changed from "sparkle" - no animation needed
      speed: 0,
      intensity: 0,
    },
    particleEffect: {
      enabled: true,
      size: 1.5,
      density: 10, // Reduced from 20 for better performance
      color: "rgba(255, 255, 255, 0.4)",
    },
  },
  [PAINT_FINISH.PEARL]: {
    label: "Perolizado",
    description: "Efeito iridescente com mudança de cor",
    normalMap: "/pearl-normal-map.jpg",
    roughness: 0.2,
    metalness: 0.3,
    clearCoat: 1.0,
    clearCoatRoughness: 0.02,
    reflectivity: 0.7,
    specularIntensity: 1.2,
    cssClass: "paint-finish-pearl",
    effects: {
      hasSparkle: true,
      hasTexture: true,
    },
    animations: {
      duration: 3000,
    },
    animation: {
      type: "none", // Changed from "iridescent" - static is beautiful enough
      speed: 0,
      intensity: 0,
    },
    particleEffect: {
      enabled: true,
      size: 1.0,
      density: 12, // Reduced from 25 for better performance
      color: "rgba(255, 200, 255, 0.3)",
    },
  },
  [PAINT_FINISH.MATTE]: {
    label: "Fosco",
    description: "Superfície opaca sem reflexão",
    roughness: 0.9,
    metalness: 0.0,
    clearCoat: 0.0,
    clearCoatRoughness: 1.0,
    reflectivity: 0.1,
    specularIntensity: 0.2,
    cssClass: "paint-finish-matte",
    effects: {
      hasSparkle: false,
      hasTexture: true,
    },
    animation: {
      type: "none",
      speed: 0,
      intensity: 0,
    },
  },
  [PAINT_FINISH.SATIN]: {
    label: "Semi Brilho",
    description: "Brilho suave entre fosco e sólido",
    roughness: 0.5,
    metalness: 0.0,
    clearCoat: 0.5,
    clearCoatRoughness: 0.3,
    reflectivity: 0.3,
    specularIntensity: 0.6,
    cssClass: "paint-finish-satin",
    effects: {
      hasSparkle: false,
      hasTexture: false,
    },
    animation: {
      type: "none", // Changed from "shimmer" - not needed
      speed: 0,
      intensity: 0,
    },
  },
};

// Utility functions for finish effects
export function getFinishProperties(finish: PAINT_FINISH): FinishConfig {
  return PAINT_FINISH_CONFIG[finish];
}

export function hasNormalMap(finish: PAINT_FINISH): boolean {
  return !!PAINT_FINISH_CONFIG[finish].normalMap;
}

export function getBlendMode(finish: PAINT_FINISH): string {
  switch (finish) {
    case PAINT_FINISH.METALLIC:
    case PAINT_FINISH.PEARL:
      return "overlay";
    case PAINT_FINISH.MATTE:
      return "multiply";
    case PAINT_FINISH.SATIN:
      return "soft-light";
    default:
      return "normal";
  }
}

// For backward compatibility
export const PAINT_FINISH_CONFIGS = PAINT_FINISH_CONFIG;
