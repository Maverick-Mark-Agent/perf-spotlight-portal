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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_errors: {
        Row: {
          context: Json | null
          created_at: string
          error_type: string
          id: number
          message: string
          resolved: boolean | null
          resolved_at: string | null
          retry_count: number | null
          run_id: string | null
          screenshot_url: string | null
          stack_trace: string | null
          step: string
          trace_url: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_type: string
          id?: number
          message: string
          resolved?: boolean | null
          resolved_at?: string | null
          retry_count?: number | null
          run_id?: string | null
          screenshot_url?: string | null
          stack_trace?: string | null
          step: string
          trace_url?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_type?: string
          id?: number
          message?: string
          resolved?: boolean | null
          resolved_at?: string | null
          retry_count?: number | null
          run_id?: string | null
          screenshot_url?: string | null
          stack_trace?: string | null
          step?: string
          trace_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_errors_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          client_id: number | null
          created_at: string
          error: string | null
          finished_at: string | null
          metrics: Json | null
          run_id: string
          site: string | null
          started_at: string
          status: string
          trace_url: string | null
          updated_at: string
          workflow: string
        }
        Insert: {
          client_id?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          metrics?: Json | null
          run_id?: string
          site?: string | null
          started_at?: string
          status?: string
          trace_url?: string | null
          updated_at?: string
          workflow: string
        }
        Update: {
          client_id?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          metrics?: Json | null
          run_id?: string
          site?: string | null
          started_at?: string
          status?: string
          trace_url?: string | null
          updated_at?: string
          workflow?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          account_id: string | null
          ai_confidence: string | null
          amount: number
          category_id: string | null
          created_at: string | null
          date: string
          datetime: string | null
          expense_id: string | null
          id: string
          is_pending: boolean | null
          is_recurring: boolean | null
          merchant_entity_id: string | null
          merchant_name: string | null
          name: string | null
          payment_channel: string | null
          personal_finance_category: string | null
          plaid_category: string[] | null
          plaid_category_id: string | null
          recurring_name: string | null
          recurring_type: string | null
          status: string | null
          transaction_id: string
          transaction_type: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          account_id?: string | null
          ai_confidence?: string | null
          amount: number
          category_id?: string | null
          created_at?: string | null
          date: string
          datetime?: string | null
          expense_id?: string | null
          id?: string
          is_pending?: boolean | null
          is_recurring?: boolean | null
          merchant_entity_id?: string | null
          merchant_name?: string | null
          name?: string | null
          payment_channel?: string | null
          personal_finance_category?: string | null
          plaid_category?: string[] | null
          plaid_category_id?: string | null
          recurring_name?: string | null
          recurring_type?: string | null
          status?: string | null
          transaction_id: string
          transaction_type?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          account_id?: string | null
          ai_confidence?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string | null
          date?: string
          datetime?: string | null
          expense_id?: string | null
          id?: string
          is_pending?: boolean | null
          is_recurring?: boolean | null
          merchant_entity_id?: string | null
          merchant_name?: string | null
          name?: string | null
          payment_channel?: string | null
          personal_finance_category?: string | null
          plaid_category?: string[] | null
          plaid_category_id?: string | null
          recurring_name?: string | null
          recurring_type?: string | null
          status?: string | null
          transaction_id?: string
          transaction_type?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "plaid_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_lead_assignments: {
        Row: {
          assigned_at: string
          batch_id: number | null
          cleaned_lead_id: number | null
          id: number
          uploaded_at: string | null
          uploaded_to_bison: boolean | null
        }
        Insert: {
          assigned_at?: string
          batch_id?: number | null
          cleaned_lead_id?: number | null
          id?: number
          uploaded_at?: string | null
          uploaded_to_bison?: boolean | null
        }
        Update: {
          assigned_at?: string
          batch_id?: number | null
          cleaned_lead_id?: number | null
          id?: number
          uploaded_at?: string | null
          uploaded_to_bison?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_lead_assignments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "client_lead_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_lead_assignments_cleaned_lead_id_fkey"
            columns: ["cleaned_lead_id"]
            isOneToOne: false
            referencedRelation: "cleaned_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_targets: {
        Row: {
          budget_amount: number
          category_id: string | null
          created_at: string | null
          id: string
          month_year: string
          notes: string | null
          updated_at: string | null
          warning_threshold: number | null
        }
        Insert: {
          budget_amount: number
          category_id?: string | null
          created_at?: string | null
          id?: string
          month_year: string
          notes?: string | null
          updated_at?: string | null
          warning_threshold?: number | null
        }
        Update: {
          budget_amount?: number
          category_id?: string | null
          created_at?: string | null
          id?: string
          month_year?: string
          notes?: string | null
          updated_at?: string | null
          warning_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_targets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profile: {
        Row: {
          ai_bookkeeping_notes: string | null
          ai_learned_patterns: Json | null
          ai_tax_notes: string | null
          business_description: string | null
          business_model: string | null
          business_name: string | null
          business_type: string | null
          common_expense_types: string[] | null
          created_at: string | null
          entity_type: string | null
          estimated_annual_revenue: number | null
          estimated_tax_bracket: number | null
          expense_approval_threshold: number | null
          fiscal_year_start: number | null
          id: string
          industry: string | null
          key_vendors: string[] | null
          receipt_required_threshold: number | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          ai_bookkeeping_notes?: string | null
          ai_learned_patterns?: Json | null
          ai_tax_notes?: string | null
          business_description?: string | null
          business_model?: string | null
          business_name?: string | null
          business_type?: string | null
          common_expense_types?: string[] | null
          created_at?: string | null
          entity_type?: string | null
          estimated_annual_revenue?: number | null
          estimated_tax_bracket?: number | null
          expense_approval_threshold?: number | null
          fiscal_year_start?: number | null
          id?: string
          industry?: string | null
          key_vendors?: string[] | null
          receipt_required_threshold?: number | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_bookkeeping_notes?: string | null
          ai_learned_patterns?: Json | null
          ai_tax_notes?: string | null
          business_description?: string | null
          business_model?: string | null
          business_name?: string | null
          business_type?: string | null
          common_expense_types?: string[] | null
          created_at?: string | null
          entity_type?: string | null
          estimated_annual_revenue?: number | null
          estimated_tax_bracket?: number | null
          expense_approval_threshold?: number | null
          fiscal_year_start?: number | null
          id?: string
          industry?: string | null
          key_vendors?: string[] | null
          receipt_required_threshold?: number | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          airtable_record_id: string | null
          campaign_name: string
          created_at: string | null
          emails_scheduled_today: number | null
          emails_scheduled_tomorrow: number | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          workspace_name: string
        }
        Insert: {
          airtable_record_id?: string | null
          campaign_name: string
          created_at?: string | null
          emails_scheduled_today?: number | null
          emails_scheduled_tomorrow?: number | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          workspace_name: string
        }
        Update: {
          airtable_record_id?: string | null
          campaign_name?: string
          created_at?: string | null
          emails_scheduled_today?: number | null
          emails_scheduled_tomorrow?: number | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_name"]
          },
          {
            foreignKeyName: "campaigns_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_zip_progress"
            referencedColumns: ["workspace_name"]
          },
        ]
      }
      cleaned_leads: {
        Row: {
          address_1: string | null
          agent_run_id: string | null
          city: string | null
          created_at: string
          dedupe_key: string
          dob: string | null
          email: string | null
          email_valid: boolean | null
          email_validation_provider: string | null
          first_name: string | null
          first_safe_to_send_email: string | null
          head_household: boolean | null
          home_value: number | null
          id: number
          income: number | null
          last_name: string | null
          phone: string | null
          purchase_date: string | null
          purchase_day: number | null
          raw_lead_id: number | null
          readable_purchase_date: string | null
          renewal_date: string | null
          state: string | null
          updated_at: string
          validation_errors: Json | null
          validation_status: string | null
          zip: string | null
        }
        Insert: {
          address_1?: string | null
          agent_run_id?: string | null
          city?: string | null
          created_at?: string
          dedupe_key: string
          dob?: string | null
          email?: string | null
          email_valid?: boolean | null
          email_validation_provider?: string | null
          first_name?: string | null
          first_safe_to_send_email?: string | null
          head_household?: boolean | null
          home_value?: number | null
          id?: number
          income?: number | null
          last_name?: string | null
          phone?: string | null
          purchase_date?: string | null
          purchase_day?: number | null
          raw_lead_id?: number | null
          readable_purchase_date?: string | null
          renewal_date?: string | null
          state?: string | null
          updated_at?: string
          validation_errors?: Json | null
          validation_status?: string | null
          zip?: string | null
        }
        Update: {
          address_1?: string | null
          agent_run_id?: string | null
          city?: string | null
          created_at?: string
          dedupe_key?: string
          dob?: string | null
          email?: string | null
          email_valid?: boolean | null
          email_validation_provider?: string | null
          first_name?: string | null
          first_safe_to_send_email?: string | null
          head_household?: boolean | null
          home_value?: number | null
          id?: number
          income?: number | null
          last_name?: string | null
          phone?: string | null
          purchase_date?: string | null
          purchase_day?: number | null
          raw_lead_id?: number | null
          readable_purchase_date?: string | null
          renewal_date?: string | null
          state?: string | null
          updated_at?: string
          validation_errors?: Json | null
          validation_status?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaned_leads_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "cleaned_leads_raw_lead_id_fkey"
            columns: ["raw_lead_id"]
            isOneToOne: false
            referencedRelation: "raw_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_costs: {
        Row: {
          created_at: string
          email_account_costs: number | null
          id: string
          labor_costs: number | null
          month_year: string
          notes: string | null
          other_costs: number | null
          total_costs: number | null
          updated_at: string
          workspace_name: string
        }
        Insert: {
          created_at?: string
          email_account_costs?: number | null
          id?: string
          labor_costs?: number | null
          month_year: string
          notes?: string | null
          other_costs?: number | null
          total_costs?: number | null
          updated_at?: string
          workspace_name: string
        }
        Update: {
          created_at?: string
          email_account_costs?: number | null
          id?: string
          labor_costs?: number | null
          month_year?: string
          notes?: string | null
          other_costs?: number | null
          total_costs?: number | null
          updated_at?: string
          workspace_name?: string
        }
        Relationships: []
      }
      client_lead_batches: {
        Row: {
          bison_list_name: string | null
          client_id: number | null
          count_cleaned: number | null
          count_raw: number | null
          count_uploaded: number | null
          created_at: string
          id: number
          month: string
          status: string | null
          updated_at: string
          upload_target: number
          uploaded_at: string | null
          week_window_end: string
          week_window_start: string
        }
        Insert: {
          bison_list_name?: string | null
          client_id?: number | null
          count_cleaned?: number | null
          count_raw?: number | null
          count_uploaded?: number | null
          created_at?: string
          id?: number
          month: string
          status?: string | null
          updated_at?: string
          upload_target: number
          uploaded_at?: string | null
          week_window_end: string
          week_window_start: string
        }
        Update: {
          bison_list_name?: string | null
          client_id?: number | null
          count_cleaned?: number | null
          count_raw?: number | null
          count_uploaded?: number | null
          created_at?: string
          id?: number
          month?: string
          status?: string | null
          updated_at?: string
          upload_target?: number
          uploaded_at?: string | null
          week_window_end?: string
          week_window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_lead_batches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      client_leads: {
        Row: {
          address: string | null
          airtable_id: string | null
          assigned_at: string | null
          assigned_by_user_id: string | null
          assigned_to_name: string | null
          assigned_to_user_id: string | null
          birthday: string | null
          bison_conversation_url: string | null
          bison_lead_id: string | null
          bison_reply_id: string | null
          bison_reply_uuid: string | null
          bison_workspace_id: number | null
          campaign_name: string | null
          city: string | null
          client_name: string | null
          company: string | null
          created_at: string
          custom_variables: Json | null
          date_received: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          email_sent: string | null
          email_subject: string | null
          external_api_sent_at: string | null
          first_name: string | null
          icp: boolean | null
          id: string
          interested: boolean | null
          interested_at: string | null
          last_name: string | null
          last_synced_at: string | null
          lead_campaign_data: Json | null
          lead_email: string | null
          lead_status: string | null
          lead_value: number | null
          notes: string | null
          overall_stats: Json | null
          phone: string | null
          pipeline_position: number | null
          pipeline_stage: string | null
          policy_type: string | null
          premium_amount: number | null
          renewal_date: string | null
          reply_received: string | null
          sender_email: string | null
          state: string | null
          tags: Json | null
          title: string | null
          updated_at: string
          workspace_name: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          airtable_id?: string | null
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          assigned_to_name?: string | null
          assigned_to_user_id?: string | null
          birthday?: string | null
          bison_conversation_url?: string | null
          bison_lead_id?: string | null
          bison_reply_id?: string | null
          bison_reply_uuid?: string | null
          bison_workspace_id?: number | null
          campaign_name?: string | null
          city?: string | null
          client_name?: string | null
          company?: string | null
          created_at?: string
          custom_variables?: Json | null
          date_received?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          email_sent?: string | null
          email_subject?: string | null
          external_api_sent_at?: string | null
          first_name?: string | null
          icp?: boolean | null
          id?: string
          interested?: boolean | null
          interested_at?: string | null
          last_name?: string | null
          last_synced_at?: string | null
          lead_campaign_data?: Json | null
          lead_email?: string | null
          lead_status?: string | null
          lead_value?: number | null
          notes?: string | null
          overall_stats?: Json | null
          phone?: string | null
          pipeline_position?: number | null
          pipeline_stage?: string | null
          policy_type?: string | null
          premium_amount?: number | null
          renewal_date?: string | null
          reply_received?: string | null
          sender_email?: string | null
          state?: string | null
          tags?: Json | null
          title?: string | null
          updated_at?: string
          workspace_name: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          airtable_id?: string | null
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          assigned_to_name?: string | null
          assigned_to_user_id?: string | null
          birthday?: string | null
          bison_conversation_url?: string | null
          bison_lead_id?: string | null
          bison_reply_id?: string | null
          bison_reply_uuid?: string | null
          bison_workspace_id?: number | null
          campaign_name?: string | null
          city?: string | null
          client_name?: string | null
          company?: string | null
          created_at?: string
          custom_variables?: Json | null
          date_received?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          email_sent?: string | null
          email_subject?: string | null
          external_api_sent_at?: string | null
          first_name?: string | null
          icp?: boolean | null
          id?: string
          interested?: boolean | null
          interested_at?: string | null
          last_name?: string | null
          last_synced_at?: string | null
          lead_campaign_data?: Json | null
          lead_email?: string | null
          lead_status?: string | null
          lead_value?: number | null
          notes?: string | null
          overall_stats?: Json | null
          phone?: string | null
          pipeline_position?: number | null
          pipeline_stage?: string | null
          policy_type?: string | null
          premium_amount?: number | null
          renewal_date?: string | null
          reply_received?: string | null
          sender_email?: string | null
          state?: string | null
          tags?: Json | null
          title?: string | null
          updated_at?: string
          workspace_name?: string
          zip?: string | null
        }
        Relationships: []
      }
      client_metrics: {
        Row: {
          all_replies_mtd: number | null
          bounced_mtd: number | null
          created_at: string | null
          emails_scheduled_today: number | null
          emails_scheduled_tomorrow: number | null
          emails_sent: number | null
          emails_sent_last_14_days: number | null
          emails_sent_last_30_days: number | null
          emails_sent_last_7_days: number | null
          emails_sent_mtd: number | null
          emails_sent_today: number | null
          id: string
          last_week_vs_week_before_progress: number | null
          metric_date: string
          metric_type: string
          mtd_leads_progress: number | null
          positive_replies: number | null
          positive_replies_current_month: number | null
          positive_replies_last_14_days: number | null
          positive_replies_last_30_days: number | null
          positive_replies_last_7_days: number | null
          positive_replies_last_month: number | null
          positive_replies_mtd: number | null
          projection_emails_eom: number | null
          projection_positive_replies_eom: number | null
          projection_replies_progress: number | null
          unsubscribed_mtd: number | null
          updated_at: string | null
          workspace_name: string
        }
        Insert: {
          all_replies_mtd?: number | null
          bounced_mtd?: number | null
          created_at?: string | null
          emails_scheduled_today?: number | null
          emails_scheduled_tomorrow?: number | null
          emails_sent?: number | null
          emails_sent_last_14_days?: number | null
          emails_sent_last_30_days?: number | null
          emails_sent_last_7_days?: number | null
          emails_sent_mtd?: number | null
          emails_sent_today?: number | null
          id?: string
          last_week_vs_week_before_progress?: number | null
          metric_date: string
          metric_type: string
          mtd_leads_progress?: number | null
          positive_replies?: number | null
          positive_replies_current_month?: number | null
          positive_replies_last_14_days?: number | null
          positive_replies_last_30_days?: number | null
          positive_replies_last_7_days?: number | null
          positive_replies_last_month?: number | null
          positive_replies_mtd?: number | null
          projection_emails_eom?: number | null
          projection_positive_replies_eom?: number | null
          projection_replies_progress?: number | null
          unsubscribed_mtd?: number | null
          updated_at?: string | null
          workspace_name: string
        }
        Update: {
          all_replies_mtd?: number | null
          bounced_mtd?: number | null
          created_at?: string | null
          emails_scheduled_today?: number | null
          emails_scheduled_tomorrow?: number | null
          emails_sent?: number | null
          emails_sent_last_14_days?: number | null
          emails_sent_last_30_days?: number | null
          emails_sent_last_7_days?: number | null
          emails_sent_mtd?: number | null
          emails_sent_today?: number | null
          id?: string
          last_week_vs_week_before_progress?: number | null
          metric_date?: string
          metric_type?: string
          mtd_leads_progress?: number | null
          positive_replies?: number | null
          positive_replies_current_month?: number | null
          positive_replies_last_14_days?: number | null
          positive_replies_last_30_days?: number | null
          positive_replies_last_7_days?: number | null
          positive_replies_last_month?: number | null
          positive_replies_mtd?: number | null
          projection_emails_eom?: number | null
          projection_positive_replies_eom?: number | null
          projection_replies_progress?: number | null
          unsubscribed_mtd?: number | null
          updated_at?: string | null
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_metrics_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_name"]
          },
          {
            foreignKeyName: "client_metrics_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_zip_progress"
            referencedColumns: ["workspace_name"]
          },
        ]
      }
      client_registry: {
        Row: {
          agency_color: string | null
          airtable_record_id: string | null
          airtable_workspace_name: string | null
          api_calls_today: number | null
          api_consecutive_failures: number | null
          api_errors_today: number | null
          api_health_status: string | null
          api_last_failed_call_at: string | null
          api_last_successful_call_at: string | null
          api_notes: string | null
          auto_billing_enabled: boolean | null
          billing_contact_email: string | null
          billing_frequency: string | null
          billing_type: string
          bison_api_key: string | null
          bison_api_key_created_at: string | null
          bison_api_key_last_used_at: string | null
          bison_api_key_name: string | null
          bison_api_key_status: string | null
          bison_instance: string | null
          bison_webhook_enabled: boolean | null
          bison_webhook_events: string[] | null
          bison_webhook_health: string | null
          bison_webhook_last_received_at: string | null
          bison_webhook_secret: string | null
          bison_webhook_url: string | null
          bison_workspace_id: number | null
          bison_workspace_name: string | null
          client_type: string | null
          contact_tier: string | null
          cost_per_lead: number | null
          created_at: string | null
          daily_sending_target: number | null
          debounce_credits_allocated: number | null
          default_avg_deal_size: number | null
          default_commission_rate: number | null
          default_conversion_rate: number | null
          default_customer_ltv: number | null
          disconnect_notifications_enabled: boolean | null
          display_name: string | null
          email_account_costs: number | null
          external_api_token: string | null
          external_api_url: string | null
          hnw_enabled: boolean | null
          is_active: boolean | null
          is_agency: boolean | null
          kpi_calculation_method: string | null
          kpi_dashboard_enabled: boolean | null
          labor_cost_allocation: number | null
          lead_tier: string | null
          live_replies_enabled: boolean | null
          monthly_contact_target: number | null
          monthly_kpi_target: number | null
          monthly_sending_target: number | null
          notes: string | null
          payout: number | null
          portal_access_enabled: boolean | null
          portal_custom_branding: Json | null
          price_per_lead: number | null
          retainer_amount: number | null
          sending_tier: string | null
          slack_webhook_url: string | null
          target_campaign_name: string | null
          territory_states: string[] | null
          updated_at: string | null
          volume_dashboard_enabled: boolean | null
          warmup_phase: boolean | null
          weekly_batch_schedule: number | null
          workspace_id: number
          workspace_name: string
          zip_assignment_type: string | null
        }
        Insert: {
          agency_color?: string | null
          airtable_record_id?: string | null
          airtable_workspace_name?: string | null
          api_calls_today?: number | null
          api_consecutive_failures?: number | null
          api_errors_today?: number | null
          api_health_status?: string | null
          api_last_failed_call_at?: string | null
          api_last_successful_call_at?: string | null
          api_notes?: string | null
          auto_billing_enabled?: boolean | null
          billing_contact_email?: string | null
          billing_frequency?: string | null
          billing_type: string
          bison_api_key?: string | null
          bison_api_key_created_at?: string | null
          bison_api_key_last_used_at?: string | null
          bison_api_key_name?: string | null
          bison_api_key_status?: string | null
          bison_instance?: string | null
          bison_webhook_enabled?: boolean | null
          bison_webhook_events?: string[] | null
          bison_webhook_health?: string | null
          bison_webhook_last_received_at?: string | null
          bison_webhook_secret?: string | null
          bison_webhook_url?: string | null
          bison_workspace_id?: number | null
          bison_workspace_name?: string | null
          client_type?: string | null
          contact_tier?: string | null
          cost_per_lead?: number | null
          created_at?: string | null
          daily_sending_target?: number | null
          debounce_credits_allocated?: number | null
          default_avg_deal_size?: number | null
          default_commission_rate?: number | null
          default_conversion_rate?: number | null
          default_customer_ltv?: number | null
          disconnect_notifications_enabled?: boolean | null
          display_name?: string | null
          email_account_costs?: number | null
          external_api_token?: string | null
          external_api_url?: string | null
          hnw_enabled?: boolean | null
          is_active?: boolean | null
          is_agency?: boolean | null
          kpi_calculation_method?: string | null
          kpi_dashboard_enabled?: boolean | null
          labor_cost_allocation?: number | null
          lead_tier?: string | null
          live_replies_enabled?: boolean | null
          monthly_contact_target?: number | null
          monthly_kpi_target?: number | null
          monthly_sending_target?: number | null
          notes?: string | null
          payout?: number | null
          portal_access_enabled?: boolean | null
          portal_custom_branding?: Json | null
          price_per_lead?: number | null
          retainer_amount?: number | null
          sending_tier?: string | null
          slack_webhook_url?: string | null
          target_campaign_name?: string | null
          territory_states?: string[] | null
          updated_at?: string | null
          volume_dashboard_enabled?: boolean | null
          warmup_phase?: boolean | null
          weekly_batch_schedule?: number | null
          workspace_id: number
          workspace_name: string
          zip_assignment_type?: string | null
        }
        Update: {
          agency_color?: string | null
          airtable_record_id?: string | null
          airtable_workspace_name?: string | null
          api_calls_today?: number | null
          api_consecutive_failures?: number | null
          api_errors_today?: number | null
          api_health_status?: string | null
          api_last_failed_call_at?: string | null
          api_last_successful_call_at?: string | null
          api_notes?: string | null
          auto_billing_enabled?: boolean | null
          billing_contact_email?: string | null
          billing_frequency?: string | null
          billing_type?: string
          bison_api_key?: string | null
          bison_api_key_created_at?: string | null
          bison_api_key_last_used_at?: string | null
          bison_api_key_name?: string | null
          bison_api_key_status?: string | null
          bison_instance?: string | null
          bison_webhook_enabled?: boolean | null
          bison_webhook_events?: string[] | null
          bison_webhook_health?: string | null
          bison_webhook_last_received_at?: string | null
          bison_webhook_secret?: string | null
          bison_webhook_url?: string | null
          bison_workspace_id?: number | null
          bison_workspace_name?: string | null
          client_type?: string | null
          contact_tier?: string | null
          cost_per_lead?: number | null
          created_at?: string | null
          daily_sending_target?: number | null
          debounce_credits_allocated?: number | null
          default_avg_deal_size?: number | null
          default_commission_rate?: number | null
          default_conversion_rate?: number | null
          default_customer_ltv?: number | null
          disconnect_notifications_enabled?: boolean | null
          display_name?: string | null
          email_account_costs?: number | null
          external_api_token?: string | null
          external_api_url?: string | null
          hnw_enabled?: boolean | null
          is_active?: boolean | null
          is_agency?: boolean | null
          kpi_calculation_method?: string | null
          kpi_dashboard_enabled?: boolean | null
          labor_cost_allocation?: number | null
          lead_tier?: string | null
          live_replies_enabled?: boolean | null
          monthly_contact_target?: number | null
          monthly_kpi_target?: number | null
          monthly_sending_target?: number | null
          notes?: string | null
          payout?: number | null
          portal_access_enabled?: boolean | null
          portal_custom_branding?: Json | null
          price_per_lead?: number | null
          retainer_amount?: number | null
          sending_tier?: string | null
          slack_webhook_url?: string | null
          target_campaign_name?: string | null
          territory_states?: string[] | null
          updated_at?: string | null
          volume_dashboard_enabled?: boolean | null
          warmup_phase?: boolean | null
          weekly_batch_schedule?: number | null
          workspace_id?: number
          workspace_name?: string
          zip_assignment_type?: string | null
        }
        Relationships: []
      }
      client_zipcodes: {
        Row: {
          agency_color: string | null
          agent_run_id: string | null
          client_name: string
          id: number
          inserted_at: string | null
          month: string
          pulled_at: string | null
          source: string | null
          state: string | null
          workspace_name: string | null
          zip: string
        }
        Insert: {
          agency_color?: string | null
          agent_run_id?: string | null
          client_name: string
          id?: number
          inserted_at?: string | null
          month: string
          pulled_at?: string | null
          source?: string | null
          state?: string | null
          workspace_name?: string | null
          zip: string
        }
        Update: {
          agency_color?: string | null
          agent_run_id?: string | null
          client_name?: string
          id?: number
          inserted_at?: string | null
          month?: string
          pulled_at?: string | null
          source?: string | null
          state?: string | null
          workspace_name?: string | null
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_zipcodes_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      debounce_usage: {
        Row: {
          batch_id: string | null
          credits_used: number
          deliverable_count: number | null
          emails_verified: number
          id: number
          month: string
          risky_count: number | null
          undeliverable_count: number | null
          unknown_count: number | null
          verified_at: string | null
          workspace_name: string | null
        }
        Insert: {
          batch_id?: string | null
          credits_used?: number
          deliverable_count?: number | null
          emails_verified?: number
          id?: number
          month: string
          risky_count?: number | null
          undeliverable_count?: number | null
          unknown_count?: number | null
          verified_at?: string | null
          workspace_name?: string | null
        }
        Update: {
          batch_id?: string | null
          credits_used?: number
          deliverable_count?: number | null
          emails_verified?: number
          id?: number
          month?: string
          risky_count?: number | null
          undeliverable_count?: number | null
          unknown_count?: number | null
          verified_at?: string | null
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debounce_usage_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "weekly_batch_status"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "debounce_usage_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "weekly_batches"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      email_account_metadata: {
        Row: {
          created_at: string
          custom_tags: Json | null
          daily_sending_limit: number | null
          email_address: string
          id: string
          notes: string | null
          price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_tags?: Json | null
          daily_sending_limit?: number | null
          email_address: string
          id?: string
          notes?: string | null
          price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_tags?: Json | null
          daily_sending_limit?: number | null
          email_address?: string
          id?: string
          notes?: string | null
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      email_accounts_raw: {
        Row: {
          account_type: string | null
          bison_account_id: number
          bison_instance: string
          bounced_count: number | null
          created_at: string
          daily_limit: number | null
          deleted_at: string | null
          domain: string | null
          email_address: string
          email_provider: string | null
          emailguard_domain_uuid: string | null
          emailguard_is_blacklisted: boolean | null
          emailguard_last_blacklist_check: string | null
          emails_sent_count: number | null
          id: string
          interested_leads_count: number | null
          last_synced_at: string
          notes: string | null
          price: number | null
          price_source: string | null
          pricing_needs_review: boolean | null
          reply_rate_percentage: number | null
          reseller: string | null
          status: string
          total_leads_contacted_count: number | null
          total_opened_count: number | null
          total_replied_count: number | null
          unique_opened_count: number | null
          unique_replied_count: number | null
          unsubscribed_count: number | null
          updated_at: string
          volume_per_account: number
          warmup_enabled: boolean | null
          workspace_id: number
          workspace_name: string
        }
        Insert: {
          account_type?: string | null
          bison_account_id: number
          bison_instance: string
          bounced_count?: number | null
          created_at?: string
          daily_limit?: number | null
          deleted_at?: string | null
          domain?: string | null
          email_address: string
          email_provider?: string | null
          emailguard_domain_uuid?: string | null
          emailguard_is_blacklisted?: boolean | null
          emailguard_last_blacklist_check?: string | null
          emails_sent_count?: number | null
          id?: string
          interested_leads_count?: number | null
          last_synced_at?: string
          notes?: string | null
          price?: number | null
          price_source?: string | null
          pricing_needs_review?: boolean | null
          reply_rate_percentage?: number | null
          reseller?: string | null
          status: string
          total_leads_contacted_count?: number | null
          total_opened_count?: number | null
          total_replied_count?: number | null
          unique_opened_count?: number | null
          unique_replied_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string
          volume_per_account?: number
          warmup_enabled?: boolean | null
          workspace_id: number
          workspace_name: string
        }
        Update: {
          account_type?: string | null
          bison_account_id?: number
          bison_instance?: string
          bounced_count?: number | null
          created_at?: string
          daily_limit?: number | null
          deleted_at?: string | null
          domain?: string | null
          email_address?: string
          email_provider?: string | null
          emailguard_domain_uuid?: string | null
          emailguard_is_blacklisted?: boolean | null
          emailguard_last_blacklist_check?: string | null
          emails_sent_count?: number | null
          id?: string
          interested_leads_count?: number | null
          last_synced_at?: string
          notes?: string | null
          price?: number | null
          price_source?: string | null
          pricing_needs_review?: boolean | null
          reply_rate_percentage?: number | null
          reseller?: string | null
          status?: string
          total_leads_contacted_count?: number | null
          total_opened_count?: number | null
          total_replied_count?: number | null
          unique_opened_count?: number | null
          unique_replied_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string
          volume_per_account?: number
          warmup_enabled?: boolean | null
          workspace_id?: number
          workspace_name?: string
        }
        Relationships: []
      }
      expense_allocations: {
        Row: {
          allocated_amount: number
          allocation_notes: string | null
          allocation_percentage: number
          created_at: string | null
          expense_id: string
          id: string
          is_overhead: boolean | null
          workspace_name: string | null
        }
        Insert: {
          allocated_amount: number
          allocation_notes?: string | null
          allocation_percentage: number
          created_at?: string | null
          expense_id: string
          id?: string
          is_overhead?: boolean | null
          workspace_name?: string | null
        }
        Update: {
          allocated_amount?: number
          allocation_notes?: string | null
          allocation_percentage?: number
          created_at?: string | null
          expense_id?: string
          id?: string
          is_overhead?: boolean | null
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_allocations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_assistant_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_assistant_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "expense_assistant_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_assistant_sessions: {
        Row: {
          created_at: string | null
          expenses_created: number | null
          id: string
          last_message_at: string | null
          message_count: number | null
          receipts_matched: number | null
          started_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expenses_created?: number | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          receipts_matched?: number | null
          started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expenses_created?: number | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          receipts_matched?: number | null
          started_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string | null
          deduction_percentage: number | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_tax_deductible: boolean | null
          name: string
          parent_id: string | null
          requires_documentation: boolean | null
          schedule_c_line: string | null
          slug: string
          sort_order: number | null
          tax_category: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          deduction_percentage?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_tax_deductible?: boolean | null
          name: string
          parent_id?: string | null
          requires_documentation?: boolean | null
          schedule_c_line?: string | null
          slug: string
          sort_order?: number | null
          tax_category?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          deduction_percentage?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_tax_deductible?: boolean | null
          name?: string
          parent_id?: string | null
          requires_documentation?: boolean | null
          schedule_c_line?: string | null
          slug?: string
          sort_order?: number | null
          tax_category?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_learning_log: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          description_pattern: string | null
          id: string
          is_active: boolean | null
          learned_mapping: Json | null
          learning_type: string
          pattern_description: string | null
          suggested_category_id: string | null
          times_applied: number | null
          times_overridden: number | null
          vendor_name: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          description_pattern?: string | null
          id?: string
          is_active?: boolean | null
          learned_mapping?: Json | null
          learning_type: string
          pattern_description?: string | null
          suggested_category_id?: string | null
          times_applied?: number | null
          times_overridden?: number | null
          vendor_name?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          description_pattern?: string | null
          id?: string
          is_active?: boolean | null
          learned_mapping?: Json | null
          learning_type?: string
          pattern_description?: string | null
          suggested_category_id?: string | null
          times_applied?: number | null
          times_overridden?: number | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      expense_receipts: {
        Row: {
          expense_id: string
          file_name: string
          file_size: number | null
          file_type: string
          id: string
          storage_bucket: string | null
          storage_path: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          expense_id: string
          file_name: string
          file_size?: number | null
          file_type: string
          id?: string
          storage_bucket?: string | null
          storage_path: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          expense_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          id?: string
          storage_bucket?: string | null
          storage_path?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string
          expense_date: string
          has_receipt: boolean | null
          id: string
          is_recurring: boolean | null
          is_tax_deductible: boolean | null
          month_year: string | null
          notes: string | null
          payment_method: string | null
          payment_reference: string | null
          recurring_frequency: string | null
          recurring_template_id: string | null
          status: string | null
          tax_category: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category_id: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description: string
          expense_date: string
          has_receipt?: boolean | null
          id?: string
          is_recurring?: boolean | null
          is_tax_deductible?: boolean | null
          month_year?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          recurring_frequency?: string | null
          recurring_template_id?: string | null
          status?: string | null
          tax_category?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string
          expense_date?: string
          has_receipt?: boolean | null
          id?: string
          is_recurring?: boolean | null
          is_tax_deductible?: boolean | null
          month_year?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          recurring_frequency?: string | null
          recurring_template_id?: string | null
          status?: string | null
          tax_category?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "recurring_expense_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      external_api_delivery_log: {
        Row: {
          created_at: string
          error_message: string | null
          external_api_url: string
          id: string
          lead_email: string
          request_payload: Json | null
          response_body: string | null
          status_code: number | null
          success: boolean
          workspace_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          external_api_url: string
          id?: string
          lead_email: string
          request_payload?: Json | null
          response_body?: string | null
          status_code?: number | null
          success: boolean
          workspace_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          external_api_url?: string
          id?: string
          lead_email?: string
          request_payload?: Json | null
          response_body?: string | null
          status_code?: number | null
          success?: boolean
          workspace_name?: string
        }
        Relationships: []
      }
      infra_assistant_messages: {
        Row: {
          content: string
          created_at: string | null
          entities: Json | null
          id: string
          intent: string | null
          metadata: Json | null
          role: string
          session_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          entities?: Json | null
          id?: string
          intent?: string | null
          metadata?: Json | null
          role: string
          session_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          entities?: Json | null
          id?: string
          intent?: string | null
          metadata?: Json | null
          role?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "infra_assistant_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "infra_assistant_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      infra_assistant_sessions: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          message_count: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      infra_resolution_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          issue_context: Json | null
          issue_type: string
          resolution_steps: string[] | null
          resolution_summary: string | null
          success: boolean | null
          workspace_name: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          issue_context?: Json | null
          issue_type: string
          resolution_steps?: string[] | null
          resolution_summary?: string | null
          success?: boolean | null
          workspace_name?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          issue_context?: Json | null
          issue_type?: string
          resolution_steps?: string[] | null
          resolution_summary?: string | null
          success?: boolean | null
          workspace_name?: string | null
        }
        Relationships: []
      }
      infra_scheduled_reports: {
        Row: {
          config: Json | null
          created_at: string | null
          delivery_method: string | null
          delivery_target: string | null
          enabled: boolean | null
          id: string
          last_sent_at: string | null
          next_send_at: string | null
          report_type: string
          schedule: string
          user_id: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          delivery_method?: string | null
          delivery_target?: string | null
          enabled?: boolean | null
          id?: string
          last_sent_at?: string | null
          next_send_at?: string | null
          report_type: string
          schedule: string
          user_id?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          delivery_method?: string | null
          delivery_target?: string | null
          enabled?: boolean | null
          id?: string
          last_sent_at?: string | null
          next_send_at?: string | null
          report_type?: string
          schedule?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lead_replies: {
        Row: {
          ai_reasoning: string | null
          assigned_to: string | null
          bison_conversation_url: string | null
          bison_lead_id: string | null
          bison_reply_id: string | null
          bison_reply_numeric_id: number | null
          bison_sentiment: string | null
          bison_workspace_id: number | null
          company: string | null
          confidence_score: number | null
          created_at: string
          first_name: string | null
          handled_at: string | null
          handler_notes: string | null
          id: string
          is_handled: boolean | null
          is_interested: boolean | null
          last_name: string | null
          lead_email: string
          live_replies_enabled: boolean | null
          needs_review: boolean | null
          original_sender_email_id: number | null
          phone: string | null
          reply_date: string
          reply_text: string | null
          sentiment: string | null
          sentiment_source: string | null
          title: string | null
          updated_at: string
          workspace_name: string
        }
        Insert: {
          ai_reasoning?: string | null
          assigned_to?: string | null
          bison_conversation_url?: string | null
          bison_lead_id?: string | null
          bison_reply_id?: string | null
          bison_reply_numeric_id?: number | null
          bison_sentiment?: string | null
          bison_workspace_id?: number | null
          company?: string | null
          confidence_score?: number | null
          created_at?: string
          first_name?: string | null
          handled_at?: string | null
          handler_notes?: string | null
          id?: string
          is_handled?: boolean | null
          is_interested?: boolean | null
          last_name?: string | null
          lead_email: string
          live_replies_enabled?: boolean | null
          needs_review?: boolean | null
          original_sender_email_id?: number | null
          phone?: string | null
          reply_date: string
          reply_text?: string | null
          sentiment?: string | null
          sentiment_source?: string | null
          title?: string | null
          updated_at?: string
          workspace_name: string
        }
        Update: {
          ai_reasoning?: string | null
          assigned_to?: string | null
          bison_conversation_url?: string | null
          bison_lead_id?: string | null
          bison_reply_id?: string | null
          bison_reply_numeric_id?: number | null
          bison_sentiment?: string | null
          bison_workspace_id?: number | null
          company?: string | null
          confidence_score?: number | null
          created_at?: string
          first_name?: string | null
          handled_at?: string | null
          handler_notes?: string | null
          id?: string
          is_handled?: boolean | null
          is_interested?: boolean | null
          last_name?: string | null
          lead_email?: string
          live_replies_enabled?: boolean | null
          needs_review?: boolean | null
          original_sender_email_id?: number | null
          phone?: string | null
          reply_date?: string
          reply_text?: string | null
          sentiment?: string | null
          sentiment_source?: string | null
          title?: string | null
          updated_at?: string
          workspace_name?: string
        }
        Relationships: []
      }
      lead_sources: {
        Row: {
          active: boolean | null
          client_id: number | null
          created_at: string
          id: number
          last_run_at: string | null
          next_run_at: string | null
          params: Json
          schedule_cron: string | null
          site: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          client_id?: number | null
          created_at?: string
          id?: number
          last_run_at?: string | null
          next_run_at?: string | null
          params: Json
          schedule_cron?: string | null
          site: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          client_id?: number | null
          created_at?: string
          id?: number
          last_run_at?: string | null
          next_run_at?: string | null
          params?: Json
          schedule_cron?: string | null
          site?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      monthly_cleaned_leads: {
        Row: {
          cleaned_count: number
          client_name: string
          created_at: string | null
          gap: number | null
          id: number
          month: string
          noted_at: string | null
          source: string | null
          target_count: number | null
          updated_at: string | null
          workspace_name: string | null
        }
        Insert: {
          cleaned_count?: number
          client_name: string
          created_at?: string | null
          gap?: number | null
          id?: number
          month: string
          noted_at?: string | null
          source?: string | null
          target_count?: number | null
          updated_at?: string | null
          workspace_name?: string | null
        }
        Update: {
          cleaned_count?: number
          client_name?: string
          created_at?: string | null
          gap?: number | null
          id?: number
          month?: string
          noted_at?: string | null
          source?: string | null
          target_count?: number | null
          updated_at?: string | null
          workspace_name?: string | null
        }
        Relationships: []
      }
      monthly_daily_revenue_history: {
        Row: {
          created_at: string
          cumulative_revenue: number | null
          daily_revenue: number | null
          date: string
          day: number
          id: string
          lead_count: number | null
          month_year: string
        }
        Insert: {
          created_at?: string
          cumulative_revenue?: number | null
          daily_revenue?: number | null
          date: string
          day: number
          id?: string
          lead_count?: number | null
          month_year: string
        }
        Update: {
          created_at?: string
          cumulative_revenue?: number | null
          daily_revenue?: number | null
          date?: string
          day?: number
          id?: string
          lead_count?: number | null
          month_year?: string
        }
        Relationships: []
      }
      plaid_accounts: {
        Row: {
          account_id: string
          available_balance: number | null
          connection_id: string | null
          created_at: string | null
          currency_code: string | null
          current_balance: number | null
          id: string
          is_active: boolean | null
          last_balance_update: string | null
          mask: string | null
          name: string
          official_name: string | null
          subtype: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          available_balance?: number | null
          connection_id?: string | null
          created_at?: string | null
          currency_code?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          last_balance_update?: string | null
          mask?: string | null
          name: string
          official_name?: string | null
          subtype?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          available_balance?: number | null
          connection_id?: string | null
          created_at?: string | null
          currency_code?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          last_balance_update?: string | null
          mask?: string | null
          name?: string
          official_name?: string | null
          subtype?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plaid_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "plaid_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      plaid_connections: {
        Row: {
          access_token: string
          created_at: string | null
          cursor: string | null
          error_code: string | null
          error_message: string | null
          id: string
          institution_id: string | null
          institution_name: string | null
          item_id: string
          last_synced_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          cursor?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          item_id: string
          last_synced_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          cursor?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          item_id?: string
          last_synced_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      polling_job_status: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          job_name: string
          started_at: string
          status: string
          total_accounts_synced: number
          total_workspaces: number
          updated_at: string
          warnings: string[] | null
          workspaces_processed: number
          workspaces_skipped: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_name: string
          started_at?: string
          status?: string
          total_accounts_synced?: number
          total_workspaces?: number
          updated_at?: string
          warnings?: string[] | null
          workspaces_processed?: number
          workspaces_skipped?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_name?: string
          started_at?: string
          status?: string
          total_accounts_synced?: number
          total_workspaces?: number
          updated_at?: string
          warnings?: string[] | null
          workspaces_processed?: number
          workspaces_skipped?: number
        }
        Relationships: []
      }
      provider_performance_history: {
        Row: {
          active_accounts: number
          avg_emails_per_account: number | null
          avg_reply_rate: number
          bison_instance: string
          created_at: string
          email_provider: string
          id: string
          snapshot_date: string
          total_accounts: number
          total_bounces: number
          total_daily_limit: number | null
          total_replies: number
          total_sent: number
          total_volume_capacity: number | null
          unique_replies: number
          utilization_percentage: number | null
        }
        Insert: {
          active_accounts?: number
          avg_emails_per_account?: number | null
          avg_reply_rate?: number
          bison_instance: string
          created_at?: string
          email_provider: string
          id?: string
          snapshot_date: string
          total_accounts?: number
          total_bounces?: number
          total_daily_limit?: number | null
          total_replies?: number
          total_sent?: number
          total_volume_capacity?: number | null
          unique_replies?: number
          utilization_percentage?: number | null
        }
        Update: {
          active_accounts?: number
          avg_emails_per_account?: number | null
          avg_reply_rate?: number
          bison_instance?: string
          created_at?: string
          email_provider?: string
          id?: string
          snapshot_date?: string
          total_accounts?: number
          total_bounces?: number
          total_daily_limit?: number | null
          total_replies?: number
          total_sent?: number
          total_volume_capacity?: number | null
          unique_replies?: number
          utilization_percentage?: number | null
        }
        Relationships: []
      }
      raw_contacts: {
        Row: {
          client_name: string
          created_at: string | null
          csv_column_mapping: Json | null
          email: string | null
          extra_fields: Json | null
          filter_reason: string | null
          first_name: string | null
          home_value_estimate: number | null
          id: number
          is_head_of_household: boolean | null
          is_high_net_worth: boolean | null
          last_name: string | null
          mailing_address: string | null
          mailing_city: string | null
          mailing_state: string | null
          mailing_zip: string | null
          meets_value_criteria: boolean | null
          month: string
          parsed_purchase_date: string | null
          processed_at: string | null
          processing_status: string | null
          property_address: string | null
          property_city: string | null
          property_state: string | null
          property_zip: string | null
          purchase_date: string | null
          upload_batch_id: string
          uploaded_at: string | null
          uploaded_by: string | null
          workspace_name: string | null
        }
        Insert: {
          client_name: string
          created_at?: string | null
          csv_column_mapping?: Json | null
          email?: string | null
          extra_fields?: Json | null
          filter_reason?: string | null
          first_name?: string | null
          home_value_estimate?: number | null
          id?: number
          is_head_of_household?: boolean | null
          is_high_net_worth?: boolean | null
          last_name?: string | null
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          meets_value_criteria?: boolean | null
          month: string
          parsed_purchase_date?: string | null
          processed_at?: string | null
          processing_status?: string | null
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_zip?: string | null
          purchase_date?: string | null
          upload_batch_id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          workspace_name?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string | null
          csv_column_mapping?: Json | null
          email?: string | null
          extra_fields?: Json | null
          filter_reason?: string | null
          first_name?: string | null
          home_value_estimate?: number | null
          id?: number
          is_head_of_household?: boolean | null
          is_high_net_worth?: boolean | null
          last_name?: string | null
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          meets_value_criteria?: boolean | null
          month?: string
          parsed_purchase_date?: string | null
          processed_at?: string | null
          processing_status?: string | null
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_zip?: string | null
          purchase_date?: string | null
          upload_batch_id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_contacts_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_name"]
          },
          {
            foreignKeyName: "raw_contacts_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_zip_progress"
            referencedColumns: ["workspace_name"]
          },
        ]
      }
      raw_leads: {
        Row: {
          agent_run_id: string | null
          created_at: string
          hash: string
          id: number
          lead_source_id: number | null
          payload_json: Json
          scraped_at: string
          source_url: string | null
        }
        Insert: {
          agent_run_id?: string | null
          created_at?: string
          hash: string
          id?: number
          lead_source_id?: number | null
          payload_json: Json
          scraped_at?: string
          source_url?: string | null
        }
        Update: {
          agent_run_id?: string | null
          created_at?: string
          hash?: string
          id?: number
          lead_source_id?: number | null
          payload_json?: Json
          scraped_at?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_leads_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "raw_leads_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expense_templates: {
        Row: {
          amount: number
          category_id: string
          created_at: string | null
          day_of_month: number | null
          description: string | null
          end_date: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          last_generated_date: string | null
          name: string
          next_occurrence: string | null
          start_date: string
          updated_at: string | null
          vendor_id: string | null
          workspace_name: string | null
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string | null
          day_of_month?: number | null
          description?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          last_generated_date?: string | null
          name: string
          next_occurrence?: string | null
          start_date: string
          updated_at?: string | null
          vendor_id?: string | null
          workspace_name?: string | null
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string | null
          day_of_month?: number | null
          description?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          last_generated_date?: string | null
          name?: string
          next_occurrence?: string | null
          start_date?: string
          updated_at?: string | null
          vendor_id?: string | null
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expense_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expense_templates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      reply_templates: {
        Row: {
          cc_emails: string[]
          created_at: string
          id: number
          special_instructions: string | null
          template_text_no_phone: string
          template_text_with_phone: string
          updated_at: string
          workspace_name: string
        }
        Insert: {
          cc_emails?: string[]
          created_at?: string
          id?: number
          special_instructions?: string | null
          template_text_no_phone: string
          template_text_with_phone: string
          updated_at?: string
          workspace_name: string
        }
        Update: {
          cc_emails?: string[]
          created_at?: string
          id?: number
          special_instructions?: string | null
          template_text_no_phone?: string
          template_text_with_phone?: string
          updated_at?: string
          workspace_name?: string
        }
        Relationships: []
      }
      sender_emails_cache: {
        Row: {
          account_name: string | null
          account_type: string | null
          bison_instance: string
          bison_workspace_id: number
          bounced_count: number | null
          created_at: string
          daily_limit: number | null
          domain: string | null
          email_address: string
          email_provider: string | null
          emails_sent_count: number | null
          id: string
          interested_leads_count: number | null
          last_synced_at: string
          price: number | null
          reply_rate_percentage: number | null
          reseller: string | null
          status: string
          tags: Json | null
          total_leads_contacted_count: number | null
          total_replied_count: number | null
          unique_replied_count: number | null
          unsubscribed_count: number | null
          updated_at: string
          volume_per_account: number | null
          workspace_name: string
        }
        Insert: {
          account_name?: string | null
          account_type?: string | null
          bison_instance: string
          bison_workspace_id: number
          bounced_count?: number | null
          created_at?: string
          daily_limit?: number | null
          domain?: string | null
          email_address: string
          email_provider?: string | null
          emails_sent_count?: number | null
          id?: string
          interested_leads_count?: number | null
          last_synced_at?: string
          price?: number | null
          reply_rate_percentage?: number | null
          reseller?: string | null
          status: string
          tags?: Json | null
          total_leads_contacted_count?: number | null
          total_replied_count?: number | null
          unique_replied_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string
          volume_per_account?: number | null
          workspace_name: string
        }
        Update: {
          account_name?: string | null
          account_type?: string | null
          bison_instance?: string
          bison_workspace_id?: number
          bounced_count?: number | null
          created_at?: string
          daily_limit?: number | null
          domain?: string | null
          email_address?: string
          email_provider?: string | null
          emails_sent_count?: number | null
          id?: string
          interested_leads_count?: number | null
          last_synced_at?: string
          price?: number | null
          reply_rate_percentage?: number | null
          reseller?: string | null
          status?: string
          tags?: Json | null
          total_leads_contacted_count?: number | null
          total_replied_count?: number | null
          unique_replied_count?: number | null
          unsubscribed_count?: number | null
          updated_at?: string
          volume_per_account?: number | null
          workspace_name?: string
        }
        Relationships: []
      }
      sent_replies: {
        Row: {
          bison_reply_id: number | null
          cc_emails: string[]
          created_at: string
          error_message: string | null
          generated_reply_text: string
          id: number
          lead_email: string | null
          lead_name: string | null
          reply_uuid: string
          sent_at: string
          sent_by: string | null
          status: string
          workspace_name: string
        }
        Insert: {
          bison_reply_id?: number | null
          cc_emails?: string[]
          created_at?: string
          error_message?: string | null
          generated_reply_text: string
          id?: number
          lead_email?: string | null
          lead_name?: string | null
          reply_uuid: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          workspace_name: string
        }
        Update: {
          bison_reply_id?: number | null
          cc_emails?: string[]
          created_at?: string
          error_message?: string | null
          generated_reply_text?: string
          id?: number
          lead_email?: string | null
          lead_name?: string | null
          reply_uuid?: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_replies_reply_uuid_fkey"
            columns: ["reply_uuid"]
            isOneToOne: true
            referencedRelation: "lead_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_replies_reply_uuid_fkey"
            columns: ["reply_uuid"]
            isOneToOne: true
            referencedRelation: "lead_replies_with_conversation"
            referencedColumns: ["id"]
          },
        ]
      }
      site_credentials: {
        Row: {
          created_at: string
          id: number
          last_verified_at: string | null
          mfa_type: string | null
          notes: string | null
          secret_ref: string
          site: string
          state_coverage: string[] | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: number
          last_verified_at?: string | null
          mfa_type?: string | null
          notes?: string | null
          secret_ref: string
          site: string
          state_coverage?: string[] | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: number
          last_verified_at?: string | null
          mfa_type?: string | null
          notes?: string | null
          secret_ref?: string
          site?: string
          state_coverage?: string[] | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      slack_notifications_sent: {
        Row: {
          id: number
          notification_type: string
          reply_id: string
          sent_at: string
          workspace_name: string
        }
        Insert: {
          id?: number
          notification_type: string
          reply_id: string
          sent_at?: string
          workspace_name: string
        }
        Update: {
          id?: number
          notification_type?: string
          reply_id?: string
          sent_at?: string
          workspace_name?: string
        }
        Relationships: []
      }
      sma_policies: {
        Row: {
          agency_commission: number
          created_at: string
          id: string
          lead_id: string
          maverick_commission: number
          policy_type: string
          premium_amount: number
          updated_at: string
          workspace_name: string
        }
        Insert: {
          agency_commission: number
          created_at?: string
          id?: string
          lead_id: string
          maverick_commission: number
          policy_type: string
          premium_amount: number
          updated_at?: string
          workspace_name?: string
        }
        Update: {
          agency_commission?: number
          created_at?: string
          id?: string
          lead_id?: string
          maverick_commission?: number
          policy_type?: string
          premium_amount?: number
          updated_at?: string
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sma_policies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "client_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_locks: {
        Row: {
          heartbeat_at: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          status: string | null
        }
        Insert: {
          heartbeat_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          status?: string | null
        }
        Update: {
          heartbeat_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          status?: string | null
        }
        Relationships: []
      }
      sync_progress: {
        Row: {
          completed_at: string | null
          current_workspace: string | null
          error_message: string | null
          id: string
          job_id: string
          job_name: string
          started_at: string
          status: string | null
          total_accounts: number | null
          total_workspaces: number
          updated_at: string
          workspaces_completed: number | null
        }
        Insert: {
          completed_at?: string | null
          current_workspace?: string | null
          error_message?: string | null
          id?: string
          job_id: string
          job_name: string
          started_at?: string
          status?: string | null
          total_accounts?: number | null
          total_workspaces?: number
          updated_at?: string
          workspaces_completed?: number | null
        }
        Update: {
          completed_at?: string | null
          current_workspace?: string | null
          error_message?: string | null
          id?: string
          job_id?: string
          job_name?: string
          started_at?: string
          status?: string | null
          total_accounts?: number | null
          total_workspaces?: number
          updated_at?: string
          workspaces_completed?: number | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          category: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_recurring: boolean | null
          last_completed: string | null
          last_reminded_at: string | null
          priority: string
          recurring_pattern: string | null
          source: Json | null
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_name?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          last_completed?: string | null
          last_reminded_at?: string | null
          priority?: string
          recurring_pattern?: string | null
          source?: Json | null
          status?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          assignee_id?: string | null
          assignee_name?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          last_completed?: string | null
          last_reminded_at?: string | null
          priority?: string
          recurring_pattern?: string | null
          source?: Json | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          name: string
          role: string | null
          slack_id: string | null
          telegram_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          role?: string | null
          slack_id?: string | null
          telegram_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role?: string | null
          slack_id?: string | null
          telegram_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      upload_audit_log: {
        Row: {
          action: string
          api_endpoint: string | null
          api_request: Json | null
          api_response: Json | null
          batch_id: string | null
          contacts_failed: number | null
          contacts_processed: number | null
          contacts_succeeded: number | null
          credits_used: number | null
          duration_ms: number | null
          error_details: Json | null
          id: number
          month: string
          performed_at: string | null
          performed_by: string | null
          status: string
          workspace_name: string
        }
        Insert: {
          action: string
          api_endpoint?: string | null
          api_request?: Json | null
          api_response?: Json | null
          batch_id?: string | null
          contacts_failed?: number | null
          contacts_processed?: number | null
          contacts_succeeded?: number | null
          credits_used?: number | null
          duration_ms?: number | null
          error_details?: Json | null
          id?: number
          month: string
          performed_at?: string | null
          performed_by?: string | null
          status: string
          workspace_name: string
        }
        Update: {
          action?: string
          api_endpoint?: string | null
          api_request?: Json | null
          api_response?: Json | null
          batch_id?: string | null
          contacts_failed?: number | null
          contacts_processed?: number | null
          contacts_succeeded?: number | null
          credits_used?: number | null
          duration_ms?: number | null
          error_details?: Json | null
          id?: number
          month?: string
          performed_at?: string | null
          performed_by?: string | null
          status?: string
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_audit_log_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "weekly_batch_status"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "upload_audit_log_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "weekly_batches"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_workspace_access: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
          workspace_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
          workspace_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
          workspace_name?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          billing_cycle: string | null
          category_id: string | null
          created_at: string | null
          default_payment_method: string | null
          display_name: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          typical_amount: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          billing_cycle?: string | null
          category_id?: string | null
          created_at?: string | null
          default_payment_method?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          typical_amount?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          billing_cycle?: string | null
          category_id?: string | null
          created_at?: string | null
          default_payment_method?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          typical_amount?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_contacts: {
        Row: {
          created_at: string | null
          debounce_credits_used: number | null
          debounce_response: Json | null
          debounce_status: string | null
          debounce_verified_at: string | null
          email: string
          extra_fields: Json | null
          first_name: string | null
          home_value_estimate: number | null
          id: number
          is_high_net_worth: boolean | null
          is_uploaded: boolean | null
          last_name: string | null
          month: string
          property_address: string | null
          property_city: string | null
          property_state: string | null
          property_zip: string | null
          purchase_date: string | null
          purchase_day: number | null
          raw_contact_id: number | null
          renewal_end_date: string | null
          renewal_start_date: string | null
          target_campaign: string | null
          updated_at: string | null
          upload_batch_id: string | null
          uploaded_at: string | null
          week_bucket: number | null
          workspace_name: string
        }
        Insert: {
          created_at?: string | null
          debounce_credits_used?: number | null
          debounce_response?: Json | null
          debounce_status?: string | null
          debounce_verified_at?: string | null
          email: string
          extra_fields?: Json | null
          first_name?: string | null
          home_value_estimate?: number | null
          id?: number
          is_high_net_worth?: boolean | null
          is_uploaded?: boolean | null
          last_name?: string | null
          month: string
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_zip?: string | null
          purchase_date?: string | null
          purchase_day?: number | null
          raw_contact_id?: number | null
          renewal_end_date?: string | null
          renewal_start_date?: string | null
          target_campaign?: string | null
          updated_at?: string | null
          upload_batch_id?: string | null
          uploaded_at?: string | null
          week_bucket?: number | null
          workspace_name: string
        }
        Update: {
          created_at?: string | null
          debounce_credits_used?: number | null
          debounce_response?: Json | null
          debounce_status?: string | null
          debounce_verified_at?: string | null
          email?: string
          extra_fields?: Json | null
          first_name?: string | null
          home_value_estimate?: number | null
          id?: number
          is_high_net_worth?: boolean | null
          is_uploaded?: boolean | null
          last_name?: string | null
          month?: string
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_zip?: string | null
          purchase_date?: string | null
          purchase_day?: number | null
          raw_contact_id?: number | null
          renewal_end_date?: string | null
          renewal_start_date?: string | null
          target_campaign?: string | null
          updated_at?: string | null
          upload_batch_id?: string | null
          uploaded_at?: string | null
          week_bucket?: number | null
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_verified_contacts_batch"
            columns: ["upload_batch_id"]
            isOneToOne: false
            referencedRelation: "weekly_batch_status"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "fk_verified_contacts_batch"
            columns: ["upload_batch_id"]
            isOneToOne: false
            referencedRelation: "weekly_batches"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "verified_contacts_raw_contact_id_fkey"
            columns: ["raw_contact_id"]
            isOneToOne: false
            referencedRelation: "raw_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_contacts_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_name"]
          },
          {
            foreignKeyName: "verified_contacts_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_zip_progress"
            referencedColumns: ["workspace_name"]
          },
        ]
      }
      webhook_delivery_log: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processing_time_ms: number | null
          success: boolean
          workspace_name: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processing_time_ms?: number | null
          success?: boolean
          workspace_name?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processing_time_ms?: number | null
          success?: boolean
          workspace_name?: string | null
        }
        Relationships: []
      }
      webhook_health: {
        Row: {
          created_at: string
          id: string
          is_healthy: boolean | null
          last_error_message: string | null
          last_webhook_at: string | null
          success_rate_24h: number | null
          updated_at: string
          webhook_count_24h: number | null
          workspace_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_healthy?: boolean | null
          last_error_message?: string | null
          last_webhook_at?: string | null
          success_rate_24h?: number | null
          updated_at?: string
          webhook_count_24h?: number | null
          workspace_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_healthy?: boolean | null
          last_error_message?: string | null
          last_webhook_at?: string | null
          success_rate_24h?: number | null
          updated_at?: string
          webhook_count_24h?: number | null
          workspace_name?: string
        }
        Relationships: []
      }
      weekly_batches: {
        Row: {
          actual_upload_date: string | null
          batch_id: string
          bison_campaign_name: string | null
          bison_error_message: string | null
          bison_upload_id: string | null
          bison_upload_status: string | null
          contact_count: number | null
          created_at: string | null
          csv_file_path: string | null
          csv_generated_at: string | null
          hnw_count: number | null
          month: string
          scheduled_upload_date: string
          slack_approved_at: string | null
          slack_approved_by: string | null
          slack_message_ts: string | null
          slack_notification_sent: boolean | null
          updated_at: string | null
          week_bucket: number
          week_number: number
          workspace_name: string
        }
        Insert: {
          actual_upload_date?: string | null
          batch_id?: string
          bison_campaign_name?: string | null
          bison_error_message?: string | null
          bison_upload_id?: string | null
          bison_upload_status?: string | null
          contact_count?: number | null
          created_at?: string | null
          csv_file_path?: string | null
          csv_generated_at?: string | null
          hnw_count?: number | null
          month: string
          scheduled_upload_date: string
          slack_approved_at?: string | null
          slack_approved_by?: string | null
          slack_message_ts?: string | null
          slack_notification_sent?: boolean | null
          updated_at?: string | null
          week_bucket: number
          week_number: number
          workspace_name: string
        }
        Update: {
          actual_upload_date?: string | null
          batch_id?: string
          bison_campaign_name?: string | null
          bison_error_message?: string | null
          bison_upload_id?: string | null
          bison_upload_status?: string | null
          contact_count?: number | null
          created_at?: string | null
          csv_file_path?: string | null
          csv_generated_at?: string | null
          hnw_count?: number | null
          month?: string
          scheduled_upload_date?: string
          slack_approved_at?: string | null
          slack_approved_by?: string | null
          slack_message_ts?: string | null
          slack_notification_sent?: boolean | null
          updated_at?: string | null
          week_bucket?: number
          week_number?: number
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_batches_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_name"]
          },
          {
            foreignKeyName: "weekly_batches_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_zip_progress"
            referencedColumns: ["workspace_name"]
          },
        ]
      }
      workspace_api_logs: {
        Row: {
          api_key_suffix: string | null
          created_at: string
          edge_function: string | null
          endpoint: string
          error_message: string | null
          id: string
          metadata: Json | null
          method: string
          response_time_ms: number | null
          status_code: number | null
          success: boolean | null
          triggered_by: string | null
          workspace_name: string
        }
        Insert: {
          api_key_suffix?: string | null
          created_at?: string
          edge_function?: string | null
          endpoint: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
          success?: boolean | null
          triggered_by?: string | null
          workspace_name: string
        }
        Update: {
          api_key_suffix?: string | null
          created_at?: string
          edge_function?: string | null
          endpoint?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
          success?: boolean | null
          triggered_by?: string | null
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_api_logs_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_name"]
          },
          {
            foreignKeyName: "workspace_api_logs_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_zip_progress"
            referencedColumns: ["workspace_name"]
          },
        ]
      }
      workspace_mappings: {
        Row: {
          bison_base_url: string | null
          bison_workspace_id: number
          created_at: string | null
          id: string
          updated_at: string | null
          workspace_name: string
        }
        Insert: {
          bison_base_url?: string | null
          bison_workspace_id: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          workspace_name: string
        }
        Update: {
          bison_base_url?: string | null
          bison_workspace_id?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          workspace_name?: string
        }
        Relationships: []
      }
      workspace_webhook_events: {
        Row: {
          event_data: Json
          event_type: string
          id: string
          processed_at: string | null
          processing_error: string | null
          processing_status: string | null
          received_at: string
          retry_count: number | null
          signature_valid: boolean | null
          source_ip: string | null
          user_agent: string | null
          workspace_name: string
        }
        Insert: {
          event_data: Json
          event_type: string
          id?: string
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string | null
          received_at?: string
          retry_count?: number | null
          signature_valid?: boolean | null
          source_ip?: string | null
          user_agent?: string | null
          workspace_name: string
        }
        Update: {
          event_data?: Json
          event_type?: string
          id?: string
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string | null
          received_at?: string
          retry_count?: number | null
          signature_valid?: boolean | null
          source_ip?: string | null
          user_agent?: string | null
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_webhook_events_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_name"]
          },
          {
            foreignKeyName: "workspace_webhook_events_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_zip_progress"
            referencedColumns: ["workspace_name"]
          },
        ]
      }
      zip_batch_pulls: {
        Row: {
          batch_number: number
          created_at: string | null
          csv_filename: string | null
          deliverable_contacts: number | null
          id: number
          month: string
          pulled_at: string | null
          pulled_by: string | null
          qualified_contacts: number | null
          raw_contacts_uploaded: number | null
          state: string | null
          updated_at: string | null
          uploaded_to_bison: boolean | null
          workspace_name: string
          zip: string
        }
        Insert: {
          batch_number: number
          created_at?: string | null
          csv_filename?: string | null
          deliverable_contacts?: number | null
          id?: number
          month: string
          pulled_at?: string | null
          pulled_by?: string | null
          qualified_contacts?: number | null
          raw_contacts_uploaded?: number | null
          state?: string | null
          updated_at?: string | null
          uploaded_to_bison?: boolean | null
          workspace_name: string
          zip: string
        }
        Update: {
          batch_number?: number
          created_at?: string | null
          csv_filename?: string | null
          deliverable_contacts?: number | null
          id?: number
          month?: string
          pulled_at?: string | null
          pulled_by?: string | null
          qualified_contacts?: number | null
          raw_contacts_uploaded?: number | null
          state?: string | null
          updated_at?: string | null
          uploaded_to_bison?: boolean | null
          workspace_name?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "zip_batch_pulls_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_name"]
          },
          {
            foreignKeyName: "zip_batch_pulls_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_zip_progress"
            referencedColumns: ["workspace_name"]
          },
        ]
      }
    }
    Views: {
      client_expense_summary: {
        Row: {
          expense_count: number | null
          month_year: string | null
          total_direct_costs: number | null
          workspace_name: string | null
        }
        Relationships: []
      }
      client_latest_metrics: {
        Row: {
          emails_sent_mtd: number | null
          metric_date: string | null
          mtd_leads_progress: number | null
          positive_replies_last_30_days: number | null
          positive_replies_last_7_days: number | null
          positive_replies_mtd: number | null
          projection_emails_eom: number | null
          projection_positive_replies_eom: number | null
          projection_replies_progress: number | null
          updated_at: string | null
          workspace_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_metrics_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_name"]
          },
          {
            foreignKeyName: "client_metrics_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_zip_progress"
            referencedColumns: ["workspace_name"]
          },
        ]
      }
      client_zip_progress: {
        Row: {
          display_name: string | null
          last_pull_date: string | null
          month: string | null
          total_batches: number | null
          total_raw_contacts: number | null
          total_zips: number | null
          workspace_name: string | null
          zips_pulled: number | null
          zips_remaining: number | null
        }
        Relationships: []
      }
      email_accounts_home_insurance_view: {
        Row: {
          account_type: string | null
          bison_account_id: number | null
          bison_instance: string | null
          bounced_count: number | null
          created_at: string | null
          daily_limit: number | null
          domain: string | null
          email_address: string | null
          email_provider: string | null
          emails_sent_count: number | null
          id: string | null
          interested_leads_count: number | null
          last_synced_at: string | null
          notes: string | null
          price: number | null
          price_source: string | null
          pricing_needs_review: boolean | null
          reply_rate_percentage: number | null
          reseller: string | null
          status: string | null
          total_leads_contacted_count: number | null
          total_opened_count: number | null
          total_replied_count: number | null
          unique_opened_count: number | null
          unique_replied_count: number | null
          unsubscribed_count: number | null
          updated_at: string | null
          warmup_enabled: boolean | null
          workspace_id: number | null
          workspace_name: string | null
        }
        Relationships: []
      }
      email_accounts_view: {
        Row: {
          account_type: string | null
          bison_account_id: number | null
          bison_instance: string | null
          bounced_count: number | null
          created_at: string | null
          daily_limit: number | null
          domain: string | null
          email_address: string | null
          email_provider: string | null
          emails_sent_count: number | null
          id: string | null
          interested_leads_count: number | null
          last_synced_at: string | null
          notes: string | null
          price: number | null
          price_source: string | null
          pricing_needs_review: boolean | null
          reply_rate_percentage: number | null
          reseller: string | null
          status: string | null
          total_leads_contacted_count: number | null
          total_opened_count: number | null
          total_replied_count: number | null
          unique_opened_count: number | null
          unique_replied_count: number | null
          unsubscribed_count: number | null
          updated_at: string | null
          warmup_enabled: boolean | null
          workspace_id: number | null
          workspace_name: string | null
        }
        Relationships: []
      }
      lead_conversation_stats: {
        Row: {
          conversation_status: string | null
          first_reply_date: string | null
          latest_reply_date: string | null
          lead_email: string | null
          replies_last_7_days: number | null
          reply_count: number | null
          workspace_name: string | null
        }
        Relationships: []
      }
      lead_replies_with_conversation: {
        Row: {
          ai_reasoning: string | null
          assigned_to: string | null
          bison_conversation_url: string | null
          bison_lead_id: string | null
          bison_reply_id: string | null
          bison_reply_numeric_id: number | null
          bison_sentiment: string | null
          bison_workspace_id: number | null
          company: string | null
          confidence_score: number | null
          conversation_first_reply_date: string | null
          conversation_latest_reply_date: string | null
          conversation_replies_last_7_days: number | null
          conversation_reply_count: number | null
          conversation_status: string | null
          created_at: string | null
          first_name: string | null
          handled_at: string | null
          handler_notes: string | null
          id: string | null
          is_handled: boolean | null
          is_interested: boolean | null
          last_name: string | null
          lead_email: string | null
          live_replies_enabled: boolean | null
          needs_review: boolean | null
          original_sender_email_id: number | null
          phone: string | null
          reply_date: string | null
          reply_text: string | null
          sentiment: string | null
          sentiment_source: string | null
          title: string | null
          updated_at: string | null
          workspace_name: string | null
        }
        Relationships: []
      }
      monthly_contact_pipeline_summary: {
        Row: {
          batches_completed: number | null
          batches_created: number | null
          client_display_name: string | null
          contact_tier: string | null
          contacts_needed: number | null
          contacts_pending: number | null
          contacts_uploaded: number | null
          deliverable_count: number | null
          hnw_contacts: number | null
          month: string | null
          monthly_contact_target: number | null
          raw_contacts_uploaded: number | null
          risky_count: number | null
          target_percentage: number | null
          undeliverable_count: number | null
          upload_batch_count: number | null
          verified_contacts: number | null
          workspace_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verified_contacts_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_name"]
          },
          {
            foreignKeyName: "verified_contacts_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_zip_progress"
            referencedColumns: ["workspace_name"]
          },
        ]
      }
      monthly_expense_summary: {
        Row: {
          approved_amount: number | null
          category_color: string | null
          category_name: string | null
          category_slug: string | null
          category_sort_order: number | null
          expense_count: number | null
          missing_receipts: number | null
          month_year: string | null
          pending_amount: number | null
          total_amount: number | null
        }
        Relationships: []
      }
      overhead_expense_summary: {
        Row: {
          expense_count: number | null
          month_year: string | null
          total_overhead: number | null
        }
        Relationships: []
      }
      weekly_batch_status: {
        Row: {
          actual_upload_date: string | null
          batch_id: string | null
          bison_campaign_name: string | null
          bison_upload_status: string | null
          client_display_name: string | null
          contact_count: number | null
          created_at: string | null
          hnw_count: number | null
          month: string | null
          scheduled_upload_date: string | null
          slack_approved_at: string | null
          slack_approved_by: string | null
          upload_status_text: string | null
          week_number: number | null
          workspace_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_batches_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_registry"
            referencedColumns: ["workspace_name"]
          },
          {
            foreignKeyName: "weekly_batches_workspace_name_fkey"
            columns: ["workspace_name"]
            isOneToOne: false
            referencedRelation: "client_zip_progress"
            referencedColumns: ["workspace_name"]
          },
        ]
      }
    }
    Functions: {
      aggregate_provider_stats: {
        Args: never
        Returns: {
          active_accounts: number
          avg_emails_per_account: number
          avg_reply_rate: number
          bison_instance: string
          email_provider: string
          total_accounts: number
          total_bounces: number
          total_daily_limit: number
          total_replies: number
          total_sent: number
          total_volume_capacity: number
          unique_replies: number
          utilization_percentage: number
        }[]
      }
      calculate_mtd_metrics: {
        Args: { p_as_of_date?: string; p_workspace_name: string }
        Returns: string
      }
      calculate_renewal_date: {
        Args: { purchase_date: string }
        Returns: string
      }
      check_provider_reply_rate_drop: {
        Args: never
        Returns: {
          bison_instance: string
          current_rate: number
          drop_percentage: number
          email_provider: string
          previous_rate: number
        }[]
      }
      check_workspace_access: {
        Args: { p_workspace_name: string }
        Returns: boolean
      }
      cleanup_old_slack_notifications: { Args: never; Returns: number }
      cleanup_stuck_sync_jobs: {
        Args: never
        Returns: {
          jobs_cleaned: number
          sync_progress_cleaned: number
        }[]
      }
      delete_old_api_logs: { Args: never; Returns: undefined }
      delete_old_webhook_events: { Args: never; Returns: undefined }
      generate_bison_conversation_url: {
        Args: { p_base_url?: string; p_reply_uuid: string }
        Returns: string
      }
      get_account_status_stats: {
        Args: never
        Returns: {
          connected: number
          disconnect_rate: number
          disconnected: number
          failed: number
          total: number
        }[]
      }
      get_client_expense_allocation: {
        Args: { p_month_year: string; p_workspace_name: string }
        Returns: {
          allocated_overhead: number
          direct_costs: number
          total_costs: number
        }[]
      }
      get_conversation_stats: {
        Args: { p_workspace_name?: string }
        Returns: {
          conversation_status: string
          first_reply_date: string
          latest_reply_date: string
          lead_email: string
          replies_last_7_days: number
          reply_count: number
          workspace_name: string
        }[]
      }
      get_current_month_year: { Args: never; Returns: string }
      get_daily_billable_revenue: {
        Args: { month_year: string }
        Returns: {
          cumulative_revenue: number
          daily_revenue: number
          day_of_month: number
          lead_count: number
          revenue_date: string
        }[]
      }
      get_deletion_stats: {
        Args: never
        Returns: {
          active_accounts: number
          deleted_accounts: number
          deletion_rate: number
          total_accounts: number
          workspace_name: string
        }[]
      }
      get_monthly_lead_counts: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          lead_count: number
          workspace_name: string
        }[]
      }
      get_readable_date: { Args: { date_val: string }; Returns: string }
      get_user_workspaces: {
        Args: { p_user_id: string }
        Returns: {
          leads_count: number
          role: string
          won_leads_count: number
          workspace_id: number
          workspace_name: string
        }[]
      }
      get_workspace_lead_counts: {
        Args: { p_user_id?: string }
        Returns: {
          leads_count: number
          role: string
          won_leads_count: number
          workspace_id: number
          workspace_name: string
        }[]
      }
      get_ytd_tax_summary: {
        Args: { p_year?: number }
        Returns: {
          deductible_expenses: number
          effective_tax_rate: number
          estimated_federal_tax: number
          estimated_se_tax: number
          taxable_income: number
          total_expenses: number
          total_revenue: number
          total_tax_liability: number
        }[]
      }
      increment_metric: {
        Args: {
          p_increment_by?: number
          p_metric_name: string
          p_workspace_name: string
        }
        Returns: undefined
      }
      refresh_email_accounts_view: { Args: never; Returns: undefined }
      refresh_home_insurance_view: { Args: never; Returns: undefined }
      release_advisory_lock: { Args: { lock_id: number }; Returns: boolean }
      release_sync_lock: {
        Args: { p_job_id?: string; p_lock_id?: string }
        Returns: boolean
      }
      reset_daily_api_counters: { Args: never; Returns: undefined }
      try_advisory_lock: { Args: { lock_id: number }; Returns: boolean }
      try_sync_lock: {
        Args: {
          p_job_id?: string
          p_lock_id?: string
          p_stale_threshold_minutes?: number
        }
        Returns: boolean
      }
      update_api_health_status: { Args: never; Returns: undefined }
      update_sync_heartbeat: {
        Args: { p_job_id?: string; p_lock_id?: string }
        Returns: boolean
      }
      upsert_client_daily_metrics: {
        Args: {
          p_emails_sent?: number
          p_metric_date: string
          p_positive_replies?: number
          p_workspace_name: string
        }
        Returns: string
      }
      user_has_workspace_access: {
        Args: { p_user_id: string; p_workspace_name: string }
        Returns: boolean
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
