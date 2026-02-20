import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  dbRole: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbRole, setDbRole] = useState<string | null>(null);

  const fetchRole = async (userId: string) => {
    // Fetch ALL roles for this user to prioritize super_admin
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching roles:", error.message);
      setDbRole(null);
      return;
    }

    const roles = (data ?? []).map((r) => r.role);
    // Prioritize super_admin over any other role
    if (roles.includes("super_admin")) {
      setDbRole("super_admin");
    } else if (roles.includes("admin")) {
      setDbRole("admin");
    } else if (roles.includes("responsable")) {
      setDbRole("responsable");
    } else if (roles.includes("imam_chef")) {
      setDbRole("imam_chef");
    } else {
      setDbRole(roles[0] ?? null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Listen for ONGOING auth changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // setTimeout avoids Supabase deadlock in the callback
          setTimeout(() => fetchRole(session.user.id), 0);
        } else {
          setDbRole(null);
        }
      }
    );

    // INITIAL load controls the loading state
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchRole(session.user.id);
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
    setDbRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, dbRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
