import type { DecoratorBlock as DecoratorBlockType } from "./types";
import {
  DECORATOR_IMAGES,
  HEADER_LOGO_MAX_WIDTH_PX,
  HEADER_LOGO_PADDING_BOTTOM,
  HEADER_LOGO_PADDING_TOP,
  HEADER_LOGO_WIDTH_PCT,
} from "./render-constants";

interface Props {
  block: DecoratorBlockType;
}

/**
 * Decorator (header/footer banner) block — Message Rendering Spec §6.
 *
 * - `header-logo`: compact trimmed logo (394×156, no transparent margins),
 *   left-aligned at min(HEADER_LOGO_WIDTH_PCT, HEADER_LOGO_MAX_WIDTH_PX) of
 *   the content area, natural aspect, padding 12px top / 4px bottom. It sits
 *   INSIDE the canvas padding (no bleed).
 * - `header-logo-stripes` and all `footer-*`: full-bleed bands (edge to edge
 *   of the canvas, via the --msg-canvas-px negative margins), width 100%,
 *   natural aspect — no crop, no stretch.
 * - Unknown variants render nothing.
 */
export function DecoratorBlock({ block }: Props) {
  const src = DECORATOR_IMAGES[block.variant];
  if (!src) return null;

  if (block.variant === 'header-logo') {
    return (
      <div
        style={{
          paddingTop: HEADER_LOGO_PADDING_TOP,
          paddingBottom: HEADER_LOGO_PADDING_BOTTOM,
        }}
      >
        <img
          src={src}
          alt=""
          role="presentation"
          className="block h-auto"
          style={{ width: `min(${HEADER_LOGO_WIDTH_PCT}%, ${HEADER_LOGO_MAX_WIDTH_PX}px)` }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        marginLeft: 'calc(var(--msg-canvas-px, 0px) * -1)',
        marginRight: 'calc(var(--msg-canvas-px, 0px) * -1)',
        lineHeight: 0,
        fontSize: 0,
      }}
    >
      <img src={src} alt="" className="w-full h-auto block" role="presentation" />
    </div>
  );
}
