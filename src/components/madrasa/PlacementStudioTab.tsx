import React, { useState, useMemo } from "react";
import {
  Search,
  Users,
  LayoutDashboard,
  Heart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ── Mock data ── */

interface MockStudent {
  id: string;
  nom: string;
  prenom: string;
  genre: "M" | "F";
  age: number;
  cycle: string;
  niveau: string;
  prioriteFratrie: boolean;
}

interface MockClass {
  id: string;
  nom: string;
  niveau: string;
  matiere: string;
  capaciteMax: number;
  inscrits: number;
}

const MOCK_STUDENTS: MockStudent[] = [
  { id: "s1", nom: "Diallo", prenom: "Ibrahim", genre: "M", age: 8, cycle: "Primaire", niveau: "Niveau 1", prioriteFratrie: false },
  { id: "s2", nom: "Ben Ali", prenom: "Aïcha", genre: "F", age: 10, cycle: "Primaire", niveau: "Niveau 2", prioriteFratrie: true },
  { id: "s3", nom: "Konaté", prenom: "Moussa", genre: "M", age: 12, cycle: "Collège", niveau: "Hifz", prioriteFratrie: false },
  { id: "s4", nom: "Sy", prenom: "Fatou", genre: "F", age: 7, cycle: "Primaire", niveau: "Niveau 1", prioriteFratrie: true },
  { id: "s5", nom: "Touré", prenom: "Oumar", genre: "M", age: 9, cycle: "Primaire", niveau: "Niveau 2", prioriteFratrie: false },
];

const MOCK_CLASSES: MockClass[] = [
  { id: "c1", nom: "Classe Al-Fatiha", niveau: "Niveau 1", matiere: "Coran", capaciteMax: 20, inscrits: 12 },
  { id: "c2", nom: "Classe An-Nour", niveau: "Niveau 2", matiere: "Arabe", capaciteMax: 18, inscrits: 16 },
  { id: "c3", nom: "Classe Al-Hifz", niveau: "Hifz", matiere: "Coran", capaciteMax: 15, inscrits: 5 },
];

const CYCLES = ["Tous", "Primaire", "Collège"];
const NIVEAUX = ["Tous", "Niveau 1", "Niveau 2", "Hifz"];
const MATIERES = ["Toutes", "Coran", "Arabe"];

/* ── Sub-components ── */

function StudentCard({ student }: { student: MockStudent }) {
  return (
    <Card className="mb-2 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors">
      <CardContent className="p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">
            {student.prenom} {student.nom}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge
              variant="outline"
              className={
                student.genre === "M"
                  ? "text-[10px] px-1.5 py-0 bg-sky-500/10 text-sky-700 border-sky-400/30"
                  : "text-[10px] px-1.5 py-0 bg-pink-500/10 text-pink-700 border-pink-400/30"
              }
            >
              {student.genre}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{student.age} ans</span>
          </div>
        </div>
        {student.prioriteFratrie && (
          <Heart className="h-3.5 w-3.5 shrink-0 text-rose-500 fill-rose-500" />
        )}
      </CardContent>
    </Card>
  );
}

function ClassCard({ cls }: { cls: MockClass }) {
  const pct = Math.round((cls.inscrits / cls.capaciteMax) * 100);
  const remaining = cls.capaciteMax - cls.inscrits;

  return (
    <Card className="flex flex-col">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold truncate">{cls.nom}</CardTitle>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {cls.niveau}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Matière : {cls.matiere}</p>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex flex-col gap-3 flex-1">
        {/* Gauge */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{cls.inscrits}/{cls.capaciteMax} élèves</span>
            <span>{pct}%</span>
          </div>
          <Progress
            value={pct}
            className="h-2"
            style={
              {
                "--progress-color":
                  pct >= 90
                    ? "hsl(var(--destructive))"
                    : pct >= 70
                      ? "hsl(var(--warning, 38 92% 50%))"
                      : "hsl(var(--brand-emerald))",
              } as React.CSSProperties
            }
          />
        </div>

        {/* Drop zone */}
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center py-5 text-xs text-muted-foreground select-none mt-auto">
          <span className="opacity-60">Glisser un élève ici ({remaining} place{remaining > 1 ? "s" : ""})</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main component ── */

export function PlacementStudioTab() {
  const [search, setSearch] = useState("");
  const [cycle, setCycle] = useState("Tous");
  const [niveau, setNiveau] = useState("Tous");
  const [matiere, setMatiere] = useState("Toutes");

  const filteredStudents = useMemo(() => {
    return MOCK_STUDENTS.filter((s) => {
      const q = search.toLowerCase();
      if (q && !`${s.prenom} ${s.nom}`.toLowerCase().includes(q)) return false;
      if (cycle !== "Tous" && s.cycle !== cycle) return false;
      if (niveau !== "Tous" && s.niveau !== niveau) return false;
      return true;
    });
  }, [search, cycle, niveau]);

  const filteredClasses = useMemo(() => {
    return MOCK_CLASSES.filter((c) => {
      if (matiere !== "Toutes" && c.matiere !== matiere) return false;
      return true;
    });
  }, [matiere]);

  /* Global stats */
  const totalCapacity = MOCK_CLASSES.reduce((s, c) => s + c.capaciteMax, 0);
  const totalEnrolled = MOCK_CLASSES.reduce((s, c) => s + c.inscrits, 0);
  const globalPct = totalCapacity ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;
  const totalAvailable = totalCapacity - totalEnrolled;

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[600px]">
      {/* ── Left: Student Pool ── */}
      <div className="w-full lg:w-1/4 shrink-0 flex flex-col rounded-xl border bg-card">
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Élèves à placer</h3>
            <Badge variant="secondary" className="ml-auto text-xs">
              {filteredStudents.length}
            </Badge>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Filters */}
          <div className="grid gap-2">
            <Select value={cycle} onValueChange={setCycle}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Cycle" />
              </SelectTrigger>
              <SelectContent>
                {CYCLES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={niveau} onValueChange={setNiveau}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Niveau" />
              </SelectTrigger>
              <SelectContent>
                {NIVEAUX.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Student list */}
        <ScrollArea className="flex-1 p-3">
          {filteredStudents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Aucun élève trouvé.
            </p>
          ) : (
            filteredStudents.map((s) => <StudentCard key={s.id} student={s} />)
          )}
        </ScrollArea>
      </div>

      {/* ── Right: Class Grid ── */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Global stats bar */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Studio de placement</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Places disponibles :</span>
              <Badge variant="outline" className="font-semibold">{totalAvailable}</Badge>
            </div>
            <div className="flex items-center gap-3 flex-1 min-w-[180px]">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Remplissage global</span>
              <Progress value={globalPct} className="h-2 flex-1" />
              <span className="text-xs font-medium">{globalPct}%</span>
            </div>
            <Select value={matiere} onValueChange={setMatiere}>
              <SelectTrigger className="h-8 text-xs w-[140px]">
                <SelectValue placeholder="Matière" />
              </SelectTrigger>
              <SelectContent>
                {MATIERES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Class cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((cls) => (
            <ClassCard key={cls.id} cls={cls} />
          ))}
        </div>
      </div>
    </div>
  );
}
