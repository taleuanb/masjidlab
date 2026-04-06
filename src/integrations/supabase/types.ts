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
      documents_library: {
        Row: {
          created_at: string | null
          id: string
          nom: string
          org_id: string
          type_document: string | null
          updated_at: string | null
          uploaded_by: string | null
          url_fichier: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nom: string
          org_id: string
          type_document?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          url_fichier: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nom?: string
          org_id?: string
          type_document?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          url_fichier?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_library_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          created_at: string | null
          date_don: string | null
          donor_id: string | null
          id: string
          methode_paiement: string | null
          montant: number
          org_id: string
        }
        Insert: {
          created_at?: string | null
          date_don?: string | null
          donor_id?: string | null
          id?: string
          methode_paiement?: string | null
          montant: number
          org_id: string
        }
        Update: {
          created_at?: string | null
          date_don?: string | null
          donor_id?: string | null
          id?: string
          methode_paiement?: string | null
          montant?: number
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donors: {
        Row: {
          adresse_postale: string | null
          created_at: string | null
          email: string | null
          id: string
          nom: string
          org_id: string
          prenom: string | null
          updated_at: string | null
        }
        Insert: {
          adresse_postale?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nom: string
          org_id: string
          prenom?: string | null
          updated_at?: string | null
        }
        Update: {
          adresse_postale?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nom?: string
          org_id?: string
          prenom?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      invitations: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          org_id: string
          org_name: string | null
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          org_id: string
          org_name?: string | null
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          org_name?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_academic_years: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          is_current: boolean | null
          label: string
          org_id: string | null
          start_date: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          label: string
          org_id?: string | null
          start_date?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          label?: string
          org_id?: string | null
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_academic_years_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_attendance: {
        Row: {
          class_id: string | null
          created_at: string | null
          date: string
          enrollment_id: string
          id: string
          notes: string | null
          org_id: string
          session_id: string | null
          status: string
          student_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          date?: string
          enrollment_id: string
          id?: string
          notes?: string | null
          org_id: string
          session_id?: string | null
          status?: string
          student_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          date?: string
          enrollment_id?: string
          id?: string
          notes?: string | null
          org_id?: string
          session_id?: string | null
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "madrasa_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_madrasa_class_health"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "madrasa_attendance_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "madrasa_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_attendance_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "view_unplaced_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "madrasa_attendance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "madrasa_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "madrasa_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_student_fees_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "madrasa_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_unplaced_students"
            referencedColumns: ["student_id"]
          },
        ]
      }
      madrasa_calendar: {
        Row: {
          affects_classes: boolean | null
          created_at: string | null
          end_date: string
          id: string
          org_id: string
          start_date: string
          title: string
          type: string
        }
        Insert: {
          affects_classes?: boolean | null
          created_at?: string | null
          end_date: string
          id?: string
          org_id: string
          start_date: string
          title: string
          type: string
        }
        Update: {
          affects_classes?: boolean | null
          created_at?: string | null
          end_date?: string
          id?: string
          org_id?: string
          start_date?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_calendar_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_class_subjects: {
        Row: {
          class_id: string
          subject_id: string
        }
        Insert: {
          class_id: string
          subject_id: string
        }
        Update: {
          class_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "madrasa_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_madrasa_class_health"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "madrasa_class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "madrasa_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_classes: {
        Row: {
          academic_year_id: string | null
          capacity_max: number | null
          created_at: string | null
          id: string
          level_id: string | null
          niveau: string | null
          nom: string
          org_id: string
          prof_id: string | null
          salle_id: string | null
          updated_at: string | null
        }
        Insert: {
          academic_year_id?: string | null
          capacity_max?: number | null
          created_at?: string | null
          id?: string
          level_id?: string | null
          niveau?: string | null
          nom: string
          org_id: string
          prof_id?: string | null
          salle_id?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string | null
          capacity_max?: number | null
          created_at?: string | null
          id?: string
          level_id?: string | null
          niveau?: string | null
          nom?: string
          org_id?: string
          prof_id?: string | null
          salle_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "madrasa_academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_classes_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "madrasa_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_classes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_classes_prof_id_fkey"
            columns: ["prof_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_classes_salle_id_fkey"
            columns: ["salle_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_cycles: {
        Row: {
          age_max: number | null
          age_min: number | null
          created_at: string | null
          description: string | null
          gender_restriction: string | null
          id: string
          nom: string
          org_id: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string | null
          description?: string | null
          gender_restriction?: string | null
          id?: string
          nom: string
          org_id?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string | null
          description?: string | null
          gender_restriction?: string | null
          id?: string
          nom?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_cycles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_enrollments: {
        Row: {
          academic_status: string | null
          academic_year_id: string | null
          annee_scolaire: string
          class_id: string | null
          created_at: string | null
          id: string
          level_id: string | null
          org_id: string
          pedagogical_status: string | null
          preferences: Json | null
          statut: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          academic_status?: string | null
          academic_year_id?: string | null
          annee_scolaire: string
          class_id?: string | null
          created_at?: string | null
          id?: string
          level_id?: string | null
          org_id: string
          pedagogical_status?: string | null
          preferences?: Json | null
          statut?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          academic_status?: string | null
          academic_year_id?: string | null
          annee_scolaire?: string
          class_id?: string | null
          created_at?: string | null
          id?: string
          level_id?: string | null
          org_id?: string
          pedagogical_status?: string | null
          preferences?: Json | null
          statut?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_enrollments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "madrasa_academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "madrasa_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_madrasa_class_health"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "madrasa_enrollments_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "madrasa_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_enrollments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "madrasa_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_student_fees_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "madrasa_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_unplaced_students"
            referencedColumns: ["student_id"]
          },
        ]
      }
      madrasa_evaluations: {
        Row: {
          class_id: string
          created_at: string | null
          date: string
          description: string | null
          id: string
          max_points: number | null
          org_id: string
          subject_id: string | null
          title: string
          total_points: number | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          max_points?: number | null
          org_id: string
          subject_id?: string | null
          title: string
          total_points?: number | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          max_points?: number | null
          org_id?: string
          subject_id?: string | null
          title?: string
          total_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_evaluations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "madrasa_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_evaluations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_madrasa_class_health"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "madrasa_evaluations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_evaluations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "madrasa_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_fees: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          id: string
          org_id: string
          status: string
          student_id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          id?: string
          org_id: string
          status?: string
          student_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: string
          org_id?: string
          status?: string
          student_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_fees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "madrasa_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_student_fees_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "madrasa_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_unplaced_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "madrasa_fees_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_grades: {
        Row: {
          comment: string | null
          created_at: string | null
          evaluation_id: string
          id: string
          org_id: string
          score: number | null
          student_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          evaluation_id: string
          id?: string
          org_id: string
          score?: number | null
          student_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          evaluation_id?: string
          id?: string
          org_id?: string
          score?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_grades_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "madrasa_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_grades_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "madrasa_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_student_fees_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "madrasa_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_unplaced_students"
            referencedColumns: ["student_id"]
          },
        ]
      }
      madrasa_levels: {
        Row: {
          created_at: string | null
          cycle_id: string | null
          cycle_type: string | null
          description: string | null
          id: string
          label: string
          org_id: string
          tarif_mensuel: number | null
        }
        Insert: {
          created_at?: string | null
          cycle_id?: string | null
          cycle_type?: string | null
          description?: string | null
          id?: string
          label: string
          org_id: string
          tarif_mensuel?: number | null
        }
        Update: {
          created_at?: string | null
          cycle_id?: string | null
          cycle_type?: string | null
          description?: string | null
          id?: string
          label?: string
          org_id?: string
          tarif_mensuel?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_levels_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "madrasa_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_levels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_schedules: {
        Row: {
          class_id: string
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          org_id: string
          start_time: string
          subject_ids: string[] | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          org_id: string
          start_time: string
          subject_ids?: string[] | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          org_id?: string
          start_time?: string
          subject_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "madrasa_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_madrasa_class_health"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "madrasa_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_session_configs: {
        Row: {
          created_at: string | null
          form_schema_json: Json
          id: string
          org_id: string
          subject_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          form_schema_json?: Json
          id?: string
          org_id: string
          subject_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          form_schema_json?: Json
          id?: string
          org_id?: string
          subject_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_session_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_session_configs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "madrasa_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_sessions: {
        Row: {
          actual_teacher_id: string
          attendance_count: number | null
          average_rating: number | null
          class_id: string
          completed_at: string | null
          created_at: string | null
          date: string
          id: string
          org_id: string
          schedule_id: string | null
          status: string | null
          summary_note: string | null
        }
        Insert: {
          actual_teacher_id: string
          attendance_count?: number | null
          average_rating?: number | null
          class_id: string
          completed_at?: string | null
          created_at?: string | null
          date?: string
          id?: string
          org_id: string
          schedule_id?: string | null
          status?: string | null
          summary_note?: string | null
        }
        Update: {
          actual_teacher_id?: string
          attendance_count?: number | null
          average_rating?: number | null
          class_id?: string
          completed_at?: string | null
          created_at?: string | null
          date?: string
          id?: string
          org_id?: string
          schedule_id?: string | null
          status?: string | null
          summary_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "madrasa_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_madrasa_class_health"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "madrasa_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_sessions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "madrasa_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_sessions_teacher_id_fkey"
            columns: ["actual_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_settings: {
        Row: {
          allow_public_registration: boolean | null
          attendance_threshold: number | null
          billing_cycle: string | null
          currency: string | null
          org_id: string
          session_report_template: string | null
          updated_at: string | null
          whatsapp_absence_template: string | null
          whatsapp_session_template: string | null
        }
        Insert: {
          allow_public_registration?: boolean | null
          attendance_threshold?: number | null
          billing_cycle?: string | null
          currency?: string | null
          org_id: string
          session_report_template?: string | null
          updated_at?: string | null
          whatsapp_absence_template?: string | null
          whatsapp_session_template?: string | null
        }
        Update: {
          allow_public_registration?: boolean | null
          attendance_threshold?: number | null
          billing_cycle?: string | null
          currency?: string | null
          org_id?: string
          session_report_template?: string | null
          updated_at?: string | null
          whatsapp_absence_template?: string | null
          whatsapp_session_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_student_goals: {
        Row: {
          academic_year: string
          created_at: string | null
          current_position: number
          id: string
          org_id: string
          student_id: string
          subject_id: string
          target_value: number
          unit_label: string
          updated_at: string | null
        }
        Insert: {
          academic_year: string
          created_at?: string | null
          current_position?: number
          id?: string
          org_id: string
          student_id: string
          subject_id: string
          target_value?: number
          unit_label?: string
          updated_at?: string | null
        }
        Update: {
          academic_year?: string
          created_at?: string | null
          current_position?: number
          id?: string
          org_id?: string
          student_id?: string
          subject_id?: string
          target_value?: number
          unit_label?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_student_goals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_student_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "madrasa_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_student_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_student_fees_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "madrasa_student_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_unplaced_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "madrasa_student_goals_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "madrasa_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_student_progress: {
        Row: {
          class_id: string
          config_id: string
          created_at: string | null
          data_json: Json
          id: string
          lesson_date: string
          org_id: string
          session_id: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          config_id: string
          created_at?: string | null
          data_json?: Json
          id?: string
          lesson_date?: string
          org_id: string
          session_id?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          config_id?: string
          created_at?: string | null
          data_json?: Json
          id?: string
          lesson_date?: string
          org_id?: string
          session_id?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_student_progress_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "madrasa_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_student_progress_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_madrasa_class_health"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "madrasa_student_progress_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "madrasa_session_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_student_progress_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_student_progress_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "madrasa_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "madrasa_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_student_fees_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "madrasa_student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_unplaced_students"
            referencedColumns: ["student_id"]
          },
        ]
      }
      madrasa_students: {
        Row: {
          age: number | null
          created_at: string | null
          current_assessment: Json | null
          date_naissance: string | null
          family_id: string | null
          gender: string | null
          id: string
          niveau: string | null
          nom: string
          org_id: string
          parent_id: string | null
          prenom: string
          statut: string | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          created_at?: string | null
          current_assessment?: Json | null
          date_naissance?: string | null
          family_id?: string | null
          gender?: string | null
          id?: string
          niveau?: string | null
          nom: string
          org_id: string
          parent_id?: string | null
          prenom: string
          statut?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          created_at?: string | null
          current_assessment?: Json | null
          date_naissance?: string | null
          family_id?: string | null
          gender?: string | null
          id?: string
          niveau?: string | null
          nom?: string
          org_id?: string
          parent_id?: string | null
          prenom?: string
          statut?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_students_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_subjects: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_subjects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_template_items: {
        Row: {
          created_at: string | null
          id: string
          level_label: string
          pack_id: string | null
          rank: number | null
          suggested_subjects: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          level_label: string
          pack_id?: string | null
          rank?: number | null
          suggested_subjects?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          level_label?: string
          pack_id?: string | null
          rank?: number | null
          suggested_subjects?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_template_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "madrasa_template_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      madrasa_template_packs: {
        Row: {
          created_at: string | null
          description: string | null
          icon_name: string | null
          id: string
          nom: string
          public_cible: string | null
          tag_label: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          nom: string
          public_cible?: string | null
          tag_label?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          nom?: string
          public_cible?: string | null
          tag_label?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          active_poles: string[] | null
          address: string | null
          chosen_plan: string | null
          city: string | null
          contact_email: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          max_users: number | null
          name: string
          notes_admin: string | null
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          siret: string | null
          status: string | null
          subscription_plan: string | null
        }
        Insert: {
          active_poles?: string[] | null
          address?: string | null
          chosen_plan?: string | null
          city?: string | null
          contact_email?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_users?: number | null
          name: string
          notes_admin?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          status?: string | null
          subscription_plan?: string | null
        }
        Update: {
          active_poles?: string[] | null
          address?: string | null
          chosen_plan?: string | null
          city?: string | null
          contact_email?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_users?: number | null
          name?: string
          notes_admin?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          status?: string | null
          subscription_plan?: string | null
        }
        Relationships: []
      }
      poles: {
        Row: {
          core_type: string | null
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
          core_type?: string | null
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
          core_type?: string | null
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
          teacher_availabilities: Json | null
          teacher_specialties: string[] | null
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
          teacher_availabilities?: Json | null
          teacher_specialties?: string[] | null
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
          teacher_availabilities?: Json | null
          teacher_specialties?: string[] | null
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
      role_permissions: {
        Row: {
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          enabled: boolean | null
          id: string
          module: string
          org_id: string | null
          parent_key: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          module: string
          org_id?: string | null
          parent_key?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          module?: string
          org_id?: string | null
          parent_key?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      saas_widget_configs: {
        Row: {
          allowed_roles: string[]
          created_at: string | null
          id: string
          is_enabled: boolean
          label: string
          priority: number
          required_plans: string[]
          required_pole: string | null
          updated_at: string | null
          widget_key: string
        }
        Insert: {
          allowed_roles?: string[]
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          label: string
          priority?: number
          required_plans?: string[]
          required_pole?: string | null
          updated_at?: string | null
          widget_key: string
        }
        Update: {
          allowed_roles?: string[]
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          label?: string
          priority?: number
          required_plans?: string[]
          required_pole?: string | null
          updated_at?: string | null
          widget_key?: string
        }
        Relationships: []
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
      staff_contracts: {
        Row: {
          created_at: string | null
          date_debut: string
          date_fin: string | null
          id: string
          org_id: string
          profile_id: string
          salaire_base: number | null
          type_contrat: Database["public"]["Enums"]["contract_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_debut: string
          date_fin?: string | null
          id?: string
          org_id: string
          profile_id: string
          salaire_base?: number | null
          type_contrat?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_debut?: string
          date_fin?: string | null
          id?: string
          org_id?: string
          profile_id?: string
          salaire_base?: number | null
          type_contrat?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_contracts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_receipts: {
        Row: {
          annee_fiscale: number
          created_at: string | null
          donor_id: string
          id: string
          numero_cerfa: string | null
          org_id: string
          url_pdf: string | null
        }
        Insert: {
          annee_fiscale: number
          created_at?: string | null
          donor_id: string
          id?: string
          numero_cerfa?: string | null
          org_id: string
          url_pdf?: string | null
        }
        Update: {
          annee_fiscale?: number
          created_at?: string | null
          donor_id?: string
          id?: string
          numero_cerfa?: string | null
          org_id?: string
          url_pdf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_receipts_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_receipts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      v_madrasa_class_health: {
        Row: {
          avg_attendance_abs: number | null
          class_id: string | null
          class_name: string | null
          global_performance_avg: number | null
          last_session_at: string | null
          org_id: string | null
          total_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_classes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      view_student_attendance_kpi: {
        Row: {
          attendance_percentage: number | null
          class_id: string | null
          present_count: number | null
          student_id: string | null
          total_recorded_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "madrasa_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_madrasa_class_health"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "madrasa_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "madrasa_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_student_fees_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "madrasa_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "view_unplaced_students"
            referencedColumns: ["student_id"]
          },
        ]
      }
      view_student_fees_summary: {
        Row: {
          classe_nom: string | null
          nb_echeances: number | null
          nb_retards: number | null
          nom: string | null
          org_id: string | null
          prenom: string | null
          solde_restant: number | null
          student_id: string | null
          total_annuel: number | null
          total_paye: number | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_students_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      view_unplaced_students: {
        Row: {
          academic_year_id: string | null
          age: number | null
          enrollment_id: string | null
          family_id: string | null
          gender: string | null
          level_id: string | null
          nom: string | null
          preferences: Json | null
          prenom: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madrasa_enrollments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "madrasa_academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madrasa_enrollments_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "madrasa_levels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      clone_default_permissions: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      get_admin_organizations: {
        Args: never
        Returns: {
          active_poles: string[] | null
          address: string | null
          chosen_plan: string | null
          city: string | null
          contact_email: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          max_users: number | null
          name: string
          notes_admin: string | null
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          siret: string | null
          status: string | null
          subscription_plan: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_all_organizations: {
        Args: never
        Returns: {
          active_poles: string[] | null
          address: string | null
          chosen_plan: string | null
          city: string | null
          contact_email: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          max_users: number | null
          name: string
          notes_admin: string | null
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          siret: string | null
          status: string | null
          subscription_plan: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_all_orgs_with_stats: {
        Args: never
        Returns: {
          active_poles: string[]
          id: string
          name: string
          subscription_plan: string
          user_count: number
        }[]
      }
      get_effective_permissions:
        | {
            Args: { p_org_id: string; p_role: string }
            Returns: {
              can_view: boolean
              enabled: boolean
              module: string
            }[]
          }
        | {
            Args: { p_org_id: string; p_user_id: string }
            Returns: {
              can_delete: boolean
              can_edit: boolean
              can_view: boolean
              enabled: boolean
              module: string
            }[]
          }
      get_my_org_id: { Args: never; Returns: string }
      handle_onboarding: {
        Args: {
          p_city: string
          p_name: string
          p_phone?: string
          p_plan?: string
          p_postal_code?: string
          p_siret?: string
        }
        Returns: string
      }
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
        | "enseignant"
      contract_type: "CDI" | "CDD" | "Bénévole" | "Vacataire"
      enrollment_academic_status: "pre_registered" | "validated" | "archived"
      enrollment_pedagogical_status: "waiting_placement" | "placed" | "on_trial"
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
        "enseignant",
      ],
      contract_type: ["CDI", "CDD", "Bénévole", "Vacataire"],
      enrollment_academic_status: ["pre_registered", "validated", "archived"],
      enrollment_pedagogical_status: [
        "waiting_placement",
        "placed",
        "on_trial",
      ],
    },
  },
} as const
