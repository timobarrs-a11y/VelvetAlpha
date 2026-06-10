/*
  # Add Noir Shooter NPC Conversation System

  1. New Tables
    - `noir_conversations`
      - Defines conversation metadata (which NPC, conversation ID)
      - Links to starting node
    - `noir_conversation_nodes`
      - Individual dialogue nodes with speaker and text
      - Can have multiple choices or be terminal
    - `noir_conversation_choices`
      - Player choice options that lead to other nodes
      - Can have stat requirements (intimidation/persuasion level)
      - Can grant rewards (money, items, stat XP)
    - `noir_player_conversation_state`
      - Tracks which conversations each player has completed
      - Stores choices made and outcomes
      
  2. Conversation Features
    - Branching dialogue trees
    - Stat-based choice requirements (persuasion, intimidation)
    - Rewards for successful dialogue (money, XP, items)
    - One-time conversations (can't repeat after completion)
    
  3. Security
    - Public read access for conversation data
    - Authenticated write for player conversation state
    - RLS policies ensure players only modify their own state
*/

-- Conversations table (defines the conversation metadata)
CREATE TABLE IF NOT EXISTS noir_conversations (
  id text PRIMARY KEY,
  npc_id text NOT NULL,
  npc_name text NOT NULL,
  start_node_id text NOT NULL,
  is_repeatable boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Conversation nodes (individual dialogue beats)
CREATE TABLE IF NOT EXISTS noir_conversation_nodes (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES noir_conversations(id) ON DELETE CASCADE,
  speaker text NOT NULL,
  text text NOT NULL,
  is_terminal boolean DEFAULT false NOT NULL,
  narrator_text text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Conversation choices (player options)
CREATE TABLE IF NOT EXISTS noir_conversation_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id text NOT NULL REFERENCES noir_conversation_nodes(id) ON DELETE CASCADE,
  text text NOT NULL,
  next_node_id text REFERENCES noir_conversation_nodes(id) ON DELETE CASCADE,
  required_intimidation integer DEFAULT 0 NOT NULL,
  required_persuasion integer DEFAULT 0 NOT NULL,
  reward_money integer DEFAULT 0 NOT NULL,
  reward_intimidation_xp integer DEFAULT 0 NOT NULL,
  reward_persuasion_xp integer DEFAULT 0 NOT NULL,
  choice_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Player conversation state (tracks completion and choices)
CREATE TABLE IF NOT EXISTS noir_player_conversation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id text NOT NULL REFERENCES noir_conversations(id) ON DELETE CASCADE,
  completed boolean DEFAULT false NOT NULL,
  current_node_id text REFERENCES noir_conversation_nodes(id) ON DELETE SET NULL,
  choices_made jsonb DEFAULT '[]'::jsonb NOT NULL,
  total_money_earned integer DEFAULT 0 NOT NULL,
  total_intimidation_xp integer DEFAULT 0 NOT NULL,
  total_persuasion_xp integer DEFAULT 0 NOT NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, conversation_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_noir_conversation_nodes_conversation 
  ON noir_conversation_nodes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_noir_conversation_choices_node 
  ON noir_conversation_choices(node_id);
CREATE INDEX IF NOT EXISTS idx_noir_player_conversation_state_user 
  ON noir_player_conversation_state(user_id);
CREATE INDEX IF NOT EXISTS idx_noir_player_conversation_state_conversation 
  ON noir_player_conversation_state(conversation_id);

-- Enable RLS
ALTER TABLE noir_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE noir_conversation_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE noir_conversation_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE noir_player_conversation_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations (public read)
CREATE POLICY "Anyone can read conversations"
  ON noir_conversations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can read conversation nodes"
  ON noir_conversation_nodes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can read conversation choices"
  ON noir_conversation_choices FOR SELECT
  TO public
  USING (true);

-- RLS Policies for player state (authenticated users, own data only)
CREATE POLICY "Users can read own conversation state"
  ON noir_player_conversation_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversation state"
  ON noir_player_conversation_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversation state"
  ON noir_player_conversation_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Seed data: Hotel Lobby Receptionist conversation
INSERT INTO noir_conversations (id, npc_id, npc_name, start_node_id, is_repeatable) VALUES
  ('lobby_receptionist_1', 'lobby_receptionist', 'Night Receptionist', 'lr1_start', false)
ON CONFLICT (id) DO NOTHING;

-- Conversation nodes
INSERT INTO noir_conversation_nodes (id, conversation_id, speaker, text, is_terminal) VALUES
  ('lr1_start', 'lobby_receptionist_1', 'Receptionist', 'Can I help you, sir? We don''t usually get... guests at this hour.', false),
  ('lr1_info', 'lobby_receptionist_1', 'Receptionist', 'Room 204? That guest checked in three days ago. Paid cash. Gave a fake name, I''m sure of it. Haven''t seen them since.', false),
  ('lr1_info_follow', 'lobby_receptionist_1', 'Receptionist', 'The key? I... I can''t just hand out keys to guest rooms. That''s against policy.', false),
  ('lr1_persuade_success', 'lobby_receptionist_1', 'Receptionist', '*nervously slides the key across the desk* Alright, alright. Just... don''t tell anyone I gave you this. Room 204, third floor. Take the stairs.', true),
  ('lr1_persuade_fail', 'lobby_receptionist_1', 'Receptionist', 'I appreciate the reasoning, but I could lose my job. I can''t help you.', true),
  ('lr1_intimidate_success', 'lobby_receptionist_1', 'Receptionist', '*hands shaking* H-here! Take it! Room 204, third floor! Just... please don''t hurt me!', true),
  ('lr1_intimidate_fail', 'lobby_receptionist_1', 'Receptionist', '*backs away* I-I''m calling security!', true),
  ('lr1_leave', 'lobby_receptionist_1', 'Receptionist', 'Good luck, then. You''re on your own.', true)
ON CONFLICT (id) DO NOTHING;

-- Conversation choices
INSERT INTO noir_conversation_choices 
  (node_id, text, next_node_id, required_intimidation, required_persuasion, reward_money, reward_intimidation_xp, reward_persuasion_xp, choice_order) 
VALUES
  ('lr1_start', 'I need information about Room 204.', 'lr1_info', 0, 0, 0, 0, 0, 1),
  ('lr1_start', 'Never mind.', 'lr1_leave', 0, 0, 0, 0, 0, 2),
  
  ('lr1_info', 'I need that key. Lives are at stake.', 'lr1_info_follow', 0, 0, 0, 0, 0, 1),
  
  ('lr1_info_follow', '[Persuasion] Look, I''m trying to help someone. Please.', 'lr1_persuade_success', 0, 2, 50, 0, 25, 1),
  ('lr1_info_follow', '[Persuasion] I''ll make it worth your while.', 'lr1_persuade_fail', 0, 1, 0, 0, 10, 2),
  ('lr1_info_follow', '[Intimidation] Give me the key, or things get ugly.', 'lr1_intimidate_success', 2, 0, 0, 25, 0, 3),
  ('lr1_info_follow', '[Intimidation] I said give me the key!', 'lr1_intimidate_fail', 1, 0, 0, 10, 0, 4),
  ('lr1_info_follow', 'Forget it. I''ll find another way.', 'lr1_leave', 0, 0, 0, 0, 0, 5);