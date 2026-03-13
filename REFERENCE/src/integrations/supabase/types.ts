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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      account_lockouts: {
        Row: {
          created_at: string
          email: string
          failed_attempts: number
          id: string
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      brain_dumps: {
        Row: {
          ai_analysis_complete: boolean | null
          created_at: string | null
          dump_date: string
          id: string
          processed: boolean | null
          raw_content: string
          user_id: string
        }
        Insert: {
          ai_analysis_complete?: boolean | null
          created_at?: string | null
          dump_date?: string
          id?: string
          processed?: boolean | null
          raw_content: string
          user_id: string
        }
        Update: {
          ai_analysis_complete?: boolean | null
          created_at?: string | null
          dump_date?: string
          id?: string
          processed?: boolean | null
          raw_content?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_dumps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          color: string | null
          created_at: string | null
          end_time: string
          id: string
          is_flexible: boolean | null
          macro_task_id: string | null
          micro_task_id: string | null
          recurrence_rule: string | null
          start_time: string
          time_block_type: Database["public"]["Enums"]["time_block_type"] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          is_flexible?: boolean | null
          macro_task_id?: string | null
          micro_task_id?: string | null
          recurrence_rule?: string | null
          start_time: string
          time_block_type?:
            | Database["public"]["Enums"]["time_block_type"]
            | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          is_flexible?: boolean | null
          macro_task_id?: string | null
          micro_task_id?: string | null
          recurrence_rule?: string | null
          start_time?: string
          time_block_type?:
            | Database["public"]["Enums"]["time_block_type"]
            | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_macro_task_id_fkey"
            columns: ["macro_task_id"]
            isOneToOne: false
            referencedRelation: "macro_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_micro_task_id_fkey"
            columns: ["micro_task_id"]
            isOneToOne: false
            referencedRelation: "micro_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      client_communications: {
        Row: {
          client_id: string | null
          created_at: string | null
          file_url: string | null
          id: string
          is_read: boolean | null
          message: string | null
          priority: string | null
          project_id: string | null
          subject: string | null
          type: Database["public"]["Enums"]["communication_type"]
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          priority?: string | null
          project_id?: string | null
          subject?: string | null
          type: Database["public"]["Enums"]["communication_type"]
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          priority?: string | null
          project_id?: string | null
          subject?: string | null
          type?: Database["public"]["Enums"]["communication_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_communications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_communications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      client_portal_access: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"] | null
          can_download_files: boolean | null
          can_view_invoices: boolean | null
          can_view_reports: boolean | null
          can_view_time_logs: boolean | null
          client_id: string | null
          created_at: string | null
          id: string
          last_login: string | null
          user_id: string | null
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"] | null
          can_download_files?: boolean | null
          can_view_invoices?: boolean | null
          can_view_reports?: boolean | null
          can_view_time_logs?: boolean | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          last_login?: string | null
          user_id?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"] | null
          can_download_files?: boolean | null
          can_view_invoices?: boolean | null
          can_view_reports?: boolean | null
          can_view_time_logs?: boolean | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          last_login?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      client_requests: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string | null
          description: string | null
          id: string
          priority: string | null
          request_number: string
          status: string | null
          submitted_by: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          request_number: string
          status?: string | null
          submitted_by?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          request_number?: string
          status?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "client_requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          billing_address: string | null
          city: string | null
          client_code: string
          company_name: string
          country: string | null
          created_at: string | null
          created_by: string
          currency: string | null
          default_hourly_rate: number | null
          id: string
          is_active: boolean | null
          organization_id: string | null
          payment_terms: number | null
          phone: string | null
          postal_code: string | null
          primary_contact_email: string
          state: string | null
          tax_id: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          billing_address?: string | null
          city?: string | null
          client_code: string
          company_name: string
          country?: string | null
          created_at?: string | null
          created_by?: string
          currency?: string | null
          default_hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          primary_contact_email: string
          state?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          billing_address?: string | null
          city?: string | null
          client_code?: string
          company_name?: string
          country?: string | null
          created_at?: string | null
          created_by?: string
          currency?: string | null
          default_hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          primary_contact_email?: string
          state?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string
          client_id: string | null
          created_at: string | null
          currency: string | null
          description: string
          expense_date: string
          id: string
          is_billable: boolean | null
          is_reimbursable: boolean | null
          organization_id: string | null
          project_id: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["expense_status"] | null
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category: string
          client_id?: string | null
          created_at?: string | null
          currency?: string | null
          description: string
          expense_date: string
          id?: string
          is_billable?: boolean | null
          is_reimbursable?: boolean | null
          organization_id?: string | null
          project_id?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          client_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string
          expense_date?: string
          id?: string
          is_billable?: boolean | null
          is_reimbursable?: boolean | null
          organization_id?: string | null
          project_id?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string | null
          current_value: number | null
          description: string | null
          health_status: string | null
          id: string
          target_value: number
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          health_status?: string | null
          id?: string
          target_value: number
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          health_status?: string | null
          id?: string
          target_value?: number
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          created_at: string | null
          date_worked: string | null
          description: string
          id: string
          invoice_id: string | null
          quantity: number
          rate: number
          time_log_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          date_worked?: string | null
          description: string
          id?: string
          invoice_id?: string | null
          quantity: number
          rate: number
          time_log_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          date_worked?: string | null
          description?: string
          id?: string
          invoice_id?: string | null
          quantity?: number
          rate?: number
          time_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_time_log_id_fkey"
            columns: ["time_log_id"]
            isOneToOne: false
            referencedRelation: "time_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          discount_amount: number | null
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          organization_id: string | null
          payment_date: string | null
          payment_method: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          terms_conditions: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          discount_amount?: number | null
          due_date: string
          id?: string
          invoice_number: string
          issue_date: string
          notes?: string | null
          organization_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          discount_amount?: number | null
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          organization_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      macro_tasks: {
        Row: {
          actual_hours: number | null
          billable_hours: number | null
          brain_dump_id: string | null
          client_id: string | null
          client_visible: boolean | null
          created_at: string | null
          description: string | null
          due_date: string | null
          end_time: string | null
          estimated_hours: number | null
          hourly_rate: number | null
          id: string
          is_billable: boolean | null
          is_emergency: boolean | null
          organization_id: string | null
          pause_reason: string | null
          paused_at: string | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          project_id: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_hours?: number | null
          billable_hours?: number | null
          brain_dump_id?: string | null
          client_id?: string | null
          client_visible?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          end_time?: string | null
          estimated_hours?: number | null
          hourly_rate?: number | null
          id?: string
          is_billable?: boolean | null
          is_emergency?: boolean | null
          organization_id?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          project_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_hours?: number | null
          billable_hours?: number | null
          brain_dump_id?: string | null
          client_id?: string | null
          client_visible?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          end_time?: string | null
          estimated_hours?: number | null
          hourly_rate?: number | null
          id?: string
          is_billable?: boolean | null
          is_emergency?: boolean | null
          organization_id?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          project_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "macro_tasks_brain_dump_id_fkey"
            columns: ["brain_dump_id"]
            isOneToOne: false
            referencedRelation: "brain_dumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "macro_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "macro_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "macro_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "macro_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      micro_tasks: {
        Row: {
          actual_minutes: number | null
          break_duration_minutes: number | null
          break_start: string | null
          created_at: string | null
          description: string | null
          end_time: string | null
          estimated_minutes: number | null
          id: string
          macro_task_id: string | null
          order_index: number
          start_time: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_minutes?: number | null
          break_duration_minutes?: number | null
          break_start?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          estimated_minutes?: number | null
          id?: string
          macro_task_id?: string | null
          order_index: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_minutes?: number | null
          break_duration_minutes?: number | null
          break_start?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          estimated_minutes?: number | null
          id?: string
          macro_task_id?: string | null
          order_index?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "micro_tasks_macro_task_id_fkey"
            columns: ["macro_task_id"]
            isOneToOne: false
            referencedRelation: "macro_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string | null
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          clerk_organization_id: string | null
          created_at: string | null
          created_by: string
          current_user_count: number | null
          id: string
          name: string
          settings: Json | null
          slug: string
          status: Database["public"]["Enums"]["organization_status"] | null
          updated_at: string | null
          user_limit: number | null
        }
        Insert: {
          clerk_organization_id?: string | null
          created_at?: string | null
          created_by: string
          current_user_count?: number | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["organization_status"] | null
          updated_at?: string | null
          user_limit?: number | null
        }
        Update: {
          clerk_organization_id?: string | null
          created_at?: string | null
          created_by?: string
          current_user_count?: number | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"] | null
          updated_at?: string | null
          user_limit?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          client_id: string | null
          cost_rate: number | null
          created_at: string | null
          currency: string | null
          current_organization_id: string | null
          department: string | null
          email: string
          first_name: string
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          last_name: string
          role: Database["public"]["Enums"]["user_role"] | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          client_id?: string | null
          cost_rate?: number | null
          created_at?: string | null
          currency?: string | null
          current_organization_id?: string | null
          department?: string | null
          email: string
          first_name: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          last_name: string
          role?: Database["public"]["Enums"]["user_role"] | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          client_id?: string | null
          cost_rate?: number | null
          created_at?: string | null
          currency?: string | null
          current_organization_id?: string | null
          department?: string | null
          email?: string
          first_name?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          last_name?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_members: {
        Row: {
          can_view_budget: boolean | null
          hourly_rate: number | null
          id: string
          joined_at: string | null
          project_id: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          can_view_budget?: boolean | null
          hourly_rate?: number | null
          id?: string
          joined_at?: string | null
          project_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          can_view_budget?: boolean | null
          hourly_rate?: number | null
          id?: string
          joined_at?: string | null
          project_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_team_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      projects: {
        Row: {
          billable: boolean | null
          budget: number | null
          client_id: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          end_date: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          project_code: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          updated_at: string | null
        }
        Insert: {
          billable?: boolean | null
          budget?: number | null
          client_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          project_code: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Update: {
          billable?: boolean | null
          budget?: number | null
          client_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          project_code?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string | null
          cancel_at_period_end: boolean | null
          clerk_organization_id: string | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string
          plan_name: string | null
          price_per_user: number | null
          seats_included: number | null
          seats_used: number | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string | null
        }
        Insert: {
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          clerk_organization_id?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id: string
          plan_name?: string | null
          price_per_user?: number | null
          seats_included?: number | null
          seats_used?: number | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
        }
        Update: {
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          clerk_organization_id?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string
          plan_name?: string | null
          price_per_user?: number | null
          seats_included?: number | null
          seats_used?: number | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_time_blocks: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          block_duration_minutes: number
          created_at: string | null
          id: string
          is_completed: boolean | null
          macro_task_id: string | null
          micro_task_id: string | null
          original_start: string | null
          scheduled_end: string
          scheduled_start: string
          was_rescheduled: boolean | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          block_duration_minutes: number
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          macro_task_id?: string | null
          micro_task_id?: string | null
          original_start?: string | null
          scheduled_end: string
          scheduled_start: string
          was_rescheduled?: boolean | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          block_duration_minutes?: number
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          macro_task_id?: string | null
          micro_task_id?: string | null
          original_start?: string | null
          scheduled_end?: string
          scheduled_start?: string
          was_rescheduled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "task_time_blocks_macro_task_id_fkey"
            columns: ["macro_task_id"]
            isOneToOne: false
            referencedRelation: "macro_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_time_blocks_micro_task_id_fkey"
            columns: ["micro_task_id"]
            isOneToOne: false
            referencedRelation: "micro_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      time_logs: {
        Row: {
          client_id: string | null
          created_at: string | null
          duration_minutes: number | null
          hourly_rate: number | null
          id: string
          is_billable: boolean | null
          location: string | null
          log_type: Database["public"]["Enums"]["log_type"]
          macro_task_id: string | null
          micro_task_id: string | null
          notes: string | null
          organization_id: string | null
          previous_task_id: string | null
          project_id: string | null
          timestamp: string | null
          timezone: string | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          hourly_rate?: number | null
          id?: string
          is_billable?: boolean | null
          location?: string | null
          log_type: Database["public"]["Enums"]["log_type"]
          macro_task_id?: string | null
          micro_task_id?: string | null
          notes?: string | null
          organization_id?: string | null
          previous_task_id?: string | null
          project_id?: string | null
          timestamp?: string | null
          timezone?: string | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          hourly_rate?: number | null
          id?: string
          is_billable?: boolean | null
          location?: string | null
          log_type?: Database["public"]["Enums"]["log_type"]
          macro_task_id?: string | null
          micro_task_id?: string | null
          notes?: string | null
          organization_id?: string | null
          previous_task_id?: string | null
          project_id?: string | null
          timestamp?: string | null
          timezone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_macro_task_id_fkey"
            columns: ["macro_task_id"]
            isOneToOne: false
            referencedRelation: "macro_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_micro_task_id_fkey"
            columns: ["micro_task_id"]
            isOneToOne: false
            referencedRelation: "micro_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_analytics: {
        Row: {
          break_time_minutes: number | null
          created_at: string | null
          date: string
          focus_time_minutes: number | null
          id: string
          productivity_score: number | null
          task_switches: number | null
          tasks_completed: number | null
          total_work_hours: number | null
          user_id: string
        }
        Insert: {
          break_time_minutes?: number | null
          created_at?: string | null
          date: string
          focus_time_minutes?: number | null
          id?: string
          productivity_score?: number | null
          task_switches?: number | null
          tasks_completed?: number | null
          total_work_hours?: number | null
          user_id: string
        }
        Update: {
          break_time_minutes?: number | null
          created_at?: string | null
          date?: string
          focus_time_minutes?: number | null
          id?: string
          productivity_score?: number | null
          task_switches?: number | null
          tasks_completed?: number | null
          total_work_hours?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_presence: {
        Row: {
          created_at: string | null
          current_status: string | null
          current_task_id: string | null
          id: string
          is_online: boolean | null
          last_seen: string | null
          timer_start: string | null
          timer_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_status?: string | null
          current_task_id?: string | null
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          timer_start?: string | null
          timer_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_status?: string | null
          current_task_id?: string | null
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          timer_start?: string | null
          timer_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_presence_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_client_request: {
        Args: { request_client_id: string; request_user_id: string }
        Returns: boolean
      }
      can_view_user_presence: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      check_account_lockout: {
        Args: { email_input: string }
        Returns: {
          attempts: number
          is_locked: boolean
          locked_until: string
        }[]
      }
      clear_failed_attempts: {
        Args: { email_input: string }
        Returns: undefined
      }
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_client_owner: {
        Args: { client_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_project_creator: {
        Args: { project_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_project_team_member: {
        Args: { project_uuid: string; user_uuid: string }
        Returns: boolean
      }
      log_sensitive_data_access: {
        Args: { action: string; record_id: string; table_name: string }
        Returns: undefined
      }
      record_failed_login: {
        Args: { email_input: string }
        Returns: boolean
      }
      sanitize_text_input: {
        Args: { input_text: string }
        Returns: string
      }
      sanitize_user_input: {
        Args: { input_text: string; max_length?: number }
        Returns: string
      }
      validate_email: {
        Args: { email_text: string }
        Returns: boolean
      }
      validate_password_strength: {
        Args: { password: string }
        Returns: boolean
      }
    }
    Enums: {
      access_level: "view_only" | "comment" | "approve"
      communication_type:
        | "message"
        | "file_upload"
        | "status_update"
        | "invoice_sent"
        | "payment_received"
      expense_status:
        | "pending"
        | "approved"
        | "rejected"
        | "invoiced"
        | "reimbursed"
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "paid"
        | "overdue"
        | "cancelled"
      log_type:
        | "start"
        | "pause"
        | "resume"
        | "break_start"
        | "break_end"
        | "complete"
        | "switch_task"
      organization_role: "owner" | "admin" | "member"
      organization_status: "active" | "suspended" | "cancelled"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      subscription_status:
        | "active"
        | "canceled"
        | "past_due"
        | "trialing"
        | "paused"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "not_started" | "in_progress" | "paused" | "completed"
      time_block_type:
        | "focused_work"
        | "meeting"
        | "break"
        | "admin"
        | "client_work"
      user_role: "admin" | "manager" | "employee" | "client"
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
      access_level: ["view_only", "comment", "approve"],
      communication_type: [
        "message",
        "file_upload",
        "status_update",
        "invoice_sent",
        "payment_received",
      ],
      expense_status: [
        "pending",
        "approved",
        "rejected",
        "invoiced",
        "reimbursed",
      ],
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "paid",
        "overdue",
        "cancelled",
      ],
      log_type: [
        "start",
        "pause",
        "resume",
        "break_start",
        "break_end",
        "complete",
        "switch_task",
      ],
      organization_role: ["owner", "admin", "member"],
      organization_status: ["active", "suspended", "cancelled"],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      subscription_status: [
        "active",
        "canceled",
        "past_due",
        "trialing",
        "paused",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["not_started", "in_progress", "paused", "completed"],
      time_block_type: [
        "focused_work",
        "meeting",
        "break",
        "admin",
        "client_work",
      ],
      user_role: ["admin", "manager", "employee", "client"],
    },
  },
} as const
