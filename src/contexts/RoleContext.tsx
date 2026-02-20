import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { Pole } from "@/types/amm";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "Super Admin" | "Admin" | "Chef de Pôle" | "Bénévole" | "Responsable" | "Parent" | "Élève" | "Enseignant";

const DB_ROLE_TO_UI: Record<string, UserRole> = {
  super_admin: "Super Admin",
  admin: "Admin",
  imam_chef: "Chef de Pôle",
  responsable: "Responsable",
  benevole: "Bénévole",
  parent: "Parent",
  eleve: "Élève",
  enseignant: "Enseignant",
};

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  pole: Pole;
  setPole: (pole: Pole) => void;
  displayName: string | null;
  isSuperAdmin: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user, dbRole } = useAuth();
  const [role, setRole] = useState<UserRole>("Admin");
  const [pole, setPole] = useState<Pole>("Imam");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (dbRole) {
      setRole(DB_ROLE_TO_UI[dbRole] ?? "Bénévole");
      setIsSuperAdmin(dbRole === "super_admin");
    }
  }, [dbRole]);

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
    <RoleContext.Provider value={{ role, setRole, pole, setPole, displayName, isSuperAdmin }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used within RoleProvider");
  return context;
}
