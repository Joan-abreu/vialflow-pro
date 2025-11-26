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
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          price_at_time: number
          product_id: string | null
          quantity: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          price_at_time?: number
          product_id?: string | null
          quantity?: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          price_at_time?: number
          product_id?: string | null
          quantity?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          shipping_address: Json | null
          status: string
          total_amount: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          shipping_address?: Json | null
          status?: string
          total_amount?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          shipping_address?: Json | null
          status?: string
          total_amount?: number
          user_id?: string | null
        }
        Relationships: []
      }
      product_materials: {
        Row: {
          created_at: string
          id: string
          material_id: string
          product_id: string
          quantity_per_unit: number
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          product_id: string
          quantity_per_unit: number
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          product_id?: string
          quantity_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_published: boolean
          pack_size: number
          price: number
          product_id: string
          sku: string | null
          stock_quantity: number
          updated_at: string
          vial_type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          pack_size?: number
          price: number
          product_id: string
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
          vial_type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          pack_size?: number
          price?: number
          product_id?: string
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
          vial_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_vial_type_id_fkey"
            columns: ["vial_type_id"]
            isOneToOne: false
            referencedRelation: "vial_types"
            referencedColumns: ["id"]
          },
        ]
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
          product_id: string | null
          quantity: number
          sale_type: string
          shipped_units: number | null
          started_at: string | null
          status: string
          units_in_progress: number | null
          updated_at: string
          waste_notes: string | null
          waste_quantity: number | null
        }
        Insert: {
          batch_number: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          current_step_id?: string | null
          id?: string
          pack_quantity?: number | null
          product_id?: string | null
          quantity: number
          sale_type?: string
          shipped_units?: number | null
          started_at?: string | null
          status?: string
          units_in_progress?: number | null
          updated_at?: string
          waste_notes?: string | null
          waste_quantity?: number | null
        }
        Update: {
          batch_number?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          current_step_id?: string | null
          id?: string
          pack_quantity?: number | null
          product_id?: string | null
          quantity?: number
          sale_type?: string
          shipped_units?: number | null
          started_at?: string | null
          status?: string
          units_in_progress?: number | null
          updated_at?: string
          waste_notes?: string | null
          waste_quantity?: number | null
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
            foreignKeyName: "production_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_configurations: {
        Row: {
          application_type: string
          calculation_type: string | null
          created_at: string
          id: string
          notes: string | null
          percentage_of_material_id: string | null
          percentage_value: number | null
          product_id: string
          quantity_per_unit: number
          raw_material_id: string
          updated_at: string
          vial_type_id: string
        }
        Insert: {
          application_type?: string
          calculation_type?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          percentage_of_material_id?: string | null
          percentage_value?: number | null
          product_id: string
          quantity_per_unit?: number
          raw_material_id: string
          updated_at?: string
          vial_type_id: string
        }
        Update: {
          application_type?: string
          calculation_type?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          percentage_of_material_id?: string | null
          percentage_value?: number | null
          product_id?: string
          quantity_per_unit?: number
          raw_material_id?: string
          updated_at?: string
          vial_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_configurations_percentage_of_material_id_fkey"
            columns: ["percentage_of_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_configurations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_configurations_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_configurations_vial_type_id_fkey"
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
      products: {
        Row: {
          category: string | null
          created_at: string
          default_pack_size: number | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_published: boolean | null
          name: string
          price: number | null
          sale_type: string
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_pack_size?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_published?: boolean | null
          name: string
          price?: number | null
          sale_type?: string
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_pack_size?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_published?: boolean | null
          name?: string
          price?: number | null
          sale_type?: string
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
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
          purchase_unit_id: string | null
          qty_per_box: number | null
          qty_per_container: number | null
          unit: string
          updated_at: string
          usage_unit_id: string | null
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
          purchase_unit_id?: string | null
          qty_per_box?: number | null
          qty_per_container?: number | null
          unit: string
          updated_at?: string
          usage_unit_id?: string | null
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
          purchase_unit_id?: string | null
          qty_per_box?: number | null
          qty_per_container?: number | null
          unit?: string
          updated_at?: string
          usage_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_purchase_unit_id_fkey"
            columns: ["purchase_unit_id"]
            isOneToOne: false
            referencedRelation: "units_of_measurement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_usage_unit_id_fkey"
            columns: ["usage_unit_id"]
            isOneToOne: false
            referencedRelation: "units_of_measurement"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_boxes: {
        Row: {
          bottles_per_box: number | null
          box_number: number
          created_at: string
          destination: string | null
          dimension_height_in: number | null
          dimension_length_in: number | null
          dimension_width_in: number | null
          fba_id: string | null
          id: string
          packs_per_box: number | null
          shipment_id: string
          updated_at: string
          ups_tracking_number: string | null
          weight_lb: number | null
        }
        Insert: {
          bottles_per_box?: number | null
          box_number: number
          created_at?: string
          destination?: string | null
          dimension_height_in?: number | null
          dimension_length_in?: number | null
          dimension_width_in?: number | null
          fba_id?: string | null
          id?: string
          packs_per_box?: number | null
          shipment_id: string
          updated_at?: string
          ups_tracking_number?: string | null
          weight_lb?: number | null
        }
        Update: {
          bottles_per_box?: number | null
          box_number?: number
          created_at?: string
          destination?: string | null
          dimension_height_in?: number | null
          dimension_length_in?: number | null
          dimension_width_in?: number | null
          fba_id?: string | null
          id?: string
          packs_per_box?: number | null
          shipment_id?: string
          updated_at?: string
          ups_tracking_number?: string | null
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
          id: string
          shipment_number: string
          shipped_at: string | null
          status: string
          updated_at: string
          ups_delivery_date: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by: string
          delivered_at?: string | null
          id?: string
          shipment_number: string
          shipped_at?: string | null
          status?: string
          updated_at?: string
          ups_delivery_date?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          id?: string
          shipment_number?: string
          shipped_at?: string | null
          status?: string
          updated_at?: string
          ups_delivery_date?: string | null
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
          base_unit_id: string | null
          category: string
          conversion_to_base: number | null
          created_at: string
          id: string
          is_base_unit: boolean | null
          name: string
        }
        Insert: {
          abbreviation: string
          active?: boolean
          base_unit_id?: string | null
          category: string
          conversion_to_base?: number | null
          created_at?: string
          id?: string
          is_base_unit?: boolean | null
          name: string
        }
        Update: {
          abbreviation?: string
          active?: boolean
          base_unit_id?: string | null
          category?: string
          conversion_to_base?: number | null
          created_at?: string
          id?: string
          is_base_unit?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_of_measurement_base_unit_id_fkey"
            columns: ["base_unit_id"]
            isOneToOne: false
            referencedRelation: "units_of_measurement"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vial_type_materials: {
        Row: {
          application_type: string
          created_at: string
          id: string
          notes: string | null
          quantity_per_unit: number
          raw_material_id: string
          updated_at: string
          vial_type_id: string
        }
        Insert: {
          application_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity_per_unit?: number
          raw_material_id: string
          updated_at?: string
          vial_type_id: string
        }
        Update: {
          application_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity_per_unit?: number
          raw_material_id?: string
          updated_at?: string
          vial_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vial_type_materials_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vial_type_materials_vial_type_id_fkey"
            columns: ["vial_type_id"]
            isOneToOne: false
            referencedRelation: "vial_types"
            referencedColumns: ["id"]
          },
        ]
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
      convert_units: {
        Args: { amount: number; from_unit_id: string; to_unit_id: string }
        Returns: number
      }
      get_material_stock_in_usage_units: {
        Args: { material_id: string }
        Returns: number
      }
      has_active_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "staff" | "pending"
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
      app_role: ["admin", "manager", "staff", "pending"],
    },
  },
} as const
