import type { ComponentType, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InfoItem {
  label: string;
  value: string | ReactNode;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}

interface InfoSection {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  items: InfoItem[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

interface InfoGridProps {
  sections: InfoSection[];
  className?: string;
}

export const InfoGrid = ({ sections, className }: InfoGridProps) => {
  return (
    <div className={cn("grid gap-6", className)}>
      {sections.map((section, sectionIndex) => (
        <Card key={sectionIndex} className={section.className}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {section.icon && <section.icon className="h-5 w-5 text-muted-foreground" />}
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "grid gap-4",
                section.columns === 1 && "grid-cols-1",
                section.columns === 2 && "grid-cols-1 sm:grid-cols-2",
                section.columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                section.columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
                !section.columns && "grid-cols-1 sm:grid-cols-2",
              )}
            >
              {section.items.map((item, itemIndex) => (
                <div key={itemIndex} className={cn("space-y-1", item.className)}>
                  <div className="flex items-center gap-2">
                    {item.icon && <item.icon className="h-4 w-4 text-muted-foreground" />}
                    <label className="text-sm font-medium text-muted-foreground">{item.label}</label>
                  </div>
                  <div className="font-medium">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
