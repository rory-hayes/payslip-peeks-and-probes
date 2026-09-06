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
      account_deletion_billing_approvals: {
        Row: {
          approval_code: string
          approved_by: string
          created_at: string
          deletion_job_id: string
          id: string
          outcome: string
          subject_user_id: string
        }
        Insert: {
          approval_code: string
          approved_by: string
          created_at?: string
          deletion_job_id: string
          id?: string
          outcome: string
          subject_user_id: string
        }
        Update: {
          approval_code?: string
          approved_by?: string
          created_at?: string
          deletion_job_id?: string
          id?: string
          outcome?: string
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_billing_approvals_deletion_job_id_fkey"
            columns: ["deletion_job_id"]
            isOneToOne: false
            referencedRelation: "account_deletion_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      account_deletion_billing_reviews: {
        Row: {
          checkout_intent_id: string
          checkout_mode: string
          created_at: string
          deletion_job_id: string | null
          environment: string
          id: string
          last_event_type: string | null
          last_stripe_event_id: string | null
          price_lookup_key: string
          remote_status: string | null
          resolution_code: string | null
          resolved_at: string | null
          resolved_by: string | null
          state: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          subject_user_id: string
          updated_at: string
        }
        Insert: {
          checkout_intent_id: string
          checkout_mode: string
          created_at?: string
          deletion_job_id?: string | null
          environment: string
          id?: string
          last_event_type?: string | null
          last_stripe_event_id?: string | null
          price_lookup_key: string
          remote_status?: string | null
          resolution_code?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          state?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          subject_user_id: string
          updated_at?: string
        }
        Update: {
          checkout_intent_id?: string
          checkout_mode?: string
          created_at?: string
          deletion_job_id?: string | null
          environment?: string
          id?: string
          last_event_type?: string | null
          last_stripe_event_id?: string | null
          price_lookup_key?: string
          remote_status?: string | null
          resolution_code?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          state?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          subject_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_billing_reviews_deletion_job_id_fkey"
            columns: ["deletion_job_id"]
            isOneToOne: false
            referencedRelation: "account_deletion_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      account_deletion_jobs: {
        Row: {
          attempt_count: number
          auth_removal_lease_token: string | null
          auth_removal_prepared_at: string | null
          auth_removal_state: string
          auth_removed_at: string | null
          billing_reconciliation_state: string
          completed_at: string | null
          created_at: string
          id: string
          lease_expires_at: string | null
          lease_token: string | null
          lifecycle_generation: number
          next_attempt_at: string
          request_id: string
          safe_error_code: string | null
          state: string
          subject_user_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempt_count?: number
          auth_removal_lease_token?: string | null
          auth_removal_prepared_at?: string | null
          auth_removal_state?: string
          auth_removed_at?: string | null
          billing_reconciliation_state?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          lease_expires_at?: string | null
          lease_token?: string | null
          lifecycle_generation: number
          next_attempt_at?: string
          request_id: string
          safe_error_code?: string | null
          state?: string
          subject_user_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempt_count?: number
          auth_removal_lease_token?: string | null
          auth_removal_prepared_at?: string | null
          auth_removal_state?: string
          auth_removed_at?: string | null
          billing_reconciliation_state?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          lease_expires_at?: string | null
          lease_token?: string | null
          lifecycle_generation?: number
          next_attempt_at?: string
          request_id?: string
          safe_error_code?: string | null
          state?: string
          subject_user_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      account_lifecycle: {
        Row: {
          deletion_request_id: string | null
          generation: number
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          deletion_request_id?: string | null
          generation?: number
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          deletion_request_id?: string | null
          generation?: number
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      anomaly_results: {
        Row: {
          anomaly_type: string
          confidence: string | null
          created_at: string
          description: string | null
          id: string
          metadata_json: Json | null
          payslip_id: string
          review_checks_revision: number
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
          review_checks_revision?: number
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
          review_checks_revision?: number
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
      checkout_intents: {
        Row: {
          checkout_mode: string
          created_at: string
          customer_email: string | null
          environment: string
          expires_at: string
          id: string
          price_lookup_key: string
          state: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_price_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checkout_mode: string
          created_at?: string
          customer_email?: string | null
          environment: string
          expires_at?: string
          id?: string
          price_lookup_key: string
          state?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_price_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checkout_mode?: string
          created_at?: string
          customer_email?: string | null
          environment?: string
          expires_at?: string
          id?: string
          price_lookup_key?: string
          state?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_price_id?: string
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
      payday_plan_allocations: {
        Row: {
          amount: number
          category: string
          created_at: string
          id: string
          plan_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          id?: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payday_plan_allocations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payday_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payday_plans: {
        Row: {
          created_at: string
          currency: string
          everyday_checked_in_at: string | null
          everyday_remaining: number | null
          id: string
          net_pay: number
          next_payday: string
          pay_date: string
          payslip_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          everyday_checked_in_at?: string | null
          everyday_remaining?: number | null
          id?: string
          net_pay: number
          next_payday: string
          pay_date: string
          payslip_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          everyday_checked_in_at?: string | null
          everyday_remaining?: number | null
          id?: string
          net_pay?: number
          next_payday?: string
          pay_date?: string
          payslip_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payday_plans_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_check_reservations: {
        Row: {
          created_at: string
          id: string
          payslip_id: string | null
          period: string
          provider_started_at: string | null
          tier_at_reservation: string
          upload_session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payslip_id?: string | null
          period: string
          provider_started_at?: string | null
          tier_at_reservation?: string
          upload_session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payslip_id?: string | null
          period?: string
          provider_started_at?: string | null
          tier_at_reservation?: string
          upload_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslip_check_reservations_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_check_reservations_upload_session_id_fkey"
            columns: ["upload_session_id"]
            isOneToOne: false
            referencedRelation: "payslip_upload_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_extractions: {
        Row: {
          bonus_amount: number | null
          church_tax_amount: number | null
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
          processing_token: string | null
          prsi_amount: number | null
          raw_extraction_json: Json | null
          social_security_amount: number | null
          solidarity_amount: number | null
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
          church_tax_amount?: number | null
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
          processing_token?: string | null
          prsi_amount?: number | null
          raw_extraction_json?: Json | null
          social_security_amount?: number | null
          solidarity_amount?: number | null
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
          church_tax_amount?: number | null
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
          processing_token?: string | null
          prsi_amount?: number | null
          raw_extraction_json?: Json | null
          social_security_amount?: number | null
          solidarity_amount?: number | null
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
      payslip_original_link_leases: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          object_path: string
          payslip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          object_path: string
          payslip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          object_path?: string
          payslip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslip_original_link_leases_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_upload_sessions: {
        Row: {
          actual_bytes: number | null
          created_at: string
          detected_mime_type: string | null
          display_file_name: string
          ended_at: string | null
          expires_at: string
          finalized_at: string | null
          id: string
          object_path: string
          payslip_id: string | null
          state: string
          user_id: string
        }
        Insert: {
          actual_bytes?: number | null
          created_at?: string
          detected_mime_type?: string | null
          display_file_name: string
          ended_at?: string | null
          expires_at: string
          finalized_at?: string | null
          id?: string
          object_path: string
          payslip_id?: string | null
          state?: string
          user_id: string
        }
        Update: {
          actual_bytes?: number | null
          created_at?: string
          detected_mime_type?: string | null
          display_file_name?: string
          ended_at?: string | null
          expires_at?: string
          finalized_at?: string | null
          id?: string
          object_path?: string
          payslip_id?: string | null
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslip_upload_sessions_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          cleanup_requested_at: string | null
          country: string | null
          created_at: string
          employer_id: string | null
          file_name: string | null
          file_path: string | null
          id: string
          pay_date: string | null
          pay_period_end: string | null
          pay_period_start: string | null
          processing_attempts: number
          processing_failure_code: string | null
          processing_finished_at: string | null
          processing_started_at: string | null
          processing_token: string | null
          provider_started_at: string | null
          review_checks_failure_code: string | null
          review_checks_revision: number
          review_checks_status: string
          review_checks_updated_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          cleanup_requested_at?: string | null
          country?: string | null
          created_at?: string
          employer_id?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          pay_date?: string | null
          pay_period_end?: string | null
          pay_period_start?: string | null
          processing_attempts?: number
          processing_failure_code?: string | null
          processing_finished_at?: string | null
          processing_started_at?: string | null
          processing_token?: string | null
          provider_started_at?: string | null
          review_checks_failure_code?: string | null
          review_checks_revision?: number
          review_checks_status?: string
          review_checks_updated_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          cleanup_requested_at?: string | null
          country?: string | null
          created_at?: string
          employer_id?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          pay_date?: string | null
          pay_period_end?: string | null
          pay_period_start?: string | null
          processing_attempts?: number
          processing_failure_code?: string | null
          processing_finished_at?: string | null
          processing_started_at?: string | null
          processing_token?: string | null
          provider_started_at?: string | null
          review_checks_failure_code?: string | null
          review_checks_revision?: number
          review_checks_status?: string
          review_checks_updated_at?: string | null
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
          anomaly_threshold_percent: number
          country: string | null
          created_at: string
          currency: string | null
          employer_name: string | null
          filing_status: string | null
          first_name: string | null
          has_benefits: boolean | null
          has_bonus: boolean | null
          has_pension: boolean | null
          has_student_loan: boolean | null
          id: string
          onboarding_complete: boolean | null
          pay_frequency: string | null
          payroll_email: string | null
          pension_percent: number | null
          student_loan_plan: string | null
          sub_region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_salary?: number | null
          anomaly_threshold_percent?: number
          country?: string | null
          created_at?: string
          currency?: string | null
          employer_name?: string | null
          filing_status?: string | null
          first_name?: string | null
          has_benefits?: boolean | null
          has_bonus?: boolean | null
          has_pension?: boolean | null
          has_student_loan?: boolean | null
          id?: string
          onboarding_complete?: boolean | null
          pay_frequency?: string | null
          payroll_email?: string | null
          pension_percent?: number | null
          student_loan_plan?: string | null
          sub_region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_salary?: number | null
          anomaly_threshold_percent?: number
          country?: string | null
          created_at?: string
          currency?: string | null
          employer_name?: string | null
          filing_status?: string | null
          first_name?: string | null
          has_benefits?: boolean | null
          has_bonus?: boolean | null
          has_pension?: boolean | null
          has_student_loan?: boolean | null
          id?: string
          onboarding_complete?: boolean | null
          pay_frequency?: string | null
          payroll_email?: string | null
          pension_percent?: number | null
          student_loan_plan?: string | null
          sub_region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket_key: string
          count: number
          created_at: string
          id: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          created_at?: string
          id?: string
          window_start?: string
        }
        Update: {
          bucket_key?: string
          count?: number
          created_at?: string
          id?: string
          window_start?: string
        }
        Relationships: []
      }
      recurring_bills: {
        Row: {
          amount: number
          created_at: string
          due_day: number | null
          frequency: string
          id: string
          is_active: boolean
          is_essential: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_day?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          is_essential?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_day?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          is_essential?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          created_at: string
          currency: string
          current_amount: number
          id: string
          is_primary: boolean
          name: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          current_amount?: number
          id?: string
          is_primary?: boolean
          name: string
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_amount?: number
          id?: string
          is_primary?: boolean
          name?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
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
      acquire_checkout_intent: {
        Args: {
          p_checkout_mode: string
          p_customer_email?: string
          p_environment: string
          p_price_lookup_key: string
          p_stripe_price_id: string
          p_user_id: string
        }
        Returns: {
          checkout_mode: string
          customer_email: string
          environment: string
          expires_at: string
          id: string
          price_lookup_key: string
          state: string
          stripe_checkout_session_id: string
          stripe_price_id: string
          user_id: string
        }[]
      }
      acquire_secure_checkout_intent: {
        Args: {
          p_checkout_mode: string
          p_customer_email?: string
          p_environment: string
          p_price_lookup_key: string
          p_stripe_price_id: string
          p_user_id: string
        }
        Returns: {
          checkout_mode: string
          customer_email: string
          environment: string
          expires_at: string
          id: string
          price_lookup_key: string
          state: string
          stripe_checkout_session_id: string
          stripe_price_id: string
          user_id: string
        }[]
      }
      activate_secure_payslip_original_link_lease: {
        Args: {
          p_lease_id: string
          p_lease_seconds: number
          p_object_path: string
          p_payslip_id: string
          p_user_id: string
        }
        Returns: Json
      }
      approve_and_resume_account_deletion_after_billing_review: {
        Args: {
          p_approval_code: string
          p_approved_by: string
          p_job_id: string
        }
        Returns: string
      }
      assert_account_deletion_billing_ready: {
        Args: { p_job_id: string; p_lease_token: string }
        Returns: string
      }
      begin_account_deletion_request: {
        Args: { p_user_id: string }
        Returns: Json
      }
      begin_manual_payslip_review: {
        Args: { p_payslip_id: string }
        Returns: undefined
      }
      begin_payslip_upload_session: {
        Args: {
          p_display_file_name: string
          p_environment: string
          p_user_id: string
        }
        Returns: Json
      }
      begin_secure_payslip_upload_session: {
        Args: {
          p_display_file_name: string
          p_environment: string
          p_user_id: string
        }
        Returns: Json
      }
      bind_secure_stripe_checkout_session: {
        Args: {
          p_checkout_mode: string
          p_environment: string
          p_expires_at?: string
          p_intent_id: string
          p_price_lookup_key: string
          p_session_id: string
          p_user_id: string
        }
        Returns: string
      }
      claim_account_deletion_job: {
        Args: { p_job_id: string; p_lease_seconds?: number }
        Returns: Json
      }
      claim_payslip_processing: {
        Args: { p_payslip_id: string; p_user_id: string }
        Returns: boolean
      }
      complete_account_deletion_job: {
        Args: { p_job_id: string; p_lease_token: string }
        Returns: boolean
      }
      complete_payslip_upload_session_expiry: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      confirm_account_deletion_auth_removal: {
        Args: { p_job_id: string; p_lease_token: string }
        Returns: string
      }
      confirm_payslip_review: {
        Args: {
          p_country?: string
          p_document_context?: Json
          p_gross_pay: number
          p_line_items?: Json
          p_national_insurance_amount: number
          p_net_pay: number
          p_pay_date: string
          p_payslip_id: string
          p_pension_amount: number
          p_prsi_amount: number
          p_tax_amount: number
          p_total_deductions: number
          p_usc_amount: number
          p_year_to_date?: Json
        }
        Returns: undefined
      }
      confirm_payslip_review_core: {
        Args: {
          p_country?: string
          p_gross_pay: number
          p_line_items?: Json
          p_national_insurance_amount: number
          p_net_pay: number
          p_pay_date: string
          p_payslip_id: string
          p_pension_amount: number
          p_prsi_amount: number
          p_tax_amount: number
          p_total_deductions: number
          p_usc_amount: number
        }
        Returns: undefined
      }
      consume_rate_limit: {
        Args: {
          p_bucket_key: string
          p_max_per_window: number
          p_window_start: string
        }
        Returns: {
          allowed: boolean
          current_count: number
        }[]
      }
      create_issue_draft: {
        Args: {
          p_body: string
          p_environment: string
          p_payslip_id: string
          p_subject: string
          p_user_id: string
        }
        Returns: {
          body: string
          id: string
          subject: string
        }[]
      }
      delete_failed_payslip: {
        Args: { p_payslip_id: string }
        Returns: undefined
      }
      delete_failed_payslip_after_storage_cleanup: {
        Args: { p_payslip_id: string; p_user_id: string }
        Returns: Json
      }
      drain_secure_account_deletion_processing: {
        Args: { p_user_id: string }
        Returns: Json
      }
      fail_payslip_processing: {
        Args: {
          p_failure_code: string
          p_payslip_id: string
          p_processing_token: string
          p_release_unstarted_reservation?: boolean
          p_user_id: string
        }
        Returns: boolean
      }
      finalize_payslip_upload_session: {
        Args: {
          p_actual_bytes: number
          p_detected_mime_type: string
          p_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      finalize_secure_payslip_upload_session: {
        Args: {
          p_actual_bytes: number
          p_detected_mime_type: string
          p_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      grant_lifetime_entitlement: {
        Args: {
          p_customer_id: string
          p_environment: string
          p_intent_id: string
          p_price_id: string
          p_product_id: string
          p_session_id: string
          p_user_id: string
        }
        Returns: string
      }
      grant_secure_lifetime_entitlement: {
        Args: {
          p_customer_id: string
          p_environment: string
          p_intent_id: string
          p_price_id: string
          p_product_id: string
          p_session_id: string
          p_user_id: string
        }
        Returns: string
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      is_account_lifecycle_active: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      list_expired_payslip_upload_sessions: {
        Args: { p_limit?: number; p_user_id?: string }
        Returns: {
          object_path: string
          session_id: string
          user_id: string
        }[]
      }
      list_expired_secure_failed_payslip_cleanups_without_session: {
        Args: { p_limit?: number }
        Returns: {
          object_path: string
          payslip_id: string
          user_id: string
        }[]
      }
      list_expired_secure_payslip_upload_sessions: {
        Args: { p_limit?: number; p_user_id?: string }
        Returns: {
          object_path: string
          session_id: string
          user_id: string
        }[]
      }
      mark_payslip_provider_started: {
        Args: {
          p_payslip_id: string
          p_processing_token: string
          p_user_id: string
        }
        Returns: boolean
      }
      mark_secure_payslip_provider_started: {
        Args: {
          p_payslip_id: string
          p_processing_token: string
          p_user_id: string
        }
        Returns: boolean
      }
      prepare_account_deletion_auth_removal: {
        Args: { p_job_id: string; p_lease_token: string }
        Returns: string
      }
      prune_expired_payslip_original_link_leases: {
        Args: { p_limit?: number }
        Returns: number
      }
      record_account_deletion_auth_removed: {
        Args: { p_job_id: string; p_lease_token: string }
        Returns: string
      }
      record_account_deletion_billing_review: {
        Args: {
          p_checkout_intent_id: string
          p_checkout_mode: string
          p_environment: string
          p_event_type?: string
          p_price_lookup_key: string
          p_remote_status?: string
          p_stripe_checkout_session_id?: string
          p_stripe_customer_id?: string
          p_stripe_event_id?: string
          p_stripe_payment_intent_id?: string
          p_stripe_subscription_id?: string
          p_subject_user_id: string
        }
        Returns: string
      }
      record_lifetime_payment_intent: {
        Args: {
          p_environment: string
          p_intent_id: string
          p_payment_intent_id: string
          p_session_id: string
          p_user_id: string
        }
        Returns: string
      }
      record_secure_lifetime_payment_intent: {
        Args: {
          p_environment: string
          p_intent_id: string
          p_payment_intent_id: string
          p_session_id: string
          p_user_id: string
        }
        Returns: string
      }
      record_secure_lifetime_payment_intent_with_reconciliation: {
        Args: {
          p_environment: string
          p_intent_id: string
          p_payment_intent_id: string
          p_price_lookup_key: string
          p_session_id: string
          p_user_id: string
        }
        Returns: string
      }
      renew_account_deletion_job_lease: {
        Args: {
          p_job_id: string
          p_lease_seconds?: number
          p_lease_token: string
        }
        Returns: boolean
      }
      replace_reviewed_payslip_anomalies: {
        Args: {
          p_anomalies: Json
          p_payslip_id: string
          p_review_checks_revision: number
          p_user_id: string
        }
        Returns: number
      }
      request_failed_payslip_cleanup: {
        Args: { p_payslip_id: string; p_user_id: string }
        Returns: Json
      }
      request_payslip_upload_session_cleanup: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: Json
      }
      reschedule_account_deletion_job: {
        Args: {
          p_job_id: string
          p_lease_token: string
          p_manual_review?: boolean
          p_next_attempt_at: string
          p_safe_error_code?: string
        }
        Returns: boolean
      }
      reserve_and_claim_payslip_processing: {
        Args: { p_environment: string; p_payslip_id: string; p_user_id: string }
        Returns: Json
      }
      reserve_and_claim_secure_payslip_processing: {
        Args: { p_environment: string; p_payslip_id: string; p_user_id: string }
        Returns: Json
      }
      reserve_secure_payslip_original_link_lease: {
        Args: {
          p_lease_seconds: number
          p_object_path: string
          p_payslip_id: string
          p_user_id: string
        }
        Returns: Json
      }
      resolve_account_deletion_billing_review: {
        Args: {
          p_resolution_code: string
          p_resolved_by: string
          p_review_id: string
        }
        Returns: boolean
      }
      revoke_lifetime_entitlement: {
        Args: {
          p_environment: string
          p_intent_id: string
          p_payment_intent_id: string
          p_session_id: string
          p_user_id: string
        }
        Returns: string
      }
      save_payday_check_in: {
        Args: { p_everyday_remaining: number; p_plan_id: string }
        Returns: {
          created_at: string
          currency: string
          everyday_checked_in_at: string | null
          everyday_remaining: number | null
          id: string
          net_pay: number
          next_payday: string
          pay_date: string
          payslip_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payday_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_payday_plan: {
        Args: {
          p_buffer: number
          p_essential_bills: number
          p_everyday_spending: number
          p_next_payday: string
          p_payslip_id: string
        }
        Returns: {
          created_at: string
          currency: string
          everyday_checked_in_at: string | null
          everyday_remaining: number | null
          id: string
          net_pay: number
          next_payday: string
          pay_date: string
          payslip_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payday_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      settle_expired_secure_payslip_upload_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      upsert_secure_stripe_subscription:
        | {
            Args: {
              p_cancel_at_period_end: boolean
              p_current_period_end: string
              p_current_period_start: string
              p_environment: string
              p_price_id: string
              p_product_id: string
              p_status: string
              p_stripe_customer_id: string
              p_stripe_subscription_id: string
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_cancel_at_period_end: boolean
              p_checkout_intent_id: string
              p_current_period_end: string
              p_current_period_start: string
              p_environment: string
              p_price_id: string
              p_product_id: string
              p_status: string
              p_stripe_checkout_session_id: string
              p_stripe_customer_id: string
              p_stripe_subscription_id: string
              p_user_id: string
            }
            Returns: string
          }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
