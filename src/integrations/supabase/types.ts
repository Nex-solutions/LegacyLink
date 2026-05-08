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
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          email: string
          id: string
          name: string
          payout_tx_signature: string | null
          pct: number
          vault_id: string
          wallet_pubkey: string | null
        }
        Insert: {
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          payout_tx_signature?: string | null
          pct: number
          vault_id: string
          wallet_pubkey?: string | null
        }
        Update: {
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          payout_tx_signature?: string | null
          pct?: number
          vault_id?: string
          wallet_pubkey?: string | null
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
      custodial_wallet_secrets: {
        Row: {
          created_at: string
          encrypted_secret: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_secret: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_secret?: string
          user_id?: string
        }
        Relationships: []
      }
      custodial_wallets: {
        Row: {
          created_at: string
          pubkey: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pubkey: string
          user_id: string
        }
        Update: {
          created_at?: string
          pubkey?: string
          user_id?: string
        }
        Relationships: []
      }
      ledger_accounts: {
        Row: {
          code: string
          created_at: string
          currency: string
          id: string
          name: string
          type: Database["public"]["Enums"]["ledger_account_type"]
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["ledger_account_type"]
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["ledger_account_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          currency: string
          id: string
          side: string
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          currency?: string
          id?: string
          side: string
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          side?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          external_ref: string | null
          id: string
          kind: Database["public"]["Enums"]["ledger_tx_kind"]
          memo: string | null
          reference: string | null
          tx_signature: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          id?: string
          kind: Database["public"]["Enums"]["ledger_tx_kind"]
          memo?: string | null
          reference?: string | null
          tx_signature?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ledger_tx_kind"]
          memo?: string | null
          reference?: string | null
          tx_signature?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      master_wallet: {
        Row: {
          created_at: string
          created_by: string | null
          encrypted_mnemonic: string
          encrypted_secret: string
          id: boolean
          pubkey: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          encrypted_mnemonic: string
          encrypted_secret: string
          id?: boolean
          pubkey: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          encrypted_mnemonic?: string
          encrypted_secret?: string
          id?: boolean
          pubkey?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address1: string | null
          address2: string | null
          city: string | null
          created_at: string
          display_name: string | null
          dob: string | null
          first_name: string | null
          id: string
          kyc_status: string
          kyc_submitted_at: string | null
          last_name: string | null
          occupation: string | null
          paytrie_user_id: string | null
          paytrie_verification_link: string | null
          pep: boolean
          phone: string | null
          postal: string | null
          province: string | null
          solana_wallet: string | null
          tpd: boolean
          updated_at: string
        }
        Insert: {
          address1?: string | null
          address2?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          dob?: string | null
          first_name?: string | null
          id: string
          kyc_status?: string
          kyc_submitted_at?: string | null
          last_name?: string | null
          occupation?: string | null
          paytrie_user_id?: string | null
          paytrie_verification_link?: string | null
          pep?: boolean
          phone?: string | null
          postal?: string | null
          province?: string | null
          solana_wallet?: string | null
          tpd?: boolean
          updated_at?: string
        }
        Update: {
          address1?: string | null
          address2?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          dob?: string | null
          first_name?: string | null
          id?: string
          kyc_status?: string
          kyc_submitted_at?: string | null
          last_name?: string | null
          occupation?: string | null
          paytrie_user_id?: string | null
          paytrie_verification_link?: string | null
          pep?: boolean
          phone?: string | null
          postal?: string | null
          province?: string | null
          solana_wallet?: string | null
          tpd?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ramp_intents: {
        Row: {
          amount_cad: number | null
          amount_usdc: number | null
          beneficiary_email: string | null
          created_at: string
          deposit_address: string | null
          destination_wallet: string | null
          fee_cad: number | null
          id: string
          kind: Database["public"]["Enums"]["ramp_kind"]
          last_webhook: Json | null
          ledger_tx_id: string | null
          payout_tx_signature: string | null
          paytrie_rmt: string | null
          paytrie_tx_id: string | null
          quote_id: number | null
          reference: string | null
          status: string
          sweep_tx_signature: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cad?: number | null
          amount_usdc?: number | null
          beneficiary_email?: string | null
          created_at?: string
          deposit_address?: string | null
          destination_wallet?: string | null
          fee_cad?: number | null
          id?: string
          kind: Database["public"]["Enums"]["ramp_kind"]
          last_webhook?: Json | null
          ledger_tx_id?: string | null
          payout_tx_signature?: string | null
          paytrie_rmt?: string | null
          paytrie_tx_id?: string | null
          quote_id?: number | null
          reference?: string | null
          status?: string
          sweep_tx_signature?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cad?: number | null
          amount_usdc?: number | null
          beneficiary_email?: string | null
          created_at?: string
          deposit_address?: string | null
          destination_wallet?: string | null
          fee_cad?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["ramp_kind"]
          last_webhook?: Json | null
          ledger_tx_id?: string | null
          payout_tx_signature?: string | null
          paytrie_rmt?: string | null
          paytrie_tx_id?: string | null
          quote_id?: number | null
          reference?: string | null
          status?: string
          sweep_tx_signature?: string | null
          updated_at?: string
          user_id?: string | null
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
          init_tx: string | null
          last_checkin: string | null
          letter_message: string | null
          name: string
          owner_id: string
          solana_pubkey: string | null
          status: Database["public"]["Enums"]["vault_status"]
          tx_signature: string | null
          unlock_date: string | null
          updated_at: string
          usdc_ata: string | null
          vault_pda: string | null
        }
        Insert: {
          amount_cad?: number
          chain?: string | null
          condition_kind?: Database["public"]["Enums"]["condition_kind"]
          created_at?: string
          id?: string
          inactivity_days?: number | null
          init_tx?: string | null
          last_checkin?: string | null
          letter_message?: string | null
          name: string
          owner_id: string
          solana_pubkey?: string | null
          status?: Database["public"]["Enums"]["vault_status"]
          tx_signature?: string | null
          unlock_date?: string | null
          updated_at?: string
          usdc_ata?: string | null
          vault_pda?: string | null
        }
        Update: {
          amount_cad?: number
          chain?: string | null
          condition_kind?: Database["public"]["Enums"]["condition_kind"]
          created_at?: string
          id?: string
          inactivity_days?: number | null
          init_tx?: string | null
          last_checkin?: string | null
          letter_message?: string | null
          name?: string
          owner_id?: string
          solana_pubkey?: string | null
          status?: Database["public"]["Enums"]["vault_status"]
          tx_signature?: string | null
          unlock_date?: string | null
          updated_at?: string
          usdc_ata?: string | null
          vault_pda?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_advisor_role: { Args: never; Returns: undefined }
      consume_claim_token: {
        Args: { _payout_signature: string; _token: string; _vault_id: string }
        Returns: {
          amount_cad: number
          beneficiary_id: string
          email: string
          pct: number
          vault_name: string
        }[]
      }
      ensure_user_wallet_account: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ledger_account_balance: { Args: { _account_id: string }; Returns: number }
      post_ledger_transaction: {
        Args: {
          _entries: Json
          _external_ref: string
          _kind: Database["public"]["Enums"]["ledger_tx_kind"]
          _memo: string
          _reference: string
          _tx_signature: string
          _user_id: string
        }
        Returns: string
      }
      seed_demo_for_user: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "advisor" | "family" | "individual"
      condition_kind: "time" | "inactivity" | "manual"
      event_kind:
        | "fund"
        | "checkin"
        | "release"
        | "warning"
        | "beneficiary"
        | "condition_update"
      ledger_account_type:
        | "asset"
        | "liability"
        | "equity"
        | "revenue"
        | "expense"
      ledger_tx_kind:
        | "onramp_mint"
        | "sweep_to_master"
        | "payout_from_master"
        | "offramp_burn"
        | "fee"
        | "adjustment"
      ramp_kind: "onramp" | "offramp"
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
      app_role: ["admin", "advisor", "family", "individual"],
      condition_kind: ["time", "inactivity", "manual"],
      event_kind: [
        "fund",
        "checkin",
        "release",
        "warning",
        "beneficiary",
        "condition_update",
      ],
      ledger_account_type: [
        "asset",
        "liability",
        "equity",
        "revenue",
        "expense",
      ],
      ledger_tx_kind: [
        "onramp_mint",
        "sweep_to_master",
        "payout_from_master",
        "offramp_burn",
        "fee",
        "adjustment",
      ],
      ramp_kind: ["onramp", "offramp"],
      vault_status: ["pending", "active", "released", "cancelled"],
    },
  },
} as const
