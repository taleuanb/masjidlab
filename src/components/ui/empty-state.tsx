import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center p-12 text-center",
        className
      )}
    >
      <div className="bg-primary/10 text-primary p-4 rounded-full mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mt-2">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
