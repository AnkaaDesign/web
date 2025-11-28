import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconShirt, IconShoe, IconHanger, IconMask, IconHandGrab, IconUmbrella } from "@tabler/icons-react";
import type { User } from "../../../../types";
import { cn } from "@/lib/utils";
import {
  SHIRT_SIZE_LABELS,
  BOOT_SIZE_LABELS,
  PANTS_SIZE_LABELS,
  SLEEVES_SIZE_LABELS,
  MASK_SIZE_LABELS,
  GLOVES_SIZE_LABELS,
  RAIN_BOOTS_SIZE_LABELS,
} from "../../../../constants";

interface PpeSizesCardProps {
  user: User;
  className?: string;
}

export function PpeSizesCard({ user, className }: PpeSizesCardProps) {
  const hasPpeSizes = user.ppeSize && (
    user.ppeSize.shirts ||
    user.ppeSize.boots ||
    user.ppeSize.pants ||
    user.ppeSize.sleeves ||
    user.ppeSize.mask ||
    user.ppeSize.gloves ||
    user.ppeSize.rainBoots
  );

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconShirt className="h-5 w-5 text-muted-foreground" />
          Tamanhos de EPI
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {!hasPpeSizes ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Nenhum tamanho de EPI cadastrado
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {user.ppeSize?.shirts && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconShirt className="h-4 w-4" />
                  Camisa
                </span>
                <span className="text-sm font-semibold text-foreground">{SHIRT_SIZE_LABELS[user.ppeSize.shirts]}</span>
              </div>
            )}

            {user.ppeSize?.pants && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconHanger className="h-4 w-4" />
                  Calça
                </span>
                <span className="text-sm font-semibold text-foreground">{PANTS_SIZE_LABELS[user.ppeSize.pants]}</span>
              </div>
            )}

            {user.ppeSize?.boots && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconShoe className="h-4 w-4" />
                  Botas
                </span>
                <span className="text-sm font-semibold text-foreground">{BOOT_SIZE_LABELS[user.ppeSize.boots]}</span>
              </div>
            )}

            {user.ppeSize?.rainBoots && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconUmbrella className="h-4 w-4" />
                  Galocha
                </span>
                <span className="text-sm font-semibold text-foreground">{RAIN_BOOTS_SIZE_LABELS[user.ppeSize.rainBoots]}</span>
              </div>
            )}

            {user.ppeSize?.sleeves && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconHanger className="h-4 w-4" />
                  Manguito
                </span>
                <span className="text-sm font-semibold text-foreground">{SLEEVES_SIZE_LABELS[user.ppeSize.sleeves]}</span>
              </div>
            )}

            {user.ppeSize?.mask && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconMask className="h-4 w-4" />
                  Máscara
                </span>
                <span className="text-sm font-semibold text-foreground">{MASK_SIZE_LABELS[user.ppeSize.mask]}</span>
              </div>
            )}

            {user.ppeSize?.gloves && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconHandGrab className="h-4 w-4" />
                  Luvas
                </span>
                <span className="text-sm font-semibold text-foreground">{GLOVES_SIZE_LABELS[user.ppeSize.gloves]}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
