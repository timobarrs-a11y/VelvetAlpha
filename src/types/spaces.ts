export type SpaceVisibility = 'open' | 'request' | 'invite' | 'private';
export type SpaceRole = 'owner' | 'mod' | 'member';

export interface MySpace {
  board_id: string; name: string; description: string | null; icon: string; color: string;
  category: string; visibility: SpaceVisibility; member_count: number; role: SpaceRole;
  unread_count: number; last_message_at: string | null;
}
export interface SpaceSuggestion {
  board_id: string; name: string; description: string | null; icon: string; color: string;
  visibility: SpaceVisibility; member_count: number; matched_interests: string[];
}
export interface SpaceRoom {
  id: string; board_id: string; name: string; topic: string | null;
  kind: 'chat' | 'announcements'; sort_order: number; last_message_at: string | null;
}
export interface RoleTag {
  id: string; name: string; color: string;
}
export interface SpaceMember {
  user_id: string; display_name: string; avatar_config: unknown; role: SpaceRole; is_bot: boolean; joined_at: string;
  tags: RoleTag[];
}
export interface RoomMessage {
  id: string; room_id: string; author_id: string | null; author_name: string; author_avatar: unknown;
  author_is_bot: boolean; body: string; reply_to_id: string | null; kind: 'user' | 'system' | 'bot';
  is_ai_generated: boolean; deleted_at: string | null; created_at: string;
}
export interface DirectorySpace {
  board_id: string; parent_board_id: string | null; name: string; description: string | null;
  icon: string; color: string; category: string; visibility: SpaceVisibility;
  member_count: number; is_member: boolean; has_pending_request: boolean; sub_space_count: number;
}
export interface JoinRequest {
  id: string; user_id: string; display_name: string; avatar_config: unknown;
  message: string | null; created_at: string;
}
export interface InvitePreview {
  board_id: string; name: string; description: string | null; icon: string; color: string;
  member_count: number; is_valid: boolean;
}
export interface InviteRow {
  code: string; board_id: string; max_uses: number | null; uses: number;
  expires_at: string | null; revoked: boolean; created_at: string;
}
