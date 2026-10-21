export type SpaceVisibility = 'open' | 'private';
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
export interface SpaceMember {
  user_id: string; display_name: string; avatar_config: unknown; role: SpaceRole; is_bot: boolean; joined_at: string;
}
export interface RoomMessage {
  id: string; room_id: string; author_id: string | null; author_name: string; author_avatar: unknown;
  author_is_bot: boolean; body: string; reply_to_id: string | null; kind: 'user' | 'system' | 'bot';
  is_ai_generated: boolean; deleted_at: string | null; created_at: string;
}
