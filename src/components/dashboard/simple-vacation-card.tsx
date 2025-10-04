import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { IconBeach } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface VacationData {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
}

interface SimpleVacationCardProps {
  vacations: VacationData[];
  className?: string;
}

export function SimpleVacationCard({ vacations, className }: SimpleVacationCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (vacations.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % vacations.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [vacations.length]);

  if (vacations.length === 0) {
    return (
      <Card className={cn("h-full", className)}>
        <CardContent className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <IconBeach className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            <h3 className="text-xs font-semibold text-foreground leading-tight">Próximas Férias</h3>
          </div>
          <div className="h-20 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Sem férias próximas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentVacation = vacations[currentIndex];

  return (
    <Card className={cn("h-full hover:shadow-sm transition-shadow", className)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <IconBeach className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          <h3 className="text-xs font-semibold text-foreground leading-tight">Próximas Férias</h3>
        </div>
        <div className="h-20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">{currentVacation.userName}</p>
              <p className="text-xs text-muted-foreground">
                {currentVacation.startDate} - {currentVacation.endDate}
              </p>
            </div>
          </div>
          {vacations.length > 1 && (
            <div className="flex gap-1 justify-center mt-2">
              {vacations.map((_, index) => (
                <div key={index} className={cn("h-1 rounded-full transition-all", index === currentIndex ? "bg-neutral-800 dark:bg-neutral-200 w-3" : "bg-neutral-300 dark:bg-neutral-600 w-1")} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
