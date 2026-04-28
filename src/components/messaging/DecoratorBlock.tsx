import * as React from "react";
import type { DecoratorBlock as DecoratorBlockType } from "./types";

const DECORATOR_IMAGES: Record<string, string> = {
  'header-logo': '/header-logo.webp',
  'header-logo-stripes': '/header-logo-stripes.webp',
  'footer-wave-dark': '/footer-wave-dark.webp',
  'footer-wave-logo': '/footer-wave-logo.webp',
  'footer-diagonal-stripes': '/footer-diagonal-stripes.webp',
  'footer-wave-gold': '/footer-wave-gold.webp',
  'footer-geometric': '/footer-geometric.webp',
};

interface Props {
  block: DecoratorBlockType;
}

export function DecoratorBlock({ block }: Props) {
  const src = DECORATOR_IMAGES[block.variant];
  if (!src) return null;

  return (
    <div className="-mx-4 not-prose" style={{ lineHeight: 0, fontSize: 0 }}>
      <img
        src={src}
        alt=""
        className="w-full block"
        role="presentation"
      />
    </div>
  );
}
