import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { IconShieldCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface PpeDeliveryData {
  id: string;
  userName: string;
  itemName: string;
  quantity: number;
  date: string;
}

interface SimplePpeDeliveryCardProps {
  deliveries: PpeDeliveryData[];
  className?: string;
}

export function SimplePpeDeliveryCard({ deliveries, className }: SimplePpeDeliveryCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (deliveries.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % deliveries.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [deliveries.length]);

  if (deliveries.length === 0) {
    return (
      <Card className={cn("h-full", className)}>
        <CardContent className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <IconShieldCheck className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            <h3 className="text-xs font-semibold text-foreground leading-tight">Entregas Recentes de EPI</h3>
          </div>
          <div className="h-20 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Sem entregas recentes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentDelivery = deliveries[currentIndex];

  return (
    <Card className={cn("h-full hover:shadow-sm transition-shadow", className)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <IconShieldCheck className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
          <h3 className="text-xs font-semibold text-foreground leading-tight">Entregas Recentes de EPI</h3>
        </div>
        <div className="h-20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">{currentDelivery.userName}</p>
              <p className="text-xs text-muted-foreground">
                {currentDelivery.itemName} - {currentDelivery.quantity} un.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{currentDelivery.date}</p>
            </div>
          </div>
          {deliveries.length > 1 && (
            <div className="flex gap-1 justify-center mt-2">
              {deliveries.map((_, index) => (
                <div key={index} className={cn("h-1 rounded-full transition-all", index === currentIndex ? "bg-neutral-800 dark:bg-neutral-200 w-3" : "bg-neutral-300 dark:bg-neutral-600 w-1")} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
