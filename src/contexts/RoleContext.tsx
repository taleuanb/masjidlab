import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { Pole } from "@/types/amm";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "Super Admin" | "Admin Mosquée" | "Responsable" | "Enseignant / Oustaz" | "Bénévole" | "Parent d'élève";

export const DB_ROLE_TO_UI: Record<string, UserRole> = {
  super_admin: "Super Admin",
  admin: "Admin Mosquée",
  responsable: "Responsable",
  enseignant: "Enseignant / Oustaz",
  benevole: "Bénévole",
  parent: "Parent d'élève",
};

export const UI_ROLE_TO_DB: Record<UserRole, string> = {
  "Super Admin": "super_admin",
  "Admin Mosquée": "admin",
  "Responsable": "responsable",
  "Enseignant / Oustaz": "enseignant",
  "Bénévole": "benevole",
  "Parent d'élève": "parent",
};

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  pole: Pole;
  setPole: (pole: Pole) => void;
  displayName: string | null;
  isSuperAdmin: boolean;
  /** All DB roles for the current user */
  userDbRoles: string[];
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user, dbRoles, dbRole } = useAuth();
  const [role, setRole] = useState<UserRole>("Admin Mosquée");
  const [pole, setPole] = useState<Pole>("Imam");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (dbRole) {
      setRole(DB_ROLE_TO_UI[dbRole] ?? "Bénévole");
      setIsSuperAdmin(dbRoles.includes("super_admin"));
    }
  }, [dbRole, dbRoles]);

  useEffect(() => {
    if (!user) { setDisplayName(null); return; }
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? null));
  }, [user]);

  return (
    <RoleContext.Provider value={{ role, setRole, pole, setPole, displayName, isSuperAdmin, userDbRoles: dbRoles }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used within RoleProvider");
  return context;
}
