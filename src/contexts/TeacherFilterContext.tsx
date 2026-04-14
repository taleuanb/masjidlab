import React, { createContext, useContext, useState, type ReactNode } from "react";

interface TeacherFilterContextType {
  selectedClassId: string | null;
  setSelectedClassId: (id: string | null) => void;
}

const TeacherFilterContext = createContext<TeacherFilterContextType | undefined>(undefined);

export function TeacherFilterProvider({ children }: { children: ReactNode }) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  return (
    <TeacherFilterContext.Provider value={{ selectedClassId, setSelectedClassId }}>
      {children}
    </TeacherFilterContext.Provider>
  );
}

export function useTeacherFilter() {
  const ctx = useContext(TeacherFilterContext);
  if (!ctx) throw new Error("useTeacherFilter must be used within TeacherFilterProvider");
  return ctx;
}
