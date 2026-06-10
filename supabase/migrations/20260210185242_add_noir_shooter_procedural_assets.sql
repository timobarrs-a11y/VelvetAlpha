/*
  # Add Noir Shooter Procedural Asset System

  1. New Tables
    - `noir_asset_definitions`
      - Defines reusable asset types (desk, chair, table, etc.)
    - `noir_asset_pairs`
      - Defines logical pairings (desk->chair, table->chairs, etc.)
    - `noir_level_landmarks`
      - Fixed positions that must stay the same (hotel lobby desk, etc.)
      
  2. Asset Types
    - Furniture: desk, chair, table, sofa, plant, cabinet, counter
    - Decorative: lamp, painting, trash_can, fire_extinguisher
    - Cover: crate, barrel, pillar, column
    
  3. Security
    - Public read access for all asset data
    - Admin-only write access
*/

-- Asset definitions table
CREATE TABLE IF NOT EXISTS noir_asset_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type text NOT NULL UNIQUE,
  width integer NOT NULL,
  height integer NOT NULL,
  is_solid boolean DEFAULT true NOT NULL,
  provides_cover boolean DEFAULT false NOT NULL,
  color text DEFAULT '#666' NOT NULL,
  category text DEFAULT 'furniture' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Asset pairing rules (desk -> chair, table -> chairs, etc.)
CREATE TABLE IF NOT EXISTS noir_asset_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_asset text REFERENCES noir_asset_definitions(asset_type) NOT NULL,
  paired_asset text REFERENCES noir_asset_definitions(asset_type) NOT NULL,
  relative_x integer DEFAULT 0 NOT NULL,
  relative_y integer DEFAULT 0 NOT NULL,
  count integer DEFAULT 1 NOT NULL,
  optional boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Fixed landmarks per level (things that don't move)
CREATE TABLE IF NOT EXISTS noir_level_landmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id text NOT NULL,
  asset_type text REFERENCES noir_asset_definitions(asset_type) NOT NULL,
  tile_x integer NOT NULL,
  tile_y integer NOT NULL,
  room_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE noir_asset_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE noir_asset_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE noir_level_landmarks ENABLE ROW LEVEL SECURITY;

-- Public read for assets
CREATE POLICY "Anyone can view asset definitions"
  ON noir_asset_definitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can view asset pairs"
  ON noir_asset_pairs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can view level landmarks"
  ON noir_level_landmarks FOR SELECT TO authenticated USING (true);

-- Seed asset definitions
INSERT INTO noir_asset_definitions (asset_type, width, height, is_solid, provides_cover, color, category) VALUES
  -- Furniture
  ('desk', 3, 2, true, true, '#4a3520', 'furniture'),
  ('office_chair', 1, 1, true, false, '#333', 'furniture'),
  ('table_small', 2, 2, true, true, '#5a4530', 'furniture'),
  ('table_large', 4, 2, true, true, '#5a4530', 'furniture'),
  ('chair', 1, 1, true, false, '#4a3520', 'furniture'),
  ('sofa', 3, 2, true, true, '#666', 'furniture'),
  ('filing_cabinet', 1, 2, true, true, '#555', 'furniture'),
  ('counter', 4, 2, true, true, '#4a3520', 'furniture'),
  ('reception_desk', 5, 3, true, true, '#3a2510', 'furniture'),
  
  -- Decorative
  ('plant_small', 1, 1, true, false, '#2d5016', 'decorative'),
  ('plant_large', 2, 2, true, false, '#2d5016', 'decorative'),
  ('lamp', 1, 1, false, false, '#ffd700', 'decorative'),
  ('trash_can', 1, 1, true, false, '#444', 'decorative'),
  ('fire_extinguisher', 1, 1, false, false, '#cc0000', 'decorative'),
  
  -- Cover objects
  ('crate', 2, 2, true, true, '#6b4423', 'cover'),
  ('barrel', 1, 1, true, true, '#555', 'cover'),
  ('pillar', 2, 2, true, true, '#888', 'cover'),
  ('column', 1, 3, true, true, '#999', 'cover'),
  ('concrete_barrier', 3, 1, true, true, '#666', 'cover')
ON CONFLICT (asset_type) DO NOTHING;

-- Seed asset pairings
INSERT INTO noir_asset_pairs (primary_asset, paired_asset, relative_x, relative_y, count, optional) VALUES
  -- Desk with chair in front
  ('desk', 'office_chair', 0, 3, 1, false),
  
  -- Small table with 2 chairs
  ('table_small', 'chair', -1, 0, 1, false),
  ('table_small', 'chair', 0, 3, 1, false),
  
  -- Large table with 4 chairs
  ('table_large', 'chair', -1, 0, 1, false),
  ('table_large', 'chair', 5, 0, 1, false),
  ('table_large', 'chair', 0, 3, 1, false),
  ('table_large', 'chair', 3, 3, 1, false),
  
  -- Reception desk with chair behind
  ('reception_desk', 'office_chair', 2, -1, 1, false),
  
  -- Decorative pairings (optional)
  ('desk', 'lamp', 0, 0, 1, true),
  ('desk', 'trash_can', 3, 0, 1, true),
  ('counter', 'plant_small', 0, 0, 1, true),
  ('sofa', 'plant_large', -2, 0, 1, true)
ON CONFLICT DO NOTHING;

-- Seed hotel lobby landmarks (fixed positions)
INSERT INTO noir_level_landmarks (level_id, asset_type, tile_x, tile_y, room_name) VALUES
  ('hotel_lobby', 'reception_desk', 15, 8, 'lobby'),
  ('hotel_lobby', 'sofa', 5, 12, 'lobby'),
  ('hotel_lobby', 'sofa', 25, 12, 'lobby'),
  ('hotel_lobby', 'plant_large', 10, 5, 'lobby'),
  ('hotel_lobby', 'plant_large', 20, 5, 'lobby')
ON CONFLICT DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_noir_asset_pairs_primary 
  ON noir_asset_pairs(primary_asset);

CREATE INDEX IF NOT EXISTS idx_noir_level_landmarks_level 
  ON noir_level_landmarks(level_id);
