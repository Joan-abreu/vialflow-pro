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
      material_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      production_batches: {
        Row: {
          batch_number: string
          completed_at: string | null
          created_at: string
          created_by: string
          current_step_id: string | null
          id: string
          pack_quantity: number | null
          quantity: number
          sale_type: string
          shipped_units: number | null
          started_at: string | null
          status: string
          updated_at: string
          vial_type_id: string
        }
        Insert: {
          batch_number: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          current_step_id?: string | null
          id?: string
          pack_quantity?: number | null
          quantity: number
          sale_type?: string
          shipped_units?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vial_type_id: string
        }
        Update: {
          batch_number?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          current_step_id?: string | null
          id?: string
          pack_quantity?: number | null
          quantity?: number
          sale_type?: string
          shipped_units?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vial_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "production_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_vial_type_id_fkey"
            columns: ["vial_type_id"]
            isOneToOne: false
            referencedRelation: "vial_types"
            referencedColumns: ["id"]
          },
        ]
      }
      production_steps: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      raw_materials: {
        Row: {
          category: string
          cost_per_unit: number | null
          created_at: string
          current_stock: number
          dimension_height_in: number | null
          dimension_length_in: number | null
          dimension_width_in: number | null
          id: string
          min_stock_level: number
          name: string
          order_index: number | null
          qty_per_box: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          cost_per_unit?: number | null
          created_at?: string
          current_stock?: number
          dimension_height_in?: number | null
          dimension_length_in?: number | null
          dimension_width_in?: number | null
          id?: string
          min_stock_level?: number
          name: string
          order_index?: number | null
          qty_per_box?: number | null
          unit: string
          updated_at?: string
        }
        Update: {
          category?: string
          cost_per_unit?: number | null
          created_at?: string
          current_stock?: number
          dimension_height_in?: number | null
          dimension_length_in?: number | null
          dimension_width_in?: number | null
          id?: string
          min_stock_level?: number
          name?: string
          order_index?: number | null
          qty_per_box?: number | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipment_boxes: {
        Row: {
          bottles_per_box: number | null
          box_number: number
          created_at: string
          dimension_height_in: number | null
          dimension_length_in: number | null
          dimension_width_in: number | null
          id: string
          packs_per_box: number | null
          shipment_id: string
          updated_at: string
          weight_lb: number | null
        }
        Insert: {
          bottles_per_box?: number | null
          box_number: number
          created_at?: string
          dimension_height_in?: number | null
          dimension_length_in?: number | null
          dimension_width_in?: number | null
          id?: string
          packs_per_box?: number | null
          shipment_id: string
          updated_at?: string
          weight_lb?: number | null
        }
        Update: {
          bottles_per_box?: number | null
          box_number?: number
          created_at?: string
          dimension_height_in?: number | null
          dimension_length_in?: number | null
          dimension_width_in?: number | null
          id?: string
          packs_per_box?: number | null
          shipment_id?: string
          updated_at?: string
          weight_lb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_boxes_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          quantity: number
          shipment_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          quantity: number
          shipment_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          quantity?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string
          delivered_at: string | null
          destination: string | null
          fba_id: string | null
          id: string
          shipment_number: string
          shipped_at: string | null
          status: string
          updated_at: string
          ups_delivery_date: string | null
          ups_tracking_number: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by: string
          delivered_at?: string | null
          destination?: string | null
          fba_id?: string | null
          id?: string
          shipment_number: string
          shipped_at?: string | null
          status?: string
          updated_at?: string
          ups_delivery_date?: string | null
          ups_tracking_number?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          destination?: string | null
          fba_id?: string | null
          id?: string
          shipment_number?: string
          shipped_at?: string | null
          status?: string
          updated_at?: string
          ups_delivery_date?: string | null
          ups_tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      units_of_measurement: {
        Row: {
          abbreviation: string
          active: boolean
          category: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          abbreviation: string
          active?: boolean
          category: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          abbreviation?: string
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      vial_types: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          size_ml: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          size_ml: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          size_ml?: number
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
