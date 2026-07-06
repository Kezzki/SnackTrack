/**
 * Supabase Database types — generated from dbschema.sql + migration files.
 *
 * If you change the DB schema, regenerate this file by running:
 *   npx supabase gen types typescript --project-id ddjfrorucotaxtdxppmm > src/lib/supabase-types.ts
 * or update the type definitions below manually.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      buyer_profiles: {
        Row: {
          id: string;
          user_id: string;
          phone: string | null;
          address: string | null;
          profile_image_url: string | null;
          product_preference: string[] | null;
          delivery_max_distance_km: number | null;
          onboarding_step: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          phone?: string | null;
          address?: string | null;
          profile_image_url?: string | null;
          product_preference?: string[] | null;
          delivery_max_distance_km?: number | null;
          onboarding_step?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          phone?: string | null;
          address?: string | null;
          profile_image_url?: string | null;
          product_preference?: string[] | null;
          delivery_max_distance_km?: number | null;
          onboarding_step?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_id: string;
          quantity: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          cart_id: string;
          product_id: string;
          quantity?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          cart_id?: string;
          product_id?: string;
          quantity?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      carts: {
        Row: {
          id: string;
          buyer_id: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          buyer_id?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          buyer_id: string;
          seller_id: string;
          store_id: string | null;
          product_id: string | null;
          product_name: string | null;
          product_image: string | null;
          last_message: string | null;
          last_message_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          seller_id: string;
          store_id?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          product_image?: string | null;
          last_message?: string | null;
          last_message_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          buyer_id?: string;
          seller_id?: string;
          store_id?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          product_image?: string | null;
          last_message?: string | null;
          last_message_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          created_at: string | null;
          read_at: string | null;
          product_id: string | null;
          product_name: string | null;
          product_image: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          created_at?: string | null;
          read_at?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          product_image?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string;
          created_at?: string | null;
          read_at?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          product_image?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          is_read: boolean | null;
          action_url: string | null;
          created_at: string | null;
          image_url: string | null;
          order_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          is_read?: boolean | null;
          action_url?: string | null;
          created_at?: string | null;
          image_url?: string | null;
          order_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: string;
          is_read?: boolean | null;
          action_url?: string | null;
          created_at?: string | null;
          image_url?: string | null;
          order_id?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number | null;
          unit_price: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          quantity?: number | null;
          unit_price?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          quantity?: number | null;
          unit_price?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          buyer_id: string;
          store_id: string;
          status: string | null;
          total_amount: number | null;
          delivery_type: string | null;
          delivery_address: string | null;
          deadline: string | null;
          created_at: string | null;
          updated_at: string | null;
          delivery_proof_url: string | null;
          admin_fee: number;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          store_id: string;
          status?: string | null;
          total_amount?: number | null;
          delivery_type?: string | null;
          delivery_address?: string | null;
          deadline?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          delivery_proof_url?: string | null;
          admin_fee?: number;
        };
        Update: {
          id?: string;
          buyer_id?: string;
          store_id?: string;
          status?: string | null;
          total_amount?: number | null;
          delivery_type?: string | null;
          delivery_address?: string | null;
          deadline?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          delivery_proof_url?: string | null;
          admin_fee?: number;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          category: string | null;
          description: string | null;
          price: number | null;
          stock: number | null;
          image_url: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          rating: number | null;
          sold_count: number | null;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          category?: string | null;
          description?: string | null;
          price?: number | null;
          stock?: number | null;
          image_url?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          rating?: number | null;
          sold_count?: number | null;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          category?: string | null;
          description?: string | null;
          price?: number | null;
          stock?: number | null;
          image_url?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          rating?: number | null;
          sold_count?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          avatar_url: string | null;
          latitude: number | null;
          longitude: number | null;
          created_at: string | null;
          updated_at: string | null;
          last_seen: string | null;
          status: string;
        };
        Insert: {
          id: string;
          name?: string;
          email: string;
          avatar_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          last_seen?: string | null;
          status?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          avatar_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          last_seen?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      refund_requests: {
        Row: {
          id: string;
          order_id: string;
          buyer_id: string;
          reason: string;
          reason_detail: string | null;
          status: string;
          midtrans_refund_id: string | null;
          refund_amount: number | null;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          buyer_id: string;
          reason: string;
          reason_detail?: string | null;
          status?: string;
          midtrans_refund_id?: string | null;
          refund_amount?: number | null;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          buyer_id?: string;
          reason?: string;
          reason_detail?: string | null;
          status?: string;
          midtrans_refund_id?: string | null;
          refund_amount?: number | null;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          buyer_id: string;
          rating: number;
          comment: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          buyer_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          buyer_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      seller_balance_transactions: {
        Row: {
          id: string;
          seller_id: string;
          type: string;
          amount: number;
          status: string;
          description: string | null;
          order_id: string | null;
          payout_account_id: string | null;
          available_at: string;
          created_at: string;
          platform_fee: number;
        };
        Insert: {
          id?: string;
          seller_id: string;
          type: string;
          amount: number;
          status?: string;
          description?: string | null;
          order_id?: string | null;
          payout_account_id?: string | null;
          available_at?: string;
          created_at?: string;
          platform_fee?: number;
        };
        Update: {
          id?: string;
          seller_id?: string;
          type?: string;
          amount?: number;
          status?: string;
          description?: string | null;
          order_id?: string | null;
          payout_account_id?: string | null;
          available_at?: string;
          created_at?: string;
          platform_fee?: number;
        };
        Relationships: [];
      };
      seller_payout_accounts: {
        Row: {
          id: string;
          seller_id: string;
          type: string;
          provider: string;
          account_number: string;
          account_name: string;
          is_main: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          type: string;
          provider: string;
          account_number: string;
          account_name: string;
          is_main?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          seller_id?: string;
          type?: string;
          provider?: string;
          account_number?: string;
          account_name?: string;
          is_main?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seller_profiles: {
        Row: {
          id: string;
          user_id: string;
          shop_telephone: string | null;
          delivery_method: string | null;
          bank_name: string | null;
          bank_account_number: string | null;
          ewallet_provider: string | null;
          ewallet_number: string | null;
          onboarding_step: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          shop_telephone?: string | null;
          delivery_method?: string | null;
          bank_name?: string | null;
          bank_account_number?: string | null;
          ewallet_provider?: string | null;
          ewallet_number?: string | null;
          onboarding_step?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          shop_telephone?: string | null;
          delivery_method?: string | null;
          bank_name?: string | null;
          bank_account_number?: string | null;
          ewallet_provider?: string | null;
          ewallet_number?: string | null;
          onboarding_step?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          seller_id: string;
          name: string;
          description: string | null;
          address: string | null;
          image_url: string | null;
          latitude: number | null;
          longitude: number | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          banner_url: string | null;
          rating: number | null;
        };
        Insert: {
          id?: string;
          seller_id: string;
          name: string;
          description?: string | null;
          address?: string | null;
          image_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          banner_url?: string | null;
          rating?: number | null;
        };
        Update: {
          id?: string;
          seller_id?: string;
          name?: string;
          description?: string | null;
          address?: string | null;
          image_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          banner_url?: string | null;
          rating?: number | null;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          order_id: string;
          buyer_id: string;
          seller_id: string;
          payment_method: string | null;
          payment_status: string | null;
          amount: number | null;
          transaction_date: string | null;
          created_at: string | null;
          updated_at: string | null;
          duitku_reference: string | null;
          duitku_payment_url: string | null;
          payment_code: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          buyer_id: string;
          seller_id: string;
          payment_method?: string | null;
          payment_status?: string | null;
          amount?: number | null;
          transaction_date?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          duitku_reference?: string | null;
          duitku_payment_url?: string | null;
          payment_code?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          buyer_id?: string;
          seller_id?: string;
          payment_method?: string | null;
          payment_status?: string | null;
          amount?: number | null;
          transaction_date?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          duitku_reference?: string | null;
          duitku_payment_url?: string | null;
          payment_code?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      decrement_stock: {
        Args: {
          p_product_id: string;
          p_amount: number;
        };
        Returns: void;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
