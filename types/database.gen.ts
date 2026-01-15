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
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          row_id: string
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          row_id: string
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chef_planteurs: {
        Row: {
          cni: string | null
          code: string
          contract_end: string | null
          contract_start: string | null
          cooperative_id: string
          created_at: string
          created_by: string
          departement: string | null
          id: string
          latitude: number | null
          localite: string | null
          longitude: number | null
          name: string
          phone: string | null
          quantite_max_kg: number
          region: string | null
          rejection_reason: string | null
          termination_reason: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
        }
        Insert: {
          cni?: string | null
          code: string
          contract_end?: string | null
          contract_start?: string | null
          cooperative_id: string
          created_at?: string
          created_by: string
          departement?: string | null
          id?: string
          latitude?: number | null
          localite?: string | null
          longitude?: number | null
          name: string
          phone?: string | null
          quantite_max_kg?: number
          region?: string | null
          rejection_reason?: string | null
          termination_reason?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Update: {
          cni?: string | null
          code?: string
          contract_end?: string | null
          contract_start?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string
          departement?: string | null
          id?: string
          latitude?: number | null
          localite?: string | null
          longitude?: number | null
          name?: string
          phone?: string | null
          quantite_max_kg?: number
          region?: string | null
          rejection_reason?: string | null
          termination_reason?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "chef_planteurs_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chef_planteurs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chef_planteurs_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contracts: {
        Row: {
          client_id: string
          code: string
          cooperative_id: string
          created_at: string
          created_by: string
          end_date: string
          id: string
          notes: string | null
          price_per_kg: number | null
          quantity_contracted_kg: number
          season: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          code: string
          cooperative_id: string
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          notes?: string | null
          price_per_kg?: number | null
          quantity_contracted_kg?: number
          season: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          code?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          notes?: string | null
          price_per_kg?: number | null
          quantity_contracted_kg?: number
          season?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contracts_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_shipments: {
        Row: {
          actual_arrival: string | null
          client_id: string
          code: string
          contract_id: string
          cooperative_id: string
          created_at: string
          created_by: string
          destination_port: string | null
          estimated_arrival: string | null
          id: string
          notes: string | null
          quality_grade: Database["public"]["Enums"]["quality_grade"] | null
          quantity_kg: number
          shipped_at: string
          status: string
          transport_mode: string | null
          transport_reference: string | null
          updated_at: string
        }
        Insert: {
          actual_arrival?: string | null
          client_id: string
          code: string
          contract_id: string
          cooperative_id: string
          created_at?: string
          created_by: string
          destination_port?: string | null
          estimated_arrival?: string | null
          id?: string
          notes?: string | null
          quality_grade?: Database["public"]["Enums"]["quality_grade"] | null
          quantity_kg: number
          shipped_at?: string
          status?: string
          transport_mode?: string | null
          transport_reference?: string | null
          updated_at?: string
        }
        Update: {
          actual_arrival?: string | null
          client_id?: string
          code?: string
          contract_id?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string
          destination_port?: string | null
          estimated_arrival?: string | null
          id?: string
          notes?: string | null
          quality_grade?: Database["public"]["Enums"]["quality_grade"] | null
          quantity_kg?: number
          shipped_at?: string
          status?: string
          transport_mode?: string | null
          transport_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_shipments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_shipments_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          code: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string | null
          participants: string[]
          type: Database["public"]["Enums"]["conversation_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string | null
          participants: string[]
          type?: Database["public"]["Enums"]["conversation_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string | null
          participants?: string[]
          type?: Database["public"]["Enums"]["conversation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperatives: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          name: string
          phone: string | null
          region_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          region_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          region_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cooperatives_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_aggregates: {
        Row: {
          cooperative_id: string
          id: string
          period_date: string
          total_amount_xaf: number
          total_deliveries: number
          total_weight_kg: number
          updated_at: string
        }
        Insert: {
          cooperative_id: string
          id?: string
          period_date: string
          total_amount_xaf?: number
          total_deliveries?: number
          total_weight_kg?: number
          updated_at?: string
        }
        Update: {
          cooperative_id?: string
          id?: string
          period_date?: string
          total_amount_xaf?: number
          total_deliveries?: number
          total_weight_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_aggregates_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          chef_planteur_id: string
          code: string
          cooperative_id: string
          created_at: string
          created_by: string
          delivered_at: string
          id: string
          notes: string | null
          payment_amount_paid: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          planteur_id: string
          price_per_kg: number
          quality_grade: Database["public"]["Enums"]["quality_grade"]
          total_amount: number
          updated_at: string
          warehouse_id: string
          weight_kg: number
          weight_loaded_kg: number | null
        }
        Insert: {
          chef_planteur_id: string
          code: string
          cooperative_id: string
          created_at?: string
          created_by: string
          delivered_at?: string
          id?: string
          notes?: string | null
          payment_amount_paid?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          planteur_id: string
          price_per_kg: number
          quality_grade?: Database["public"]["Enums"]["quality_grade"]
          total_amount: number
          updated_at?: string
          warehouse_id: string
          weight_kg: number
          weight_loaded_kg?: number | null
        }
        Update: {
          chef_planteur_id?: string
          code?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string
          delivered_at?: string
          id?: string
          notes?: string | null
          payment_amount_paid?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          planteur_id?: string
          price_per_kg?: number
          quality_grade?: Database["public"]["Enums"]["quality_grade"]
          total_amount?: number
          updated_at?: string
          warehouse_id?: string
          weight_kg?: number
          weight_loaded_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_chef_planteur_id_fkey"
            columns: ["chef_planteur_id"]
            isOneToOne: false
            referencedRelation: "chef_planteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_chef_planteur_id_fkey"
            columns: ["chef_planteur_id"]
            isOneToOne: false
            referencedRelation: "chef_planteurs_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_planteur_id_fkey"
            columns: ["planteur_id"]
            isOneToOne: false
            referencedRelation: "planteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_planteur_id_fkey"
            columns: ["planteur_id"]
            isOneToOne: false
            referencedRelation: "planteurs_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_code_counters: {
        Row: {
          counter: number
          date: string
        }
        Insert: {
          counter?: number
          date: string
        }
        Update: {
          counter?: number
          date?: string
        }
        Relationships: []
      }
      delivery_photos: {
        Row: {
          created_at: string
          created_by: string
          delivery_id: string
          file_name: string
          file_size: number
          id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by: string
          delivery_id: string
          file_name: string
          file_size: number
          id?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string
          delivery_id?: string
          file_name?: string
          file_size?: number
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_photos_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_code_counters: {
        Row: {
          counter: number
          month: string
        }
        Insert: {
          counter?: number
          month: string
        }
        Update: {
          counter?: number
          month?: string
        }
        Relationships: []
      }
      invoice_deliveries: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          invoice_id: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          invoice_id: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_deliveries_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_deliveries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          code: string
          cooperative_id: string
          created_at: string
          created_by: string
          id: string
          pdf_path: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          total_weight_kg: number
          updated_at: string
        }
        Insert: {
          code: string
          cooperative_id: string
          created_at?: string
          created_by: string
          id?: string
          pdf_path?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          total_weight_kg?: number
          updated_at?: string
        }
        Update: {
          code?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string
          id?: string
          pdf_path?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          total_weight_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_by: string[] | null
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_by?: string[] | null
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_by?: string[] | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          payload: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_import_files: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          cooperative_id: string
          created_at: string
          created_by: string
          failed_reason: string | null
          file_sha256: string
          file_type: string
          filename: string
          id: string
          import_status: string
          nb_applied: number | null
          nb_features: number | null
          nb_skipped_duplicates: number | null
          parse_report: Json | null
          planteur_id: string | null
          storage_url: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          cooperative_id: string
          created_at?: string
          created_by: string
          failed_reason?: string | null
          file_sha256: string
          file_type: string
          filename: string
          id?: string
          import_status?: string
          nb_applied?: number | null
          nb_features?: number | null
          nb_skipped_duplicates?: number | null
          parse_report?: Json | null
          planteur_id?: string | null
          storage_url: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string
          failed_reason?: string | null
          file_sha256?: string
          file_type?: string
          filename?: string
          id?: string
          import_status?: string
          nb_applied?: number | null
          nb_features?: number | null
          nb_skipped_duplicates?: number | null
          parse_report?: Json | null
          planteur_id?: string | null
          storage_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcel_import_files_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_import_files_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_import_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_import_files_planteur_id_fkey"
            columns: ["planteur_id"]
            isOneToOne: false
            referencedRelation: "planteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_import_files_planteur_id_fkey"
            columns: ["planteur_id"]
            isOneToOne: false
            referencedRelation: "planteurs_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelles: {
        Row: {
          centroid: unknown
          certifications: string[] | null
          code: string
          conformity_status: string
          created_at: string
          created_by: string
          feature_hash: string | null
          geometry: unknown
          id: string
          import_file_id: string | null
          is_active: boolean
          label: string | null
          planteur_id: string
          risk_flags: Json | null
          source: string
          surface_hectares: number
          updated_at: string
          village: string | null
        }
        Insert: {
          centroid: unknown
          certifications?: string[] | null
          code: string
          conformity_status?: string
          created_at?: string
          created_by: string
          feature_hash?: string | null
          geometry: unknown
          id?: string
          import_file_id?: string | null
          is_active?: boolean
          label?: string | null
          planteur_id: string
          risk_flags?: Json | null
          source?: string
          surface_hectares: number
          updated_at?: string
          village?: string | null
        }
        Update: {
          centroid?: unknown
          certifications?: string[] | null
          code?: string
          conformity_status?: string
          created_at?: string
          created_by?: string
          feature_hash?: string | null
          geometry?: unknown
          id?: string
          import_file_id?: string | null
          is_active?: boolean
          label?: string | null
          planteur_id?: string
          risk_flags?: Json | null
          source?: string
          surface_hectares?: number
          updated_at?: string
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelles_import_file_id_fkey"
            columns: ["import_file_id"]
            isOneToOne: false
            referencedRelation: "parcel_import_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelles_planteur_id_fkey"
            columns: ["planteur_id"]
            isOneToOne: false
            referencedRelation: "planteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelles_planteur_id_fkey"
            columns: ["planteur_id"]
            isOneToOne: false
            referencedRelation: "planteurs_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      planteurs: {
        Row: {
          chef_planteur_id: string
          cni: string | null
          code: string
          cooperative_id: string
          created_at: string
          created_by: string
          departement: string | null
          id: string
          is_active: boolean
          latitude: number | null
          localite: string | null
          longitude: number | null
          name: string
          phone: string | null
          region: string | null
          statut_plantation: string | null
          superficie_hectares: number | null
          updated_at: string
        }
        Insert: {
          chef_planteur_id: string
          cni?: string | null
          code: string
          cooperative_id: string
          created_at?: string
          created_by: string
          departement?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          localite?: string | null
          longitude?: number | null
          name: string
          phone?: string | null
          region?: string | null
          statut_plantation?: string | null
          superficie_hectares?: number | null
          updated_at?: string
        }
        Update: {
          chef_planteur_id?: string
          cni?: string | null
          code?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string
          departement?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          localite?: string | null
          longitude?: number | null
          name?: string
          phone?: string | null
          region?: string | null
          statut_plantation?: string | null
          superficie_hectares?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planteurs_chef_planteur_id_fkey"
            columns: ["chef_planteur_id"]
            isOneToOne: false
            referencedRelation: "chef_planteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planteurs_chef_planteur_id_fkey"
            columns: ["chef_planteur_id"]
            isOneToOne: false
            referencedRelation: "chef_planteurs_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planteurs_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planteurs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cooperative_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          password_reset_required: boolean
          phone: string | null
          region_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          cooperative_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          password_reset_required?: boolean
          phone?: string | null
          region_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          cooperative_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          password_reset_required?: boolean
          phone?: string | null
          region_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      shipment_code_counters: {
        Row: {
          counter: number
          month: string
        }
        Insert: {
          counter?: number
          month: string
        }
        Update: {
          counter?: number
          month?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      sync_processed: {
        Row: {
          idempotency_key: string
          processed_at: string
          result: Json | null
        }
        Insert: {
          idempotency_key: string
          processed_at?: string
          result?: Json | null
        }
        Update: {
          idempotency_key?: string
          processed_at?: string
          result?: Json | null
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          capacity_kg: number | null
          code: string
          cooperative_id: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          updated_at: string
        }
        Insert: {
          capacity_kg?: number | null
          code: string
          cooperative_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          capacity_kg?: number | null
          code?: string
          cooperative_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      chef_planteurs_with_stats: {
        Row: {
          cni: string | null
          code: string | null
          contract_end: string | null
          contract_start: string | null
          cooperative_id: string | null
          created_at: string | null
          created_by: string | null
          departement: string | null
          est_exploite: boolean | null
          id: string | null
          latitude: number | null
          localite: string | null
          longitude: number | null
          name: string | null
          nombre_planteurs: number | null
          phone: string | null
          pourcentage_utilise: number | null
          quantite_max_kg: number | null
          region: string | null
          rejection_reason: string | null
          restant_kg: number | null
          termination_reason: string | null
          total_limite_planteurs_kg: number | null
          total_livre_kg: number | null
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
          validation_status:
            | Database["public"]["Enums"]["validation_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "chef_planteurs_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chef_planteurs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chef_planteurs_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      planteurs_with_stats: {
        Row: {
          chef_planteur_code: string | null
          chef_planteur_id: string | null
          chef_planteur_name: string | null
          cni: string | null
          code: string | null
          cooperative_id: string | null
          created_at: string | null
          created_by: string | null
          departement: string | null
          id: string | null
          is_active: boolean | null
          latitude: number | null
          limite_production_kg: number | null
          localite: string | null
          longitude: number | null
          name: string | null
          pertes_kg: number | null
          phone: string | null
          pourcentage_pertes: number | null
          pourcentage_utilise: number | null
          region: string | null
          restant_kg: number | null
          statut_plantation: string | null
          superficie_hectares: number | null
          total_charge_kg: number | null
          total_decharge_kg: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planteurs_chef_planteur_id_fkey"
            columns: ["chef_planteur_id"]
            isOneToOne: false
            referencedRelation: "chef_planteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planteurs_chef_planteur_id_fkey"
            columns: ["chef_planteur_id"]
            isOneToOne: false
            referencedRelation: "chef_planteurs_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planteurs_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planteurs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      archive_parcelle: {
        Args: { p_id: string }
        Returns: {
          centroid_lat: number
          centroid_lng: number
          certifications: string[]
          code: string
          conformity_status: string
          created_at: string
          created_by: string
          feature_hash: string
          geometry_geojson: Json
          id: string
          import_file_id: string
          is_active: boolean
          label: string
          planteur_code: string
          planteur_cooperative_id: string
          planteur_id: string
          planteur_name: string
          risk_flags: Json
          source: string
          surface_hectares: number
          updated_at: string
          village: string
        }[]
      }
      backfill_dashboard_aggregates: {
        Args: never
        Returns: {
          cooperative_id: string
          period_date: string
          total_amount_xaf: number
          total_deliveries: number
          total_weight_kg: number
        }[]
      }
      can_access_cooperative: {
        Args: { p_cooperative_id: string }
        Returns: boolean
      }
      count_audit_logs: {
        Args: {
          p_action?: string
          p_actor_id?: string
          p_end_date?: string
          p_row_id?: string
          p_start_date?: string
          p_table_name?: string
        }
        Returns: number
      }
      create_group_conversation: {
        Args: { p_name: string; p_participant_ids: string[] }
        Returns: string
      }
      create_notification: {
        Args: {
          p_body?: string
          p_payload?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_parcelle: {
        Args: {
          p_certifications?: string[]
          p_code: string
          p_conformity_status?: string
          p_created_by?: string
          p_feature_hash?: string
          p_geometry_geojson?: string
          p_import_file_id?: string
          p_label?: string
          p_planteur_id: string
          p_risk_flags?: Json
          p_source?: string
          p_village?: string
        }
        Returns: {
          centroid_lat: number
          centroid_lng: number
          certifications: string[]
          code: string
          conformity_status: string
          created_at: string
          created_by: string
          feature_hash: string
          geometry_geojson: Json
          id: string
          import_file_id: string
          is_active: boolean
          label: string
          planteur_code: string
          planteur_cooperative_id: string
          planteur_id: string
          planteur_name: string
          risk_flags: Json
          source: string
          surface_hectares: number
          updated_at: string
          village: string
        }[]
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      generate_delivery_code: { Args: never; Returns: string }
      generate_invoice_code: { Args: never; Returns: string }
      generate_shipment_code: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_audit_logs_with_actor: {
        Args: {
          p_action?: string
          p_actor_id?: string
          p_end_date?: string
          p_limit?: number
          p_offset?: number
          p_row_id?: string
          p_start_date?: string
          p_table_name?: string
        }
        Returns: {
          action: string
          actor_email: string
          actor_id: string
          actor_name: string
          actor_type: string
          created_at: string
          id: string
          ip_address: string
          new_data: Json
          old_data: Json
          row_id: string
          table_name: string
        }[]
      }
      get_chef_planteur_stats: {
        Args: { p_chef_planteur_id: string }
        Returns: {
          is_exploited: boolean
          quantite_max_kg: number
          remaining_kg: number
          total_delivered_kg: number
          total_planteurs: number
          total_planteurs_limit_kg: number
          usage_percentage: number
        }[]
      }
      get_cooperative_managers: {
        Args: { p_cooperative_id: string }
        Returns: string[]
      }
      get_current_user_profile: {
        Args: never
        Returns: {
          cooperative_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          password_reset_required: boolean
          phone: string | null
          region_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_delivery_invoice_id: {
        Args: { p_delivery_id: string }
        Returns: string
      }
      get_or_create_direct_conversation: {
        Args: { p_other_user_id: string }
        Returns: string
      }
      get_parcelle: {
        Args: { p_id: string }
        Returns: {
          centroid_lat: number
          centroid_lng: number
          certifications: string[]
          code: string
          conformity_status: string
          created_at: string
          created_by: string
          feature_hash: string
          geometry_geojson: Json
          id: string
          import_file_id: string
          is_active: boolean
          label: string
          planteur_code: string
          planteur_cooperative_id: string
          planteur_id: string
          planteur_name: string
          risk_flags: Json
          source: string
          surface_hectares: number
          updated_at: string
          village: string
        }[]
      }
      get_planteur_production_limit: {
        Args: { p_planteur_id: string }
        Returns: number
      }
      get_planteur_stats: {
        Args: { p_planteur_id: string }
        Returns: {
          loss_percentage: number
          production_limit_kg: number
          remaining_kg: number
          total_delivered_kg: number
          total_loaded_kg: number
          total_losses_kg: number
          usage_percentage: number
        }[]
      }
      get_unread_notification_count: { Args: never; Returns: number }
      get_user_cooperative_id: { Args: never; Returns: string }
      get_user_region_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      gettransactionid: { Args: never; Returns: unknown }
      is_admin: { Args: never; Returns: boolean }
      is_agent_or_above: { Args: never; Returns: boolean }
      is_delivery_invoiced: {
        Args: { p_delivery_id: string }
        Returns: boolean
      }
      is_manager_or_above: { Args: never; Returns: boolean }
      list_parcelles: {
        Args: {
          p_bbox_max_lat?: number
          p_bbox_max_lng?: number
          p_bbox_min_lat?: number
          p_bbox_min_lng?: number
          p_certification?: string
          p_conformity_status?: string
          p_import_file_id?: string
          p_is_active?: boolean
          p_page?: number
          p_page_size?: number
          p_planteur_id?: string
          p_search?: string
          p_simplify?: boolean
          p_source?: string
          p_village?: string
        }
        Returns: {
          centroid_lat: number
          centroid_lng: number
          certifications: string[]
          code: string
          conformity_status: string
          created_at: string
          created_by: string
          feature_hash: string
          geometry_geojson: Json
          id: string
          import_file_id: string
          is_active: boolean
          label: string
          planteur_code: string
          planteur_cooperative_id: string
          planteur_id: string
          planteur_name: string
          risk_flags: Json
          source: string
          surface_hectares: number
          total_count: number
          updated_at: string
          village: string
        }[]
      }
      log_audit_entry: {
        Args: {
          p_action: string
          p_actor_id: string
          p_ip_address?: string
          p_new_data?: Json
          p_old_data?: Json
          p_row_id: string
          p_table_name: string
        }
        Returns: string
      }
      log_auth_event: {
        Args: {
          p_event_type: string
          p_ip_address?: string
          p_metadata?: Json
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: number
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      next_daily_delivery_seq: { Args: { p_date: string }; Returns: number }
      next_monthly_invoice_seq: { Args: { p_month: string }; Returns: number }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      purge_sync_processed: {
        Args: { p_days_to_keep?: number }
        Returns: number
      }
      reject_chef_planteur: {
        Args: {
          p_chef_planteur_id: string
          p_rejected_by?: string
          p_rejection_reason: string
        }
        Returns: {
          cni: string | null
          code: string
          contract_end: string | null
          contract_start: string | null
          cooperative_id: string
          created_at: string
          created_by: string
          departement: string | null
          id: string
          latitude: number | null
          localite: string | null
          longitude: number | null
          name: string
          phone: string | null
          quantite_max_kg: number
          region: string | null
          rejection_reason: string | null
          termination_reason: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
        }
        SetofOptions: {
          from: "*"
          to: "chef_planteurs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      sync_operation: {
        Args: {
          p_data: Json
          p_idempotency_key: string
          p_operation: string
          p_record_id: string
          p_table: string
        }
        Returns: Json
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_parcelle: {
        Args: {
          p_certifications?: string[]
          p_code?: string
          p_conformity_status?: string
          p_geometry_geojson?: string
          p_id: string
          p_label?: string
          p_risk_flags?: Json
          p_village?: string
        }
        Returns: {
          centroid_lat: number
          centroid_lng: number
          certifications: string[]
          code: string
          conformity_status: string
          created_at: string
          created_by: string
          feature_hash: string
          geometry_geojson: Json
          id: string
          import_file_id: string
          is_active: boolean
          label: string
          planteur_code: string
          planteur_cooperative_id: string
          planteur_id: string
          planteur_name: string
          risk_flags: Json
          source: string
          surface_hectares: number
          updated_at: string
          village: string
        }[]
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      validate_chef_planteur: {
        Args: { p_chef_planteur_id: string; p_validated_by?: string }
        Returns: {
          cni: string | null
          code: string
          contract_end: string | null
          contract_start: string | null
          cooperative_id: string
          created_at: string
          created_by: string
          departement: string | null
          id: string
          latitude: number | null
          localite: string | null
          longitude: number | null
          name: string
          phone: string | null
          quantite_max_kg: number
          region: string | null
          rejection_reason: string | null
          termination_reason: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
        }
        SetofOptions: {
          from: "*"
          to: "chef_planteurs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      audit_action: "INSERT" | "UPDATE" | "DELETE"
      conversation_type: "direct" | "group"
      invoice_status: "draft" | "sent" | "paid"
      payment_status: "pending" | "partial" | "paid"
      quality_grade: "A" | "B" | "C"
      user_role: "admin" | "manager" | "agent" | "viewer"
      validation_status: "pending" | "validated" | "rejected"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      audit_action: ["INSERT", "UPDATE", "DELETE"],
      conversation_type: ["direct", "group"],
      invoice_status: ["draft", "sent", "paid"],
      payment_status: ["pending", "partial", "paid"],
      quality_grade: ["A", "B", "C"],
      user_role: ["admin", "manager", "agent", "viewer"],
      validation_status: ["pending", "validated", "rejected"],
    },
  },
} as const


// =============================================================================
// Helper Type Exports
// =============================================================================
// These are convenience type aliases for common table row types

// Core entities
export type Profile = Tables<'profiles'>;
export type Cooperative = Tables<'cooperatives'>;
export type Planteur = Tables<'planteurs'>;
export type Delivery = Tables<'deliveries'>;
export type ChefPlanteur = Tables<'chef_planteurs'>;
export type Warehouse = Tables<'warehouses'>;
export type Invoice = Tables<'invoices'>;
export type Notification = Tables<'notifications'>;

// Messaging
export type Conversation = Tables<'conversations'>;
export type Message = Tables<'messages'>;

// Parcelles module
export type Parcelle = Tables<'parcelles'>;
export type ParcelImportFile = Tables<'parcel_import_files'>;

// Clients module
export type Client = Tables<'clients'>;
export type ClientContract = Tables<'client_contracts'>;
export type ClientShipment = Tables<'client_shipments'>;

// Push notifications
export type PushSubscription = Tables<'push_subscriptions'>;

// Enums
export type UserRole = Enums<'user_role'>;
export type PaymentStatus = Enums<'payment_status'>;
export type QualityGrade = Enums<'quality_grade'>;
export type ValidationStatus = Enums<'validation_status'>;
export type InvoiceStatus = Enums<'invoice_status'>;
export type ConversationType = Enums<'conversation_type'>;
export type AuditAction = Enums<'audit_action'>;
