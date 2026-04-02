import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface StatCardItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subValue?: string;
  progress?: number;
  color?: string;
}

interface StatCardsProps {
  items: StatCardItem[];
  className?: string;
}

export function StatCards({ items, className }: StatCardsProps) {
  return (
    <div className={className ?? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"
                  style={item.color ? { backgroundColor: `${item.color}20`, color: item.color } : undefined}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-bold leading-tight">{item.value}</p>
                  {item.subValue && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.subValue}</p>
                  )}
                </div>
              </div>
              {item.progress !== undefined && (
                <Progress value={item.progress} className="mt-3 h-1.5 [&>div]:bg-brand-cyan" />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
