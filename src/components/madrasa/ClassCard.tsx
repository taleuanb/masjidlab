import React from "react";
import { Users, MapPin, Clock, Edit, PhoneCall, FileText, MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ClassCardProps {
  id: string;
  name: string;
  level: string;
  enrolled: number;
  capacityMax: number;
  teacherName: string | null;
  teacherAvatar?: string;
  roomName: string | null;
  scheduleDays: string[];
  scheduleTime: string;
  onClick: () => void;
  onEdit?: () => void;
  onCall?: () => void;
  onReport?: () => void;
}

export function ClassCard({
  name,
  level,
  enrolled,
  capacityMax,
  teacherName,
  teacherAvatar,
  roomName,
  scheduleDays,
  scheduleTime,
  onClick,
  onEdit,
  onCall,
  onReport,
}: ClassCardProps) {
  const fillRate = capacityMax > 0 ? (enrolled / capacityMax) * 100 : 0;
  const isFull = fillRate >= 100;
  const isWarning = fillRate >= 85 && !isFull;

  const progressColor = isFull
    ? "hsl(var(--destructive))"
    : isWarning
      ? "hsl(45 93% 47%)"
      : "hsl(var(--brand-emerald, 160 84% 39%))";

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden transition-all hover:shadow-md hover:border-primary/30"
      onClick={onClick}
    >
      {/* HEADER */}
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-foreground truncate">{name}</h3>
          <Badge variant="secondary" className="mt-1 text-[10px] font-normal">
            {level || "Sans niveau"}
          </Badge>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
          )}
          {onCall && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={onCall}>
              <PhoneCall className="h-3.5 w-3.5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onReport && (
                <DropdownMenuItem onClick={onReport}>
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  Bilan de session
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* BODY : KPIs */}
      <div className="px-4 pb-3 space-y-3">
        {/* Capacité */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Effectif
            </span>
            <span className="text-xs font-semibold text-foreground">
              {enrolled} / {capacityMax}
            </span>
          </div>
          <Progress
            value={Math.min(fillRate, 100)}
            className="h-1.5"
            style={{ "--progress-color": progressColor } as React.CSSProperties}
          />
        </div>

        {/* Prof & Salle */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={teacherAvatar} />
              <AvatarFallback className="text-[10px] bg-muted">
                {teacherName ? teacherName.charAt(0) : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-foreground truncate">
              {teacherName || "Non assigné"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{roomName || "Sans salle"}</span>
          </div>
        </div>
      </div>

      {/* FOOTER : Planning */}
      <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 bg-muted/30">
        <div className="flex flex-wrap gap-1">
          {scheduleDays.map((day, i) => (
            <Badge key={i} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
              {day}
            </Badge>
          ))}
          {scheduleDays.length === 0 && (
            <span className="text-[10px] text-muted-foreground italic">Pas de planning</span>
          )}
        </div>

        {scheduleTime && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            {scheduleTime}
          </div>
        )}
      </div>
    </Card>
  );
}
