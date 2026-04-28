import * as React from "react";
import { cn } from "@/lib/utils";
import type { CompanyAssetBlock as CompanyAssetBlockType } from "./types";

const ASSET_SRCS: Record<string, string> = {
  logo: '/logo.png',
  icon: '/android-chrome-192x192.png',
};

const SIZE_CLASSES: Record<string, string> = {
  '25%': 'w-1/4',
  '50%': 'w-1/2',
  '75%': 'w-3/4',
  '100%': 'w-full',
};

const ALIGN_CLASSES: Record<string, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

interface Props {
  block: CompanyAssetBlockType;
}

export function CompanyAssetBlock({ block }: Props) {
  const src = ASSET_SRCS[block.asset];
  const sizeClass = SIZE_CLASSES[block.size ?? '75%'] ?? 'w-3/4';
  const alignClass = ALIGN_CLASSES[block.alignment ?? 'left'] ?? 'justify-start';

  return (
    <div className={cn("flex not-prose", alignClass)}>
      <img
        src={src}
        alt={block.asset === 'logo' ? 'Logo da empresa' : 'Ícone da empresa'}
        className={cn("h-auto", sizeClass)}
      />
    </div>
  );
}
