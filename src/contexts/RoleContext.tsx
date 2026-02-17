import React, { createContext, useContext, useState, type ReactNode } from "react";
import { Pole } from "@/types/amm";

export type UserRole = "Admin" | "Imam/Chef de Pôle" | "Bénévole";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  pole: Pole;
  setPole: (pole: Pole) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("Admin");
  const [pole, setPole] = useState<Pole>("Imam");

  return (
    <RoleContext.Provider value={{ role, setRole, pole, setPole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used within RoleProvider");
  return context;
}
