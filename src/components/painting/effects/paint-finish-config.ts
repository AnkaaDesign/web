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
  // New realistic rendering properties
  realistic?: {
    flipColor?: string; // Interference/flip color for pearl (angle-dependent)
    fresnelPower?: number; // Fresnel effect strength (1-5, default 2)
    ior?: number; // Index of refraction (1.0-2.5)
    sheen?: number; // Sheen/velvet effect (0-1)
    sheenRoughness?: number; // Sheen roughness (0-1)
    flakeOrientation?: number; // How aligned flakes are (0=random, 1=aligned)
    colorShiftAngle?: number; // Hue shift in degrees for pearl (0-180)
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
    realistic: {
      fresnelPower: 1.5,
      ior: 1.5,
      sheen: 0,
      sheenRoughness: 0,
    },
  },
  [PAINT_FINISH.METALLIC]: {
    label: "Metálico",
    description: "Partículas metálicas com reflexão direcional",
    normalMap: "/metallic-normal-map.jpg",
    roughness: 0.12,
    metalness: 0.85,
    clearCoat: 1.0,
    clearCoatRoughness: 0.03,
    reflectivity: 0.95,
    specularIntensity: 1.8,
    cssClass: "paint-finish-metallic",
    effects: {
      hasSparkle: true,
      hasTexture: true,
    },
    animations: {
      duration: 2000,
    },
    animation: {
      type: "none",
      speed: 0,
      intensity: 0,
    },
    particleEffect: {
      enabled: true,
      size: 1.5,
      density: 10,
      color: "rgba(255, 255, 255, 0.4)",
    },
    realistic: {
      fresnelPower: 2.5,
      ior: 2.0,
      sheen: 0,
      sheenRoughness: 0,
      flakeOrientation: 0.3, // 30% alignment, mostly random
    },
  },
  [PAINT_FINISH.PEARL]: {
    label: "Perolizado",
    description: "Efeito iridescente com mudança de cor",
    normalMap: "/pearl-normal-map.jpg",
    roughness: 0.18,
    metalness: 0.25,
    clearCoat: 1.0,
    clearCoatRoughness: 0.02,
    reflectivity: 0.8,
    specularIntensity: 1.4,
    cssClass: "paint-finish-pearl",
    effects: {
      hasSparkle: true,
      hasTexture: true,
    },
    animations: {
      duration: 3000,
    },
    animation: {
      type: "none",
      speed: 0,
      intensity: 0,
    },
    particleEffect: {
      enabled: true,
      size: 1.0,
      density: 12,
      color: "rgba(255, 200, 255, 0.3)",
    },
    realistic: {
      flipColor: "#ffd700", // Default gold flip - user can customize
      fresnelPower: 2.0,
      ior: 1.8,
      sheen: 0.7,
      sheenRoughness: 0.2,
      colorShiftAngle: 60, // 60 degree hue shift at grazing angles
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
