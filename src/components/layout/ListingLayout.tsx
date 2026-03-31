import React from "react";
import { Search, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ListingTab {
  id: string;
  label: string;
}

export interface ListingLayoutProps {
  title: string;
  count?: number;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  tabs?: ListingTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  viewMode?: "grid" | "list";
  onViewModeChange?: (mode: "grid" | "list") => void;
  addAction?: React.ReactNode;
  children: React.ReactNode;
}

export function ListingLayout({
  title,
  count,
  searchPlaceholder = "Rechercher…",
  onSearch,
  tabs,
  activeTab,
  onTabChange,
  viewMode = "grid",
  onViewModeChange,
  addAction,
  children,
}: ListingLayoutProps) {
  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {count !== undefined && (
            <Badge variant="secondary" className="text-xs font-medium bg-muted text-muted-foreground">
              {count}
            </Badge>
          )}
        </div>
        {addAction && <div className="shrink-0">{addAction}</div>}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        {onSearch && (
          <div className="relative w-full sm:w-[30%] sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={searchPlaceholder}
              onChange={(e) => onSearch(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
        )}

        {/* Tabs / Segmented Control */}
        {tabs && tabs.length > 0 && onTabChange && (
          <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 min-w-0">
            <TabsList className="h-9">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs px-3">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* View Mode Toggle */}
        {onViewModeChange && (
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => { if (v) onViewModeChange(v as "grid" | "list"); }}
            className="shrink-0 ml-auto"
          >
            <ToggleGroupItem value="grid" aria-label="Vue grille" className="h-9 w-9 p-0">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Vue liste" className="h-9 w-9 p-0">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      {/* ── Content ── */}
      <div>{children}</div>
    </div>
  );
}
