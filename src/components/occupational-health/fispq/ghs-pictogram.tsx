import { cn } from "@/lib/utils";
import { GHS_PICTOGRAM_LABELS } from "../../../constants";
import type { GHS_PICTOGRAM } from "../../../constants";

/** Maps each GHS pictogram enum value to its public-domain UN SVG in /public/ghs. */
const PICTOGRAM_SRC: Record<string, string> = {
  GHS01_EXPLOSIVE: "/ghs/ghs01-explosive.svg",
  GHS02_FLAMMABLE: "/ghs/ghs02-flammable.svg",
  GHS03_OXIDIZING: "/ghs/ghs03-oxidizing.svg",
  GHS04_GAS_UNDER_PRESSURE: "/ghs/ghs04-gas.svg",
  GHS05_CORROSIVE: "/ghs/ghs05-corrosive.svg",
  GHS06_TOXIC: "/ghs/ghs06-toxic.svg",
  GHS07_HARMFUL: "/ghs/ghs07-harmful.svg",
  GHS08_HEALTH_HAZARD: "/ghs/ghs08-health-hazard.svg",
  GHS09_ENVIRONMENTAL: "/ghs/ghs09-environmental.svg",
};

interface GhsPictogramImageProps {
  code: string;
  size?: number;
  className?: string;
}

/** Renders a single GHS pictogram image with its name as tooltip/alt. */
export function GhsPictogramImage({ code, size = 32, className }: GhsPictogramImageProps) {
  const src = PICTOGRAM_SRC[code];
  const label = GHS_PICTOGRAM_LABELS[code as GHS_PICTOGRAM] ?? code;
  if (!src) return null;
  return <img src={src} alt={label} title={label} width={size} height={size} className={cn("inline-block select-none", className)} draggable={false} loading="lazy" />;
}

interface GhsPictogramListProps {
  codes?: string[] | null;
  size?: number;
  className?: string;
  emptyText?: string;
}

/** Renders a row of GHS pictogram images. */
export function GhsPictogramList({ codes, size = 32, className, emptyText = "-" }: GhsPictogramListProps) {
  if (!codes || codes.length === 0) {
    return <span className="text-muted-foreground text-xs">{emptyText}</span>;
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {codes.map((code) => (
        <GhsPictogramImage key={code} code={code} size={size} />
      ))}
    </div>
  );
}
