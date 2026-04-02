import { LayoutGrid, List, Columns3 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ViewMode = "list" | "grid" | "board";

interface ViewSwitcherProps {
  viewMode: ViewMode;
  onViewChange: (val: ViewMode) => void;
  className?: string;
}

export function ViewSwitcher({ viewMode, onViewChange, className }: ViewSwitcherProps) {
  return (
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={(v) => { if (v) onViewChange(v as ViewMode); }}
      className={className}
    >
      <ToggleGroupItem value="grid" aria-label="Grille" className="h-9 w-9 p-0">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="Liste" className="h-9 w-9 p-0">
        <List className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="board" aria-label="Board" className="h-9 w-9 p-0">
        <Columns3 className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
