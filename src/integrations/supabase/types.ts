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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      access_pins: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          label: string | null
          pin_hash: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          label?: string | null
          pin_hash: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          label?: string | null
          pin_hash?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          important: boolean
          title: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          important?: boolean
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          important?: boolean
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          company_name: string
          id: number
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string
          id?: number
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          id?: number
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string
          link: string | null
          title: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url: string
          link?: string | null
          title?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string
          link?: string | null
          title?: string | null
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          image_url: string | null
          kind: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          image_url?: string | null
          kind: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string | null
          kind?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body?: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          is_admin: boolean
          joined_at: string
          last_read_at: string
          muted: boolean
          pinned: boolean
          user_id: string
        }
        Insert: {
          conversation_id: string
          is_admin?: boolean
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          pinned?: boolean
          user_id: string
        }
        Update: {
          conversation_id?: string
          is_admin?: boolean
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          pinned?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dav_alert_deliveries: {
        Row: {
          dav_id: string
          delivered_at: string
          id: string
          user_id: string
        }
        Insert: {
          dav_id: string
          delivered_at?: string
          id?: string
          user_id: string
        }
        Update: {
          dav_id?: string
          delivered_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dav_alert_deliveries_dav_id_fkey"
            columns: ["dav_id"]
            isOneToOne: false
            referencedRelation: "davs"
            referencedColumns: ["id"]
          },
        ]
      }
      dav_attachments: {
        Row: {
          created_at: string
          dav_id: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          dav_id: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          dav_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "dav_attachments_dav_id_fkey"
            columns: ["dav_id"]
            isOneToOne: false
            referencedRelation: "davs"
            referencedColumns: ["id"]
          },
        ]
      }
      davs: {
        Row: {
          client_name: string
          created_at: string
          created_by: string
          dav_number: string
          description: string
          due_at: string
          id: string
          seller_id: string
          status: Database["public"]["Enums"]["dav_status"]
          updated_at: string
        }
        Insert: {
          client_name: string
          created_at?: string
          created_by: string
          dav_number: string
          description?: string
          due_at: string
          id?: string
          seller_id: string
          status?: Database["public"]["Enums"]["dav_status"]
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          created_by?: string
          dav_number?: string
          description?: string
          due_at?: string
          id?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["dav_status"]
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          file_name: string | null
          file_path: string
          file_size: number | null
          id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_name?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      firebase_push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          link: string | null
          location: string | null
          organizer_id: string | null
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          link?: string | null
          location?: string | null
          organizer_id?: string | null
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          link?: string | null
          location?: string | null
          organizer_id?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          dav_push_enabled: boolean
          presence_sound_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          dav_push_enabled?: boolean
          presence_sound_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          dav_push_enabled?: boolean
          presence_sound_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          id: string
          name: string
          permissions: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          permissions?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          permissions?: string[]
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          image_url: string | null
          title: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          approved: boolean
          avatar_url: string | null
          created_at: string
          department_id: string | null
          description: string | null
          email: string | null
          extension: string | null
          full_name: string
          id: string
          joined_at: string | null
          last_seen_at: string | null
          phone: string | null
          position_id: string | null
          status: Database["public"]["Enums"]["user_status"]
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          approved?: boolean
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          email?: string | null
          extension?: string | null
          full_name?: string
          id: string
          joined_at?: string | null
          last_seen_at?: string | null
          phone?: string | null
          position_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          approved?: boolean
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          email?: string | null
          extension?: string | null
          full_name?: string
          id?: string
          joined_at?: string | null
          last_seen_at?: string | null
          phone?: string | null
          position_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
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
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduler_tokens: {
        Row: {
          name: string
          token: string
        }
        Insert: {
          name: string
          token?: string
        }
        Update: {
          name?: string
          token?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_delete_davs: { Args: { _user_id: string }; Returns: boolean }
      create_access_pin: { Args: { _label: string }; Returns: string }
      create_chat_conversation: {
        Args: { _kind: string; _members: string[]; _name: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chat_admin: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_chat_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      redeem_access_pin: { Args: { _pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "diretor" | "gerente" | "funcionario"
      dav_status: "aberto" | "em_andamento" | "concluido" | "cancelado"
      user_status: "online" | "offline" | "ausente" | "ocupado"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "diretor", "gerente", "funcionario"],
      dav_status: ["aberto", "em_andamento", "concluido", "cancelado"],
      user_status: ["online", "offline", "ausente", "ocupado"],
    },
  },
} as const
