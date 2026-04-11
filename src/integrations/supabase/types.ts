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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      anomaly_results: {
        Row: {
          anomaly_type: string
          confidence: string | null
          created_at: string
          description: string | null
          id: string
          metadata_json: Json | null
          payslip_id: string
          severity: string
          status: string | null
          suggested_action: string | null
          title: string
          updated_at: string
        }
        Insert: {
          anomaly_type: string
          confidence?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata_json?: Json | null
          payslip_id: string
          severity: string
          status?: string | null
          suggested_action?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          anomaly_type?: string
          confidence?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata_json?: Json | null
          payslip_id?: string
          severity?: string
          status?: string | null
          suggested_action?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_results_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          metadata_json: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          metadata_json?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          metadata_json?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      billing_subscriptions: {
        Row: {
          created_at: string
          id: string
          plan: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employers: {
        Row: {
          created_at: string
          id: string
          name: string
          payroll_email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          payroll_email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          payroll_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      issue_drafts: {
        Row: {
          body: string | null
          created_at: string
          employer_id: string | null
          id: string
          payslip_id: string | null
          status: string | null
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          employer_id?: string | null
          id?: string
          payslip_id?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          employer_id?: string | null
          id?: string
          payslip_id?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_drafts_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_drafts_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_extractions: {
        Row: {
          bonus_amount: number | null
          confidence_score: number | null
          created_at: string
          extraction_status: string | null
          gross_pay: number | null
          id: string
          national_insurance_amount: number | null
          net_pay: number | null
          normalized_json: Json | null
          overtime_amount: number | null
          payslip_id: string
          pension_amount: number | null
          prsi_amount: number | null
          raw_extraction_json: Json | null
          student_loan_amount: number | null
          tax_amount: number | null
          taxable_pay: number | null
          total_deductions: number | null
          updated_at: string
          usc_amount: number | null
          year_to_date_json: Json | null
        }
        Insert: {
          bonus_amount?: number | null
          confidence_score?: number | null
          created_at?: string
          extraction_status?: string | null
          gross_pay?: number | null
          id?: string
          national_insurance_amount?: number | null
          net_pay?: number | null
          normalized_json?: Json | null
          overtime_amount?: number | null
          payslip_id: string
          pension_amount?: number | null
          prsi_amount?: number | null
          raw_extraction_json?: Json | null
          student_loan_amount?: number | null
          tax_amount?: number | null
          taxable_pay?: number | null
          total_deductions?: number | null
          updated_at?: string
          usc_amount?: number | null
          year_to_date_json?: Json | null
        }
        Update: {
          bonus_amount?: number | null
          confidence_score?: number | null
          created_at?: string
          extraction_status?: string | null
          gross_pay?: number | null
          id?: string
          national_insurance_amount?: number | null
          net_pay?: number | null
          normalized_json?: Json | null
          overtime_amount?: number | null
          payslip_id?: string
          pension_amount?: number | null
          prsi_amount?: number | null
          raw_extraction_json?: Json | null
          student_loan_amount?: number | null
          tax_amount?: number | null
          taxable_pay?: number | null
          total_deductions?: number | null
          updated_at?: string
          usc_amount?: number | null
          year_to_date_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payslip_extractions_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          country: string | null
          created_at: string
          employer_id: string | null
          file_name: string | null
          file_path: string | null
          id: string
          pay_date: string | null
          pay_period_end: string | null
          pay_period_start: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          employer_id?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          pay_date?: string | null
          pay_period_end?: string | null
          pay_period_start?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          employer_id?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          pay_date?: string | null
          pay_period_end?: string | null
          pay_period_start?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          annual_salary: number | null
          country: string | null
          created_at: string
          currency: string | null
          employer_name: string | null
          first_name: string | null
          has_benefits: boolean | null
          has_bonus: boolean | null
          has_pension: boolean | null
          has_student_loan: boolean | null
          id: string
          onboarding_complete: boolean | null
          pay_frequency: string | null
          payroll_email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_salary?: number | null
          country?: string | null
          created_at?: string
          currency?: string | null
          employer_name?: string | null
          first_name?: string | null
          has_benefits?: boolean | null
          has_bonus?: boolean | null
          has_pension?: boolean | null
          has_student_loan?: boolean | null
          id?: string
          onboarding_complete?: boolean | null
          pay_frequency?: string | null
          payroll_email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_salary?: number | null
          country?: string | null
          created_at?: string
          currency?: string | null
          employer_name?: string | null
          first_name?: string | null
          has_benefits?: boolean | null
          has_bonus?: boolean | null
          has_pension?: boolean | null
          has_student_loan?: boolean | null
          id?: string
          onboarding_complete?: boolean | null
          pay_frequency?: string | null
          payroll_email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notes: {
        Row: {
          anomaly_id: string | null
          created_at: string
          id: string
          note: string
          payslip_id: string | null
          user_id: string
        }
        Insert: {
          anomaly_id?: string | null
          created_at?: string
          id?: string
          note: string
          payslip_id?: string | null
          user_id: string
        }
        Update: {
          anomaly_id?: string | null
          created_at?: string
          id?: string
          note?: string
          payslip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notes_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "anomaly_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notes_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
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
