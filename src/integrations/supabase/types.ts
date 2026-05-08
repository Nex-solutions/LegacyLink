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
      advisor_clients: {
        Row: {
          advisor_id: string
          client_id: string
          created_at: string
          id: string
        }
        Insert: {
          advisor_id: string
          client_id: string
          created_at?: string
          id?: string
        }
        Update: {
          advisor_id?: string
          client_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      beneficiaries: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          payout_tx_signature: string | null
          pct: number
          vault_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          payout_tx_signature?: string | null
          pct: number
          vault_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          payout_tx_signature?: string | null
          pct?: number
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiaries_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          solana_wallet: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          solana_wallet?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          solana_wallet?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vault_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string | null
          id: string
          kind: Database["public"]["Enums"]["event_kind"]
          tx_signature: string | null
          vault_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind: Database["public"]["Enums"]["event_kind"]
          tx_signature?: string | null
          vault_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["event_kind"]
          tx_signature?: string | null
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_events_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      vaults: {
        Row: {
          amount_cad: number
          chain: string | null
          condition_kind: Database["public"]["Enums"]["condition_kind"]
          created_at: string
          id: string
          inactivity_days: number | null
          last_checkin: string | null
          name: string
          owner_id: string
          solana_pubkey: string | null
          status: Database["public"]["Enums"]["vault_status"]
          tx_signature: string | null
          unlock_date: string | null
          updated_at: string
        }
        Insert: {
          amount_cad?: number
          chain?: string | null
          condition_kind?: Database["public"]["Enums"]["condition_kind"]
          created_at?: string
          id?: string
          inactivity_days?: number | null
          last_checkin?: string | null
          name: string
          owner_id: string
          solana_pubkey?: string | null
          status?: Database["public"]["Enums"]["vault_status"]
          tx_signature?: string | null
          unlock_date?: string | null
          updated_at?: string
        }
        Update: {
          amount_cad?: number
          chain?: string | null
          condition_kind?: Database["public"]["Enums"]["condition_kind"]
          created_at?: string
          id?: string
          inactivity_days?: number | null
          last_checkin?: string | null
          name?: string
          owner_id?: string
          solana_pubkey?: string | null
          status?: Database["public"]["Enums"]["vault_status"]
          tx_signature?: string | null
          unlock_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "advisor" | "family"
      condition_kind: "time" | "inactivity" | "manual"
      event_kind:
        | "fund"
        | "checkin"
        | "release"
        | "warning"
        | "beneficiary"
        | "condition_update"
      vault_status: "pending" | "active" | "released" | "cancelled"
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
      app_role: ["admin", "advisor", "family"],
      condition_kind: ["time", "inactivity", "manual"],
      event_kind: [
        "fund",
        "checkin",
        "release",
        "warning",
        "beneficiary",
        "condition_update",
      ],
      vault_status: ["pending", "active", "released", "cancelled"],
    },
  },
} as const
