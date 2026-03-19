import React, { useState } from "react";
import { Plus, Trash2, Loader2, BookOpen, Layers } from "lucide-react";
import { TrackingConfigTab } from "@/components/madrasa/TrackingConfigTab";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

/* ─────────────── Général ─────────────── */

function GeneralTab() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["madrasa_settings", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_settings")
        .select("*")
        .eq("org_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [billingCycle, setBillingCycle] = useState("");
  const [threshold, setThreshold] = useState("");
  const [currency, setCurrency] = useState("");

  React.useEffect(() => {
    if (settings) {
      setBillingCycle(settings.billing_cycle ?? "mensuel");
      setThreshold(String(settings.attendance_threshold ?? 3));
      setCurrency(settings.currency ?? "EUR");
    }
  }, [settings]);

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        org_id: orgId!,
        billing_cycle: billingCycle,
        attendance_threshold: Number(threshold),
        currency,
      };
      const { error } = await supabase.from("madrasa_settings").upsert(payload, { onConflict: "org_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_settings", orgId] });
      toast({ title: "Paramètres enregistrés" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8 text-muted-foreground" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Paramètres généraux</CardTitle>
        <CardDescription>Configuration de base du module Éducation.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Cycle de facturation</Label>
          <Select value={billingCycle} onValueChange={setBillingCycle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mensuel">Mensuel</SelectItem>
              <SelectItem value="trimestriel">Trimestriel</SelectItem>
              <SelectItem value="annuel">Annuel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Seuil d'absences</Label>
          <Input type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Devise</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-3 flex justify-end">
          <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────── Matières ─────────────── */

function SubjectsTab() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["madrasa_subjects", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_subjects")
        .select("*")
        .eq("org_id", orgId!)
        .order("name");
      if (error) throw error;
      return data as Tables<"madrasa_subjects">[];
    },
  });

  const addSubject = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Nom requis");
      const { error } = await supabase.from("madrasa_subjects").insert({ name: newName.trim(), org_id: orgId! });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_subjects", orgId] });
      setNewName("");
      toast({ title: "Matière ajoutée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteSubject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("madrasa_subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_subjects", orgId] });
      toast({ title: "Matière supprimée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5" /> Matières</CardTitle>
        <CardDescription>Gérez le catalogue de matières enseignées.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nom de la matière…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubject.mutate()}
          />
          <Button onClick={() => addSubject.mutate()} disabled={addSubject.isPending} size="sm">
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        ) : subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune matière configurée.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteSubject.mutate(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────── Niveaux ─────────────── */

function LevelsTab() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [tarif, setTarif] = useState("");

  const { data: levels = [], isLoading } = useQuery({
    queryKey: ["madrasa_levels", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_levels")
        .select("*")
        .eq("org_id", orgId!)
        .order("label");
      if (error) throw error;
      return data as Tables<"madrasa_levels">[];
    },
  });

  const addLevel = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Label requis");
      const { error } = await supabase.from("madrasa_levels").insert({
        label: label.trim(),
        description: desc.trim() || null,
        tarif_mensuel: tarif ? Number(tarif) : 0,
        org_id: orgId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_levels", orgId] });
      setLabel("");
      setDesc("");
      setTarif("");
      toast({ title: "Niveau ajouté" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteLevel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("madrasa_levels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_levels", orgId] });
      toast({ title: "Niveau supprimé" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const fmt = (n: number | null) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Layers className="h-5 w-5" /> Niveaux</CardTitle>
        <CardDescription>Définissez les niveaux scolaires et leur tarif mensuel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Input type="number" min={0} placeholder="Tarif (€)" value={tarif} onChange={(e) => setTarif(e.target.value)} />
          <Button onClick={() => addLevel.mutate()} disabled={addLevel.isPending} size="sm" className="h-10">
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        ) : levels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun niveau configuré.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Tarif</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.label}</TableCell>
                  <TableCell className="text-muted-foreground">{l.description ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmt(l.tarif_mensuel)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteLevel.mutate(l.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────── Composant exporté ─────────────── */

export function MadrasaSettingsPanel() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="subjects">Matières</TabsTrigger>
          <TabsTrigger value="levels">Niveaux</TabsTrigger>
          <TabsTrigger value="tracking">Suivis</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><GeneralTab /></TabsContent>
        <TabsContent value="subjects"><SubjectsTab /></TabsContent>
        <TabsContent value="levels"><LevelsTab /></TabsContent>
        <TabsContent value="tracking"><TrackingConfigTab /></TabsContent>
      </Tabs>
    </div>
  );
}
