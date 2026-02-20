export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom: string
          org_id: string | null
          pole_id: string | null
          statut: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          org_id?: string | null
          pole_id?: string | null
          statut?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          org_id?: string | null
          pole_id?: string | null
          statut?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_pole_id_fkey"
            columns: ["pole_id"]
            isOneToOne: false
            referencedRelation: "poles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          budget: number | null
          budget_depense: number | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          org_id: string | null
          pole: string | null
          required_skill: string | null
          salle_id: string | null
          titre: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          budget_depense?: number | null
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          org_id?: string | null
          pole?: string | null
          required_skill?: string | null
          salle_id?: string | null
          titre: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          budget_depense?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          org_id?: string | null
          pole?: string | null
          required_skill?: string | null
          salle_id?: string | null
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          categorie: string | null
          created_at: string | null
          created_by: string | null
          date_transaction: string | null
          id: string
          montant: number
          org_id: string | null
          piece_jointe_url: string | null
          titre: string
          type: string | null
        }
        Insert: {
          categorie?: string | null
          created_at?: string | null
          created_by?: string | null
          date_transaction?: string | null
          id?: string
          montant: number
          org_id?: string | null
          piece_jointe_url?: string | null
          titre: string
          type?: string | null
        }
        Update: {
          categorie?: string | null
          created_at?: string | null
          created_by?: string | null
          date_transaction?: string | null
          id?: string
          montant?: number
          org_id?: string | null
          piece_jointe_url?: string | null
          titre?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active_poles: string[] | null
          created_at: string | null
          id: string
          name: string
          owner_id: string | null
          subscription_plan: string | null
        }
        Insert: {
          active_poles?: string[] | null
          created_at?: string | null
          id?: string
          name: string
          owner_id?: string | null
          subscription_plan?: string | null
        }
        Update: {
          active_poles?: string[] | null
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          subscription_plan?: string | null
        }
        Relationships: []
      }
      poles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          manager_id: string | null
          nom: string
          org_id: string | null
          responsable_id: string | null
          target_staff: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          nom: string
          org_id?: string | null
          responsable_id?: string | null
          target_staff?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          nom?: string
          org_id?: string | null
          responsable_id?: string | null
          target_staff?: number
        }
        Relationships: [
          {
            foreignKeyName: "poles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poles_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          competences: string[] | null
          created_at: string
          display_name: string
          email: string | null
          has_account: boolean
          id: string
          is_active: boolean
          org_id: string | null
          phone: string | null
          pole_id: string | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          competences?: string[] | null
          created_at?: string
          display_name: string
          email?: string | null
          has_account?: boolean
          id?: string
          is_active?: boolean
          org_id?: string | null
          phone?: string | null
          pole_id?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          competences?: string[] | null
          created_at?: string
          display_name?: string
          email?: string | null
          has_account?: boolean
          id?: string
          is_active?: boolean
          org_id?: string | null
          phone?: string | null
          pole_id?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_pole_id_fkey"
            columns: ["pole_id"]
            isOneToOne: false
            referencedRelation: "poles"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_requests: {
        Row: {
          created_at: string
          event_id: string
          id: string
          note: string | null
          replacement_id: string | null
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          replacement_id?: string | null
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          replacement_id?: string | null
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number
          created_at: string
          features: string[]
          floor: string
          id: string
          name: string
          org_id: string | null
          pole: string | null
          statut: string
          type: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          features?: string[]
          floor: string
          id?: string
          name: string
          org_id?: string | null
          pole?: string | null
          statut?: string
          type?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          features?: string[]
          floor?: string
          id?: string
          name?: string
          org_id?: string | null
          pole?: string | null
          statut?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      skills_library: {
        Row: {
          created_at: string
          id: string
          label: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      urgent_alerts: {
        Row: {
          alert_type: string
          created_at: string
          event_id: string | null
          event_titre: string
          id: string
          message: string
          pole: string | null
          requester_id: string
          requester_name: string
          resolved: boolean
        }
        Insert: {
          alert_type?: string
          created_at?: string
          event_id?: string | null
          event_titre: string
          id?: string
          message: string
          pole?: string | null
          requester_id: string
          requester_name: string
          resolved?: boolean
        }
        Update: {
          alert_type?: string
          created_at?: string
          event_id?: string | null
          event_titre?: string
          id?: string
          message?: string
          pole?: string | null
          requester_id?: string
          requester_name?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "urgent_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_recurring: boolean
          start_time: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_recurring?: boolean
          start_time: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_recurring?: boolean
          start_time?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_organizations: {
        Args: never
        Returns: {
          active_poles: string[] | null
          created_at: string | null
          id: string
          name: string
          owner_id: string | null
          subscription_plan: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "imam_chef"
        | "benevole"
        | "super_admin"
        | "responsable"
        | "parent"
        | "eleve"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "imam_chef",
        "benevole",
        "super_admin",
        "responsable",
        "parent",
        "eleve",
      ],
    },
  },
} as const
