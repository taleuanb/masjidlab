import { useEffect, useState } from "react";
import { Search, DoorOpen, Package } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { sallesMock, materielMock } from "@/data/mock-data";
import { Button } from "@/components/ui/button";

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 text-muted-foreground h-9 px-3 rounded-lg"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Rechercher…</span>
        <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Rechercher une salle, du matériel…" />
        <CommandList>
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          <CommandGroup heading="Salles">
            {sallesMock.map((salle) => (
              <CommandItem key={salle.id} onSelect={() => setOpen(false)}>
                <DoorOpen className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="text-sm">{salle.nom}</span>
                  <span className="text-xs text-muted-foreground">
                    {salle.etage === 'RDC' ? 'RDC' : `Étage ${salle.etage}`} · {salle.type} · {salle.capacite} places
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Matériel">
            {materielMock.map((m) => (
              <CommandItem key={m.id} onSelect={() => setOpen(false)}>
                <Package className="mr-2 h-4 w-4 text-accent" />
                <div className="flex flex-col">
                  <span className="text-sm">{m.nom}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.quantiteDisponible}/{m.quantiteTotal} disponibles · {m.emplacement}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
