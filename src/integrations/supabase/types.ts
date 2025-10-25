export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      client_registry: {
        Row: {
          workspace_id: number
          workspace_name: string
          display_name: string | null
          is_active: boolean | null
          billing_type: string
          price_per_lead: number | null
          retainer_amount: number | null
          monthly_kpi_target: number | null
          airtable_record_id: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          workspace_id: number
          workspace_name: string
          display_name?: string | null
          is_active?: boolean | null
          billing_type: string
          price_per_lead?: number | null
          retainer_amount?: number | null
          monthly_kpi_target?: number | null
          airtable_record_id?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        
        Update: {
          workspace_id?: number
          workspace_name?: string
          display_name?: string | null
          is_active?: boolean | null
          billing_type?: string
          price_per_lead?: number | null
          retainer_amount?: number | null
          monthly_kpi_target?: number | null
          airtable_record_id?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      client_metrics: {
        Row: {
          id: string
          workspace_name: string
          metric_date: string
          metric_type: string
          emails_sent: number | null
          emails_sent_mtd: number | null
          projection_emails_eom: number | null
          positive_replies: number | null
          positive_replies_mtd: number | null
          positive_replies_last_7_days: number | null
          positive_replies_last_14_days: number | null
          positive_replies_last_30_days: number | null
          positive_replies_current_month: number | null
          positive_replies_last_month: number | null
          projection_positive_replies_eom: number | null
          mtd_leads_progress: number | null
          projection_replies_progress: number | null
          last_week_vs_week_before_progress: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          workspace_name: string
          metric_date: string
          metric_type: string
          emails_sent?: number | null
          emails_sent_mtd?: number | null
          projection_emails_eom?: number | null
          positive_replies?: number | null
          positive_replies_mtd?: number | null
          positive_replies_last_7_days?: number | null
          positive_replies_last_14_days?: number | null
          positive_replies_last_30_days?: number | null
          positive_replies_current_month?: number | null
          positive_replies_last_month?: number | null
          projection_positive_replies_eom?: number | null
          mtd_leads_progress?: number | null
          projection_replies_progress?: number | null
          last_week_vs_week_before_progress?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          workspace_name?: string
          metric_date?: string
          metric_type?: string
          emails_sent?: number | null
          emails_sent_mtd?: number | null
          projection_emails_eom?: number | null
          positive_replies?: number | null
          positive_replies_mtd?: number | null
          positive_replies_last_7_days?: number | null
          positive_replies_last_14_days?: number | null
          positive_replies_last_30_days?: number | null
          positive_replies_current_month?: number | null
          positive_replies_last_month?: number | null
          projection_positive_replies_eom?: number | null
          mtd_leads_progress?: number | null
          projection_replies_progress?: number | null
          last_week_vs_week_before_progress?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      sender_emails_cache: {
        Row: {
          id: string
          email_address: string
          account_name: string | null
          workspace_name: string
          bison_workspace_id: number
          bison_instance: string
          emails_sent_count: number | null
          total_replied_count: number | null
          unique_replied_count: number | null
          bounced_count: number | null
          unsubscribed_count: number | null
          interested_leads_count: number | null
          total_leads_contacted_count: number | null
          reply_rate_percentage: number | null
          status: string
          daily_limit: number | null
          account_type: string | null
          email_provider: string | null
          reseller: string | null
          domain: string | null
          price: number | null
          volume_per_account: number | null
          tags: Json | null
          last_synced_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email_address: string
          account_name?: string | null
          workspace_name: string
          bison_workspace_id: number
          bison_instance: string
          emails_sent_count?: number | null
          total_replied_count?: number | null
          unique_replied_count?: number | null
          bounced_count?: number | null
          unsubscribed_count?: number | null
          interested_leads_count?: number | null
          total_leads_contacted_count?: number | null
          reply_rate_percentage?: number | null
          status: string
          daily_limit?: number | null
          account_type?: string | null
          email_provider?: string | null
          reseller?: string | null
          domain?: string | null
          price?: number | null
          volume_per_account?: number | null
          tags?: Json | null
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email_address?: string
          account_name?: string | null
          workspace_name?: string
          bison_workspace_id?: number
          bison_instance?: string
          emails_sent_count?: number | null
          total_replied_count?: number | null
          unique_replied_count?: number | null
          bounced_count?: number | null
          unsubscribed_count?: number | null
          interested_leads_count?: number | null
          total_leads_contacted_count?: number | null
          reply_rate_percentage?: number | null
          status?: string
          daily_limit?: number | null
          account_type?: string | null
          email_provider?: string | null
          reseller?: string | null
          domain?: string | null
          price?: number | null
          volume_per_account?: number | null
          tags?: Json | null
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      client_leads: {
        Row: {
          id: string
          airtable_id: string
          workspace_name: string | null
          client_name: string | null
          lead_email: string | null
          first_name: string | null
          last_name: string | null
          phone: string | null
          address: string | null
          city: string | null
          state: string | null
          zip: string | null
          date_received: string | null
          reply_received: string | null
          email_sent: string | null
          email_subject: string | null
          lead_value: number | null
          renewal_date: string | null
          birthday: string | null
          campaign_name: string | null
          sender_email: string | null
          icp: boolean | null
          pipeline_stage: string | null
          pipeline_position: number | null
          notes: string | null
          bison_conversation_url: string | null
          bison_lead_id: string | null
          created_at: string | null
          updated_at: string | null
          last_synced_at: string | null
        }
        Insert: {
          id?: string
          airtable_id: string
          workspace_name?: string | null
          client_name?: string | null
          lead_email?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          date_received?: string | null
          reply_received?: string | null
          email_sent?: string | null
          email_subject?: string | null
          lead_value?: number | null
          renewal_date?: string | null
          birthday?: string | null
          campaign_name?: string | null
          sender_email?: string | null
          icp?: boolean | null
          pipeline_stage?: string | null
          pipeline_position?: number | null
          notes?: string | null
          bison_conversation_url?: string | null
          bison_lead_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          last_synced_at?: string | null
        }
        Update: {
          id?: string
          airtable_id?: string
          workspace_name?: string | null
          client_name?: string | null
          lead_email?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          date_received?: string | null
          reply_received?: string | null
          email_sent?: string | null
          email_subject?: string | null
          lead_value?: number | null
          renewal_date?: string | null
          birthday?: string | null
          campaign_name?: string | null
          sender_email?: string | null
          icp?: boolean | null
          pipeline_stage?: string | null
          pipeline_position?: number | null
          notes?: string | null
          bison_conversation_url?: string | null
          bison_lead_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          last_synced_at?: string | null
        }
      }
      email_account_metadata: {
        Row: {
          id: string
          email_address: string
          workspace_name: string
          updated_at: string
        }
        Insert: {
          id?: string
          email_address: string
          workspace_name: string
          updated_at?: string
        }
        Update: {
          id?: string
          email_address?: string
          workspace_name?: string
          updated_at?: string
        }
      }
      webhook_delivery_log: {
        Row: {
          id: string
          created_at: string
        }
        Insert: {
          id?: string
          created_at?: string
        }
        Update: {
          id?: string
          created_at?: string
        }
      }
    },
    Views: {
      [_ in never]: never
    },
    Functions: {
      [_ in never]: never
    },
    Enums: {
      [_ in never]: never
    },
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export const Constants = {
  public: {
    Enums: {},
  },
} as const
