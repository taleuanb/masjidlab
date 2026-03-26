import React, { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Trash2, Loader2, CalendarDays, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const TYPE_OPTIONS = [
  { value: "holiday", label: "Fermeture / Vacances", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "exam", label: "Période d'examens", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "pedagogical", label: "Jalon interne", color: "bg-sky-100 text-sky-700 border-sky-200" },
] as const;

function typeBadge(type: string) {
  const opt = TYPE_OPTIONS.find((o) => o.value === type);
  return opt ?? { label: type, color: "bg-muted text-muted-foreground" };
}

function DatePickerField({ label, date, onSelect }: { label: string; date: Date | undefined; onSelect: (d: Date | undefined) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarDays className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP", { locale: fr }) : "Sélectionner…"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CalendarTab() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("holiday");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [affectsClasses, setAffectsClasses] = useState(true);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["madrasa_calendar", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_calendar")
        .select("*")
        .eq("org_id", orgId!)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as Tables<"madrasa_calendar">[];
    },
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Le titre est requis");
      if (!startDate || !endDate) throw new Error("Les dates sont requises");
      if (endDate < startDate) throw new Error("La date de fin doit être après le début");

      const { error } = await supabase.from("madrasa_calendar").insert({
        title: title.trim(),
        type,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        affects_classes: affectsClasses,
        org_id: orgId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_calendar", orgId] });
      resetForm();
      toast({ title: "Période ajoutée" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("madrasa_calendar").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_calendar", orgId] });
      toast({ title: "Période supprimée" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  function resetForm() {
    setTitle("");
    setType("holiday");
    setStartDate(undefined);
    setEndDate(undefined);
    setAffectsClasses(true);
    setOpen(false);
  }

  const fmtDate = (d: string) => format(new Date(d), "d MMM yyyy", { locale: fr });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Calendrier Scolaire
          </CardTitle>
          <CardDescription>Gérez les fermetures, vacances et jalons qui impactent l'assiduité.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter une période
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune période configurée. Ajoutez vos vacances et jalons pour protéger l'assiduité des élèves.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Cours suspendus</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => {
                const badge = typeBadge(e.type);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {fmtDate(e.start_date)} → {fmtDate(e.end_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={badge.color}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {e.affects_classes ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <ShieldCheck className="h-4 w-4 text-emerald-500 mx-auto" />
                            </TooltipTrigger>
                            <TooltipContent>L'assiduité est protégée pendant cette période</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">Non</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteEntry.mutate(e.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* ── Dialog d'ajout ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle période</DialogTitle>
            <DialogDescription>Ajoutez une fermeture, vacance ou jalon au calendrier scolaire.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input placeholder="Ex: Vacances d'Hiver, Aïd al-Fitr…" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DatePickerField label="Début" date={startDate} onSelect={setStartDate} />
              <DatePickerField label="Fin" date={endDate} onSelect={setEndDate} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Suspendre les cours</Label>
                <p className="text-xs text-muted-foreground">Protège l'assiduité des élèves</p>
              </div>
              <Switch checked={affectsClasses} onCheckedChange={setAffectsClasses} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Annuler</Button>
            <Button onClick={() => addEntry.mutate()} disabled={addEntry.isPending}>
              {addEntry.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
