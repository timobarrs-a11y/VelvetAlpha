export interface CommunityBoard {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  owner_id: string;
  is_locked: boolean;
  is_pinned: boolean;
  is_approved: boolean;
  post_count: number;
  sort_order: number;
  category: string;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  board_id: string;
  author_id: string;
  title: string;
  body: string;
  image_url: string | null;
  post_smilie: string | null;
  is_ai_generated: boolean;
  is_pinned: boolean;
  is_locked: boolean;
  comment_count: number;
  reaction_count: number;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export type ReactionType = string;
export type ReactionTarget = 'post' | 'comment';

export interface CommunityReaction {
  id: string;
  user_id: string;
  target_type: ReactionTarget;
  target_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

export interface SmilieReactionAggregate {
  reaction_type: string;
  count: number;
}

export interface PostWithAuthor extends CommunityPost {
  author_name: string;
  user_reaction?: ReactionType | null;
  reaction_aggregates?: SmilieReactionAggregate[];
}

export interface CommentWithAuthor extends CommunityComment {
  author_name: string;
  user_reaction?: ReactionType | null;
  reaction_aggregates?: SmilieReactionAggregate[];
}

export interface BoardWithCounts extends CommunityBoard {
  is_owner: boolean;
}

export interface CommunityNotification {
  id: string;
  user_id: string;
  type: 'reply' | 'reaction' | 'badge' | 'weekly';
  actor_id: string | null;
  target_type: 'post' | 'comment' | null;
  target_id: string | null;
  post_id: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationWithActor extends CommunityNotification {
  actor_name: string | null;
}

export interface CommunityPoll {
  id: string;
  post_id: string;
  question: string;
  options: string[];
  expires_at: string | null;
  created_at: string;
}

export interface PollVoteResult {
  option_index: number;
  vote_count: number;
}

export interface CommunityBadge {
  key: string;
  label: string;
  description: string;
}
