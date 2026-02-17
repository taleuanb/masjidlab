import { Building2, ChevronDown } from "lucide-react";
import { Etage } from "@/types/amm";
import { ETAGES } from "@/data/mock-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FloorContextHeaderProps {
  selectedEtage: Etage;
  onEtageChange: (etage: Etage) => void;
}

export function FloorContextHeader({ selectedEtage, onEtageChange }: FloorContextHeaderProps) {
  const currentLabel = ETAGES.find(e => e.value === selectedEtage)?.label ?? selectedEtage;

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-base font-semibold tracking-tight">Vue Opérationnelle</h3>
        <p className="text-xs text-muted-foreground">Statut en temps réel de l'étage sélectionné</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">
            <Building2 className="h-4 w-4 text-primary" />
            {currentLabel}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {ETAGES.map((etage) => (
            <DropdownMenuItem
              key={etage.value}
              onClick={() => onEtageChange(etage.value)}
              className={selectedEtage === etage.value ? "bg-accent font-medium" : ""}
            >
              {etage.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
