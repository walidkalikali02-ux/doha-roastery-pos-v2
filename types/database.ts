// Auto-generated Supabase database types
// Generated on: 2026-04-18
// Re-generate with: npx supabase gen types typescript --project-id <project-ref>

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string;
          company: string | null;
          country: string;
          country_code: string | null;
          created_at: string | null;
          first_name: string;
          id: string;
          is_default: boolean | null;
          label: string | null;
          last_name: string;
          latitude: number | null;
          longitude: number | null;
          phone: string | null;
          place_id: string | null;
          postal_code: string | null;
          state: string | null;
          street1: string;
          street2: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          city: string;
          company?: string | null;
          country?: string;
          country_code?: string | null;
          created_at?: string | null;
          first_name: string;
          id?: string;
          is_default?: boolean | null;
          label?: string | null;
          last_name: string;
          latitude?: number | null;
          longitude?: number | null;
          phone?: string | null;
          place_id?: string | null;
          postal_code?: string | null;
          state?: string | null;
          street1: string;
          street2?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          city?: string;
          company?: string | null;
          country?: string;
          country_code?: string | null;
          created_at?: string | null;
          first_name?: string;
          id?: string;
          is_default?: boolean | null;
          label?: string | null;
          last_name?: string;
          latitude?: number | null;
          longitude?: number | null;
          phone?: string | null;
          place_id?: string | null;
          postal_code?: string | null;
          state?: string | null;
          street1?: string;
          street2?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          code: string | null;
          country_of_origin: string | null;
          created_at: string | null;
          description: string | null;
          description_ar: string | null;
          id: string;
          is_active: boolean | null;
          logo_url: string | null;
          name: string;
          name_ar: string | null;
          updated_at: string | null;
        };
        Insert: {
          code?: string | null;
          country_of_origin?: string | null;
          created_at?: string | null;
          description?: string | null;
          description_ar?: string | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          name: string;
          name_ar?: string | null;
          updated_at?: string | null;
        };
        Update: {
          code?: string | null;
          country_of_origin?: string | null;
          created_at?: string | null;
          description?: string | null;
          description_ar?: string | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          name?: string;
          name_ar?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      inventory_items: {
        Row: {
          created_at: string | null;
          damaged_stock: number | null;
          id: string;
          location_id: string;
          maximum_stock: number | null;
          minimum_stock: number | null;
          product_id: string;
          reserved_stock: number | null;
          stock: number | null;
          unit: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          damaged_stock?: number | null;
          id?: string;
          location_id: string;
          maximum_stock?: number | null;
          minimum_stock?: number | null;
          product_id: string;
          reserved_stock?: number | null;
          stock?: number | null;
          unit?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          damaged_stock?: number | null;
          id?: string;
          location_id?: string;
          maximum_stock?: number | null;
          minimum_stock?: number | null;
          product_id?: string;
          reserved_stock?: number | null;
          stock?: number | null;
          unit?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          address: string | null;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          is_roastery: boolean | null;
          name: string;
          type: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_roastery?: boolean | null;
          name: string;
          type?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_roastery?: boolean | null;
          name?: string;
          type?: string | null;
        };
        Relationships: [];
      };
      product_definitions: {
        Row: {
          barcode: string | null;
          bean_origin: string | null;
          brand_id: string | null;
          category: string | null;
          cost_price: number | null;
          created_at: string | null;
          description: string | null;
          description_ar: string | null;
          has_expiry: boolean | null;
          id: string;
          image: string | null;
          is_active: boolean | null;
          is_trackable: boolean | null;
          name: string;
          name_ar: string | null;
          price: number;
          product_status: string | null;
          product_type: string | null;
          reorder_point: number | null;
          reorder_quantity: number | null;
          roast_date: string | null;
          roast_level: string | null;
          shelf_life_days: number | null;
          sku: string | null;
          supplier_id: string | null;
          type: string | null;
          updated_at: string | null;
          variant_flavor: string | null;
          variant_label: string | null;
          variant_size: string | null;
          volume_ml: number | null;
          weight_grams: number | null;
          wholesale_price: number | null;
        };
        Insert: {
          barcode?: string | null;
          bean_origin?: string | null;
          brand_id?: string | null;
          category?: string | null;
          cost_price?: number | null;
          created_at?: string | null;
          description?: string | null;
          description_ar?: string | null;
          has_expiry?: boolean | null;
          id?: string;
          image?: string | null;
          is_active?: boolean | null;
          is_trackable?: boolean | null;
          name: string;
          name_ar?: string | null;
          price: number;
          product_status?: string | null;
          product_type?: string | null;
          reorder_point?: number | null;
          reorder_quantity?: number | null;
          roast_date?: string | null;
          roast_level?: string | null;
          shelf_life_days?: number | null;
          sku?: string | null;
          supplier_id?: string | null;
          type?: string | null;
          updated_at?: string | null;
          variant_flavor?: string | null;
          variant_label?: string | null;
          variant_size?: string | null;
          volume_ml?: number | null;
          weight_grams?: number | null;
          wholesale_price?: number | null;
        };
        Update: {
          barcode?: string | null;
          bean_origin?: string | null;
          brand_id?: string | null;
          category?: string | null;
          cost_price?: number | null;
          created_at?: string | null;
          description?: string | null;
          description_ar?: string | null;
          has_expiry?: boolean | null;
          id?: string;
          image?: string | null;
          is_active?: boolean | null;
          is_trackable?: boolean | null;
          name?: string;
          name_ar?: string | null;
          price?: number;
          product_status?: string | null;
          product_type?: string | null;
          reorder_point?: number | null;
          reorder_quantity?: number | null;
          roast_date?: string | null;
          roast_level?: string | null;
          shelf_life_days?: number | null;
          sku?: string | null;
          supplier_id?: string | null;
          type?: string | null;
          updated_at?: string | null;
          variant_flavor?: string | null;
          variant_label?: string | null;
          variant_size?: string | null;
          volume_ml?: number | null;
          weight_grams?: number | null;
          wholesale_price?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          full_name: string | null;
          id: string;
          is_active: boolean | null;
          location_id: string | null;
          permissions: Json | null;
          phone: string | null;
          role: string | null;
          updated_at: string | null;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          full_name?: string | null;
          id: string;
          is_active?: boolean | null;
          location_id?: string | null;
          permissions?: Json | null;
          phone?: string | null;
          role?: string | null;
          updated_at?: string | null;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          full_name?: string | null;
          id?: string;
          is_active?: boolean | null;
          location_id?: string | null;
          permissions?: Json | null;
          phone?: string | null;
          role?: string | null;
          updated_at?: string | null;
          username?: string | null;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          branch_name: string | null;
          card_reference: string | null;
          cashier_id: string | null;
          cashier_name: string | null;
          change_amount: number | null;
          created_at: string | null;
          customer_id: string | null;
          customer_name: string | null;
          discount_amount: number | null;
          discount_percent: number | null;
          discount_type: string | null;
          id: string;
          is_returned: boolean | null;
          items: Json;
          location_id: string | null;
          payment_breakdown: Json | null;
          payment_method: string | null;
          received_amount: number | null;
          return_id: string | null;
          subtotal: number | null;
          total: number;
          user_id: string | null;
          vat_amount: number | null;
        };
        Insert: {
          branch_name?: string | null;
          card_reference?: string | null;
          cashier_id?: string | null;
          cashier_name?: string | null;
          change_amount?: number | null;
          created_at?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          discount_amount?: number | null;
          discount_percent?: number | null;
          discount_type?: string | null;
          id: string;
          is_returned?: boolean | null;
          items?: Json;
          location_id?: string | null;
          payment_breakdown?: Json | null;
          payment_method?: string | null;
          received_amount?: number | null;
          return_id?: string | null;
          subtotal?: number | null;
          total: number;
          user_id?: string | null;
          vat_amount?: number | null;
        };
        Update: {
          branch_name?: string | null;
          card_reference?: string | null;
          cashier_id?: string | null;
          cashier_name?: string | null;
          change_amount?: number | null;
          created_at?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          discount_amount?: number | null;
          discount_percent?: number | null;
          discount_type?: string | null;
          id?: string;
          is_returned?: boolean | null;
          items?: Json;
          location_id?: string | null;
          payment_breakdown?: Json | null;
          payment_method?: string | null;
          received_amount?: number | null;
          return_id?: string | null;
          subtotal?: number | null;
          total?: number;
          user_id?: string | null;
          vat_amount?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
