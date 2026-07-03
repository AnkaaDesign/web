import { cn } from "@/lib/utils";
import type { CompanyAssetBlock as CompanyAssetBlockType } from "./types";
import {
  COMPANY_ASSET_DEFAULT_WIDTH,
  COMPANY_ASSET_SRCS,
  companyAssetCapWidthPct,
} from "./render-constants";

const ALIGN_CLASSES: Record<string, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

interface Props {
  block: CompanyAssetBlockType;
}

/**
 * Company asset (logo/icon) block — Message Rendering Spec §5.
 *
 * - Resolved width = size ?? '50%'; '%' of the content area, px presets honored
 *   (clamped to the content area).
 * - Proportional height cap h <= 0.18 × C. Since the asset aspect ratios are
 *   known constants, the cap is expressed as a max-width percentage:
 *   capWidth = 0.18 × C × aspect (logo ≈ 41.5% of C, icon = 18% of C).
 * - Default alignment: center.
 */
export function CompanyAssetBlock({ block }: Props) {
  const src = COMPANY_ASSET_SRCS[block.asset];
  if (!src) return null;

  const width = block.size ?? COMPANY_ASSET_DEFAULT_WIDTH;
  const capPct = companyAssetCapWidthPct(block.asset);
  const alignClass = ALIGN_CLASSES[block.alignment ?? 'center'] ?? 'justify-center';

  return (
    <div className={cn("flex", alignClass)}>
      <img
        src={src}
        alt={block.asset === 'logo' ? 'Logo da empresa' : 'Ícone da empresa'}
        className="h-auto block"
        style={{
          width,
          // px widths clamp to the content area; the height cap (h <= 0.18C)
          // is the equivalent max-width percentage since aspect is constant.
          maxWidth: `min(100%, ${capPct}%)`,
        }}
      />
    </div>
  );
}
