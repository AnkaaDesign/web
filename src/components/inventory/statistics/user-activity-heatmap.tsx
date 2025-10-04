import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

interface HeatmapData {
  hour: number;
  day: string;
  value: number;
  user?: string;
}

export function UserActivityHeatmap() {
  // Generate mock heatmap data
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const generateHeatmapData = (): HeatmapData[] => {
    const data: HeatmapData[] = [];
    days.forEach((day, dayIndex) => {
      hours.forEach((hour) => {
        // Simulate realistic activity patterns
        let value = Math.random() * 100;

        // Lower activity on weekends
        if (dayIndex === 0 || dayIndex === 6) {
          value *= 0.3;
        }

        // Higher activity during work hours (8-18)
        if (hour >= 8 && hour <= 18) {
          value *= 1.5;
        } else if (hour >= 0 && hour <= 6) {
          value *= 0.1;
        }

        data.push({
          hour,
          day,
          value: Math.round(value),
        });
      });
    });
    return data;
  };

  const heatmapData = generateHeatmapData();

  // Get color intensity based on value
  const getColor = (value: number) => {
    if (value === 0) return "bg-gray-100";
    if (value < 20) return "bg-green-200";
    if (value < 40) return "bg-green-300";
    if (value < 60) return "bg-green-400";
    if (value < 80) return "bg-green-500";
    return "bg-green-600";
  };

  // Find max value for legend
  const maxValue = Math.max(...heatmapData.map(d => d.value));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <CardTitle>Heatmap de Atividade por Usuário</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Menos</span>
            <div className="flex gap-1">
              {[0, 20, 40, 60, 80].map((threshold) => (
                <div
                  key={threshold}
                  className={`w-3 h-3 ${getColor(threshold)}`}
                  title={`${threshold}+ atividades`}
                />
              ))}
            </div>
            <span>Mais</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Hour labels */}
          <div className="flex gap-1 ml-12">
            {hours.map((hour) => (
              <div
                key={hour}
                className="w-5 text-xs text-muted-foreground text-center"
              >
                {hour % 3 === 0 ? hour : ""}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          {days.map((day) => (
            <div key={day} className="flex gap-1 items-center">
              <div className="w-10 text-sm text-muted-foreground text-right">
                {day}
              </div>
              {hours.map((hour) => {
                const cell = heatmapData.find(
                  d => d.day === day && d.hour === hour
                );
                return (
                  <div
                    key={`${day}-${hour}`}
                    className={`w-5 h-5 rounded-sm cursor-pointer transition-all hover:scale-110 ${getColor(cell?.value || 0)}`}
                    title={`${day} ${hour}:00 - ${cell?.value || 0} atividades`}
                  />
                );
              })}
            </div>
          ))}

          {/* Statistics summary */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Pico de Atividade</p>
              <p className="text-lg font-semibold">Terça 14:00</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Média/Hora</p>
              <p className="text-lg font-semibold">
                {Math.round(heatmapData.reduce((acc, d) => acc + d.value, 0) / heatmapData.length)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Semanal</p>
              <p className="text-lg font-semibold">
                {heatmapData.reduce((acc, d) => acc + d.value, 0).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}