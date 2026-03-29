import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import type { CalendarEvent } from "@/hooks/useCalendarData";

// ── Types ──────────────────────────────────────────────────────────────
export interface ConflictResult {
  hasRoomConflict: boolean;
  hasTeacherConflict: boolean;
  roomConflictMsg: string | null;
  teacherConflictMsg: string | null;
}

interface DropPayload {
  event: CalendarEvent;
  newDayOfWeek: number; // 0=Sun … 6=Sat
  newStartTime?: string; // "HH:mm"
  newEndTime?: string;   // "HH:mm"
}

// ── Hook ───────────────────────────────────────────────────────────────
export function useScheduleDragDrop(allEvents: CalendarEvent[]) {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const undoRef = useRef<{
    scheduleId: string;
    oldDay: number;
    oldStart: string;
    oldEnd: string;
  } | null>(null);

  // ── Conflict detection (pure, synchronous against loaded events) ────
  const detectConflicts = useCallback(
    (event: CalendarEvent, targetDayOfWeek: number, startTime?: string, endTime?: string): ConflictResult => {
      const result: ConflictResult = {
        hasRoomConflict: false,
        hasTeacherConflict: false,
        roomConflictMsg: null,
        teacherConflictMsg: null,
      };

      const evStartTime = startTime ?? formatTime(event.start);
      const evEndTime = endTime ?? formatTime(event.end);
      const evStartMin = timeToMinutes(evStartTime);
      const evEndMin = timeToMinutes(evEndTime);

      // Check all other session events on the same target day
      for (const other of allEvents) {
        if (other.id === event.id) continue;
        if (other.type !== "session") continue;
        if (other.status === "cancelled") continue;

        const otherDay = other.start.getDay();
        if (otherDay !== targetDayOfWeek) continue;

        const otherStartMin = timeToMinutes(formatTime(other.start));
        const otherEndMin = timeToMinutes(formatTime(other.end));

        // Check time overlap
        if (evStartMin >= otherEndMin || evEndMin <= otherStartMin) continue;

        // Room conflict
        if (
          event.roomName &&
          other.roomName &&
          event.roomName === other.roomName
        ) {
          result.hasRoomConflict = true;
          result.roomConflictMsg = `Conflit : La salle "${event.roomName}" est déjà occupée par ${other.className ?? "une autre classe"} (${formatTime(other.start)}–${formatTime(other.end)}).`;
        }

        // Teacher conflict
        if (
          event.assignedTeacherId &&
          other.assignedTeacherId &&
          event.assignedTeacherId === other.assignedTeacherId
        ) {
          result.hasTeacherConflict = true;
          result.teacherConflictMsg = `Attention : ${event.assignedTeacherName ?? "L'enseignant"} a déjà une session (${other.className}) prévue à cette heure-là.`;
        }
      }

      return result;
    },
    [allEvents]
  );

  // ── Mutation: update madrasa_schedules ───────────────────────────────
  const mutation = useMutation({
    mutationFn: async (payload: DropPayload) => {
      if (!orgId) throw new Error("Org manquante");
      if (!payload.event.scheduleId) throw new Error("Pas de schedule_id");

      const newDay = payload.newDayOfWeek;
      const newStart = payload.newStartTime ?? formatTime(payload.event.start);
      const newEnd = payload.newEndTime ?? formatTime(payload.event.end);

      const { error } = await supabase
        .from("madrasa_schedules")
        .update({
          day_of_week: newDay,
          start_time: newStart,
          end_time: newEnd,
        })
        .eq("id", payload.event.scheduleId)
        .eq("org_id", orgId);

      if (error) throw error;
      return { scheduleId: payload.event.scheduleId, newDay, newStart, newEnd };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cal-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["cal-sessions"] });

      const undoData = undoRef.current;

      toast({
        title: "✅ Créneau déplacé",
        description: "Le planning a été mis à jour.",
      });

      // Show undo toast separately if we have undo data
      if (undoData) {
        setTimeout(() => {
          toast({
            title: "↩️ Annuler ?",
            description: "Cliquez pour restaurer l'ancien créneau.",
          });
        }, 100);
        // Store undo for 10s
        const timer = setTimeout(() => { undoRef.current = null; }, 10000);
        return () => clearTimeout(timer);
      }
    },
    onError: (err: any) => {
      // Rollback optimistic update by invalidating
      queryClient.invalidateQueries({ queryKey: ["cal-schedules"] });
      toast({
        title: "Erreur",
        description: err?.message ?? "Impossible de déplacer le créneau.",
        variant: "destructive",
      });
    },
  });

  // ── Undo ─────────────────────────────────────────────────────────────
  const handleUndo = useCallback(
    async (data: { scheduleId: string; oldDay: number; oldStart: string; oldEnd: string }) => {
      if (!orgId) return;
      const { error } = await supabase
        .from("madrasa_schedules")
        .update({
          day_of_week: data.oldDay,
          start_time: data.oldStart,
          end_time: data.oldEnd,
        })
        .eq("id", data.scheduleId)
        .eq("org_id", orgId);

      if (error) {
        toast({ title: "Erreur d'annulation", description: error.message, variant: "destructive" });
      } else {
        queryClient.invalidateQueries({ queryKey: ["cal-schedules"] });
        toast({ title: "↩️ Déplacement annulé", description: "Le créneau a été restauré." });
      }
    },
    [orgId, queryClient]
  );

  // ── Drop handler ────────────────────────────────────────────────────
  const handleDrop = useCallback(
    (payload: DropPayload) => {
      const { event, newDayOfWeek, newStartTime, newEndTime } = payload;

      if (!event.scheduleId) {
        toast({ title: "Action impossible", description: "Seuls les créneaux récurrents peuvent être déplacés.", variant: "destructive" });
        return false;
      }

      // Detect conflicts
      const conflicts = detectConflicts(event, newDayOfWeek, newStartTime, newEndTime);

      if (conflicts.hasRoomConflict) {
        toast({ title: "🚫 Conflit de salle", description: conflicts.roomConflictMsg!, variant: "destructive" });
        return false;
      }

      if (conflicts.hasTeacherConflict) {
        toast({ title: "⚠️ Conflit d'enseignant", description: conflicts.teacherConflictMsg!, variant: "destructive" });
        return false;
      }

      // Store old values for undo
      undoRef.current = {
        scheduleId: event.scheduleId,
        oldDay: event.start.getDay(),
        oldStart: formatTime(event.start),
        oldEnd: formatTime(event.end),
      };

      // Fire mutation
      mutation.mutate(payload);
      return true;
    },
    [detectConflicts, mutation]
  );

  return {
    handleDrop,
    detectConflicts,
    isUpdating: mutation.isPending,
  };
}

// ── Utils ──────────────────────────────────────────────────────────────
function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
