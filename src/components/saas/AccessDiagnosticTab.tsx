import { useState, useCallback, useMemo } from "react";
import {
  SearchCheck, RefreshCw, Loader2, CheckCircle2, XCircle, MinusCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RBAC_MODULE_HIERARCHY, CATEGORY_LABELS,
} from "@/config/rbac-modules";
import {
  isModuleInPlan, type PlanId,
} from "@/config/module-registry";
import { hasDefaultView } from "@/config/default-rbac";

const ROLES = [
  { id: "admin", label: "Admin Mosquée" },
  { id: "responsable", label: "Responsable" },
  { id: "enseignant", label: "Enseignant" },
  { id: "benevole", label: "Bénévole" },
  { id: "parent", label: "Parent" },
];

interface OrgOption {
  id: string;
  name: string;
  subscription_plan: string | null;
  active_poles: string[];
}

interface DiagRow {
  moduleId: string;
  label: string;
  isChild: boolean;
  inPlan: boolean;
  inPole: boolean;
  inRbac: boolean;
  final: boolean;
}

const StatusDot = ({ ok }: { ok: boolean | null }) => {
  if (ok === null) return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  return ok
    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    : <XCircle className="h-4 w-4 text-destructive" />;
};

export function AccessDiagnosticTab() {
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<DiagRow[]>([]);
  const [scanned, setScanned] = useState(false);

  // Load orgs on first render
  const loadOrgs = useCallback(async () => {
    if (orgsLoaded) return;
    const { data } = await supabase.rpc("get_all_organizations");
    setOrgs(
      (data ?? []).map((o: any) => ({
        id: o.id,
        name: o.name,
        subscription_plan: o.subscription_plan,
        active_poles: o.active_poles ?? [],
      }))
    );
    setOrgsLoaded(true);
  }, [orgsLoaded]);

  // Trigger load on mount-like
  useState(() => { loadOrgs(); });

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === selectedOrgId) ?? null,
    [orgs, selectedOrgId]
  );

  const handleScan = useCallback(async () => {
    if (!selectedOrgId || !selectedRole) {
      toast({ title: "Sélection requise", description: "Choisissez une organisation et un rôle.", variant: "destructive" });
      return;
    }

    setScanning(true);
    try {
      const org = orgs.find((o) => o.id === selectedOrgId);
      if (!org) throw new Error("Org not found");

      const plan = (org.subscription_plan ?? "starter") as PlanId;
      const activePoles = new Set(org.active_poles);

      // Fetch permissions: global + org-specific for this role
      const { data: permsData, error } = await supabase
        .from("role_permissions")
        .select("module, enabled, can_view, org_id")
        .eq("role", selectedRole as any)
        .or(`org_id.is.null,org_id.eq.${selectedOrgId}`);

      if (error) throw error;

      // Smart merge: org-specific wins
      const permMap = new Map<string, boolean>();
      const globalMap = new Map<string, boolean>();
      const orgMap = new Map<string, boolean>();

      for (const row of (permsData ?? []) as any[]) {
        const isActive = !!row.enabled || !!row.can_view;
        if (row.org_id === selectedOrgId) {
          const cur = orgMap.get(row.module) ?? false;
          orgMap.set(row.module, cur || isActive);
        } else if (row.org_id === null) {
          const cur = globalMap.get(row.module) ?? false;
          globalMap.set(row.module, cur || isActive);
        }
      }

      // Merge: org wins over global
      const allModules = new Set([...globalMap.keys(), ...orgMap.keys()]);
      for (const mod of allModules) {
        permMap.set(mod, orgMap.has(mod) ? !!orgMap.get(mod) : !!globalMap.get(mod));
      }

      // Build diagnostic rows
      const diagRows: DiagRow[] = [];

      for (const group of RBAC_MODULE_HIERARCHY) {
        const parentInPlan = isModuleInPlan(group.id, plan);
        const parentInPole = activePoles.size === 0 || activePoles.has(group.id);
        const parentInRbac = permMap.has(group.id)
          ? !!permMap.get(group.id)
          : hasDefaultView(selectedRole, group.id);
        const parentFinal = parentInPlan && parentInPole && parentInRbac;

        diagRows.push({
          moduleId: group.id,
          label: group.label,
          isChild: false,
          inPlan: parentInPlan,
          inPole: parentInPole,
          inRbac: parentInRbac,
          final: parentFinal,
        });

        for (const child of group.children) {
          const childInPlan = isModuleInPlan(child.id, plan);
          const childInPole = parentInPole;
          // RBAC: Strict — explicit entry wins, parent only as last resort
          const resolveChildRbac = (): boolean => {
            // 1. Explicit DB entry for this child → use it directly
            if (permMap.has(child.id)) {
              return !!permMap.get(child.id);
            }
            // 2. Factory default for this child
            if (hasDefaultView(selectedRole, child.id)) return true;
            // 3. No entry found → inherit from parent
            if (permMap.has(group.id)) return !!permMap.get(group.id);
            return hasDefaultView(selectedRole, group.id);
          };
          const childInRbac = resolveChildRbac();
          const childFinal = childInPlan && childInPole && childInRbac;

          diagRows.push({
            moduleId: child.id,
            label: child.label,
            isChild: true,
            inPlan: childInPlan,
            inPole: childInPole,
            inRbac: childInRbac,
            final: childFinal,
          });
        }
      }

      setRows(diagRows);
      setScanned(true);
      toast({ title: "Scan terminé", description: `${diagRows.length} modules analysés.` });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  }, [selectedOrgId, selectedRole, orgs, toast]);

  const allowedCount = rows.filter((r) => r.final).length;
  const blockedCount = rows.filter((r) => !r.final).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <SearchCheck className="h-4 w-4 text-primary" />
          Diagnostic d'Accès
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Simulez la visibilité des modules pour un rôle dans une organisation donnée.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selectors */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 min-w-[220px]">
            <label className="text-xs font-medium text-muted-foreground">Organisation</label>
            <Select value={selectedOrgId} onValueChange={(v) => { setSelectedOrgId(v); setScanned(false); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choisir une organisation…" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground">Rôle</label>
            <Select value={selectedRole} onValueChange={(v) => { setSelectedRole(v); setScanned(false); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choisir un rôle…" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleScan}
            disabled={scanning || !selectedOrgId || !selectedRole}
            className="h-9 gap-1.5"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Scanner les permissions
          </Button>
        </div>

        {/* Org context summary */}
        {selectedOrg && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1">
              Plan: <span className="font-semibold">{selectedOrg.subscription_plan ?? "starter"}</span>
            </Badge>
            <Badge variant="outline" className="gap-1">
              Pôles actifs: <span className="font-semibold">{selectedOrg.active_poles.length === 0 ? "Tous" : selectedOrg.active_poles.join(", ")}</span>
            </Badge>
          </div>
        )}

        {/* Results summary */}
        {scanned && (
          <div className="flex gap-3">
            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-400/30 gap-1">
              <CheckCircle2 className="h-3 w-3" /> {allowedCount} autorisé{allowedCount > 1 ? "s" : ""}
            </Badge>
            <Badge className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
              <XCircle className="h-3 w-3" /> {blockedCount} bloqué{blockedCount > 1 ? "s" : ""}
            </Badge>
          </div>
        )}

        {/* Results table */}
        {scanned && rows.length > 0 && (
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Module</TableHead>
                  <TableHead className="text-center w-20">Plan</TableHead>
                  <TableHead className="text-center w-20">Pôle</TableHead>
                  <TableHead className="text-center w-20">RBAC</TableHead>
                  <TableHead className="text-center w-20">Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.moduleId}
                    className={!row.final ? "opacity-60" : ""}
                  >
                    <TableCell className={row.isChild ? "pl-8" : "font-semibold"}>
                      {row.isChild ? "└ " : ""}{row.label}
                      <span className="ml-2 text-[10px] text-muted-foreground font-mono">{row.moduleId}</span>
                    </TableCell>
                    <TableCell className="text-center"><StatusDot ok={row.inPlan} /></TableCell>
                    <TableCell className="text-center"><StatusDot ok={row.inPole} /></TableCell>
                    <TableCell className="text-center"><StatusDot ok={row.inRbac} /></TableCell>
                    <TableCell className="text-center"><StatusDot ok={row.final} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {/* Empty state */}
        {!scanned && (
          <div className="text-center py-12 text-muted-foreground">
            <SearchCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Sélectionnez une organisation et un rôle, puis cliquez sur <strong>Scanner les permissions</strong>.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}