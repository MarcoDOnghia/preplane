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
      application_notes: {
        Row: {
          application_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          application_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          application_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_reminders: {
        Row: {
          application_id: string
          created_at: string
          due_date: string
          id: string
          is_done: boolean
          reminder_type: string
          title: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          due_date: string
          id?: string
          is_done?: boolean
          reminder_type?: string
          title: string
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          due_date?: string
          id?: string
          is_done?: boolean
          reminder_type?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_reminders_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_timeline: {
        Row: {
          application_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json | null
          note: string | null
          to_status: string | null
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          note?: string | null
          to_status?: string | null
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          note?: string | null
          to_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_timeline_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          application_method: string | null
          applied_date: string | null
          applied_suggestions: Json | null
          ats_score: number | null
          company: string
          company_brief: string | null
          cover_letter: string
          cover_letter_versions: Json | null
          created_at: string
          current_cv: string | null
          cv_content: string
          cv_suggestions: Json
          follow_up_date: string | null
          formatting_issues: Json | null
          id: string
          interview_questions: Json | null
          interview_type: string | null
          interviewer_name: string | null
          job_description: string
          job_title: string
          key_requirements: Json
          keywords_found: Json | null
          keywords_missing: Json | null
          last_edited: string | null
          offer_deadline: string | null
          questions_to_ask: Json | null
          quick_wins: Json | null
          rejection_reason: string | null
          rejection_stage: string | null
          salary_currency: string | null
          salary_offered: number | null
          scheduled_date: string | null
          status: string | null
          tone: string
          user_id: string
        }
        Insert: {
          application_method?: string | null
          applied_date?: string | null
          applied_suggestions?: Json | null
          ats_score?: number | null
          company?: string
          company_brief?: string | null
          cover_letter?: string
          cover_letter_versions?: Json | null
          created_at?: string
          current_cv?: string | null
          cv_content: string
          cv_suggestions?: Json
          follow_up_date?: string | null
          formatting_issues?: Json | null
          id?: string
          interview_questions?: Json | null
          interview_type?: string | null
          interviewer_name?: string | null
          job_description: string
          job_title?: string
          key_requirements?: Json
          keywords_found?: Json | null
          keywords_missing?: Json | null
          last_edited?: string | null
          offer_deadline?: string | null
          questions_to_ask?: Json | null
          quick_wins?: Json | null
          rejection_reason?: string | null
          rejection_stage?: string | null
          salary_currency?: string | null
          salary_offered?: number | null
          scheduled_date?: string | null
          status?: string | null
          tone?: string
          user_id: string
        }
        Update: {
          application_method?: string | null
          applied_date?: string | null
          applied_suggestions?: Json | null
          ats_score?: number | null
          company?: string
          company_brief?: string | null
          cover_letter?: string
          cover_letter_versions?: Json | null
          created_at?: string
          current_cv?: string | null
          cv_content?: string
          cv_suggestions?: Json
          follow_up_date?: string | null
          formatting_issues?: Json | null
          id?: string
          interview_questions?: Json | null
          interview_type?: string | null
          interviewer_name?: string | null
          job_description?: string
          job_title?: string
          key_requirements?: Json
          keywords_found?: Json | null
          keywords_missing?: Json | null
          last_edited?: string | null
          offer_deadline?: string | null
          questions_to_ask?: Json | null
          quick_wins?: Json | null
          rejection_reason?: string | null
          rejection_stage?: string | null
          salary_currency?: string | null
          salary_offered?: number | null
          scheduled_date?: string | null
          status?: string | null
          tone?: string
          user_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          archived: boolean
          company: string
          connection_name: string | null
          connection_url: string | null
          cover_letter: string | null
          created_at: string
          cv_version: string
          followup_date: string | null
          id: string
          jd_text: string
          match_score: number
          notes: string | null
          outreach_message: string | null
          proof_in_progress: boolean
          proof_suggestion: string | null
          role: string
          status: string
          step_connection_done: boolean
          step_cover_letter_done: boolean
          step_cv_done: boolean
          step_followup_done: boolean
          step_outreach_done: boolean
          step_proof_done: boolean
          user_id: string
        }
        Insert: {
          archived?: boolean
          company: string
          connection_name?: string | null
          connection_url?: string | null
          cover_letter?: string | null
          created_at?: string
          cv_version?: string
          followup_date?: string | null
          id?: string
          jd_text?: string
          match_score?: number
          notes?: string | null
          outreach_message?: string | null
          proof_in_progress?: boolean
          proof_suggestion?: string | null
          role: string
          status?: string
          step_connection_done?: boolean
          step_cover_letter_done?: boolean
          step_cv_done?: boolean
          step_followup_done?: boolean
          step_outreach_done?: boolean
          step_proof_done?: boolean
          user_id: string
        }
        Update: {
          archived?: boolean
          company?: string
          connection_name?: string | null
          connection_url?: string | null
          cover_letter?: string | null
          created_at?: string
          cv_version?: string
          followup_date?: string | null
          id?: string
          jd_text?: string
          match_score?: number
          notes?: string | null
          outreach_message?: string | null
          proof_in_progress?: boolean
          proof_suggestion?: string | null
          role?: string
          status?: string
          step_connection_done?: boolean
          step_cover_letter_done?: boolean
          step_cv_done?: boolean
          step_followup_done?: boolean
          step_outreach_done?: boolean
          step_proof_done?: boolean
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          added_by: string | null
          categories: string[]
          city: string | null
          country: string
          created_at: string
          description: string | null
          hiring_juniors: boolean
          id: string
          linkedin_url: string | null
          name: string
          prestige_level: number
          remote_friendly: boolean
          size: string
          website: string | null
          why_good_for_juniors: string | null
        }
        Insert: {
          added_by?: string | null
          categories?: string[]
          city?: string | null
          country: string
          created_at?: string
          description?: string | null
          hiring_juniors?: boolean
          id?: string
          linkedin_url?: string | null
          name: string
          prestige_level?: number
          remote_friendly?: boolean
          size: string
          website?: string | null
          why_good_for_juniors?: string | null
        }
        Update: {
          added_by?: string | null
          categories?: string[]
          city?: string | null
          country?: string
          created_at?: string
          description?: string | null
          hiring_juniors?: boolean
          id?: string
          linkedin_url?: string | null
          name?: string
          prestige_level?: number
          remote_friendly?: boolean
          size?: string
          website?: string | null
          why_good_for_juniors?: string | null
        }
        Relationships: []
      }
      cvs: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          name: string
          parsed_text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          name: string
          parsed_text?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          name?: string
          parsed_text?: string
          user_id?: string
        }
        Relationships: []
      }
      interview_feedback: {
        Row: {
          application_id: string
          created_at: string
          id: string
          improvement_notes: string | null
          interview_date: string
          interview_type: string | null
          interviewer_name: string | null
          overall_notes: string | null
          questions_asked: Json
          self_rating: number
          unexpected_questions: Json
          updated_at: string
          user_id: string
          went_well: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          improvement_notes?: string | null
          interview_date?: string
          interview_type?: string | null
          interviewer_name?: string | null
          overall_notes?: string | null
          questions_asked?: Json
          self_rating?: number
          unexpected_questions?: Json
          updated_at?: string
          user_id: string
          went_well?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          improvement_notes?: string | null
          interview_date?: string
          interview_type?: string | null
          interviewer_name?: string | null
          overall_notes?: string | null
          questions_asked?: Json
          self_rating?: number
          unexpected_questions?: Json
          updated_at?: string
          user_id?: string
          went_well?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_messages: {
        Row: {
          application_id: string
          content: string
          created_at: string
          id: string
          message_type: string
          recipient_email: string | null
          recipient_name: string | null
          sent_at: string | null
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id: string
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean
          target_location: string | null
          target_role: string | null
          target_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          target_location?: string | null
          target_role?: string | null
          target_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          target_location?: string | null
          target_role?: string | null
          target_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
