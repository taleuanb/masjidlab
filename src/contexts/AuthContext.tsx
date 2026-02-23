import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface EffectivePermission {
  module: string;
  enabled: boolean;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface ImpersonatedUser {
  id: string;
  name: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** All DB roles for the current user (multi-role) */
  dbRoles: string[];
  /** Highest-priority role (for backward compat) */
  dbRole: string | null;
  /** Effective permissions resolved via RPC for current org */
  permissions: EffectivePermission[];
  permissionsLoading: boolean;
  /** Refresh permissions (e.g. after org change) */
  refreshPermissions: (orgId?: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Ghost mode / User impersonation */
  impersonatedUser: ImpersonatedUser | null;
  startImpersonating: (target: ImpersonatedUser) => void;
  stopImpersonating: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_PRIORITY = ["super_admin", "admin", "responsable", "imam_chef", "enseignant", "benevole", "parent", "eleve"];

function pickHighestRole(roles: string[]): string | null {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return roles[0] ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbRoles, setDbRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<EffectivePermission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

  const dbRole = pickHighestRole(dbRoles);

  const startImpersonating = useCallback((target: ImpersonatedUser) => {
    if (dbRoles.includes("super_admin")) {
      setImpersonatedUser(target);
    }
  }, [dbRoles]);

  const stopImpersonating = useCallback(() => {
    setImpersonatedUser(null);
  }, []);

  // Auto-stop impersonation if user loses super_admin or signs out
  useEffect(() => {
    if (impersonatedUser && (!user || !dbRoles.includes("super_admin"))) {
      setImpersonatedUser(null);
    }
  }, [user, dbRoles, impersonatedUser]);

  const fetchRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching roles:", error.message);
      setDbRoles([]);
      return;
    }
    setDbRoles((data ?? []).map((r) => r.role));
  };

  const refreshPermissions = useCallback(async (orgId?: string) => {
    const currentUser = user;
    if (!currentUser || !orgId) {
      setPermissions([]);
      return;
    }
    setPermissionsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_effective_permissions" as any, {
        p_org_id: orgId,
        p_user_id: currentUser.id,
      });
      if (error || !data) {
        console.error("Error fetching permissions:", error?.message);
        setPermissions([]);
        return;
      }
      setPermissions(
        (data as any[]).map((row) => ({
          module: row.module,
          enabled: row.enabled ?? false,
          can_view: row.can_view ?? false,
          can_edit: row.can_edit ?? false,
          can_delete: row.can_delete ?? false,
        }))
      );
    } finally {
      setPermissionsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchRoles(session.user.id), 0);
        } else {
          setDbRoles([]);
          setPermissions([]);
        }
      }
    );

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchRoles(session.user.id);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setDbRoles([]);
    setPermissions([]);
    setImpersonatedUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, dbRoles, dbRole, permissions, permissionsLoading, refreshPermissions, signOut, impersonatedUser, startImpersonating, stopImpersonating }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
