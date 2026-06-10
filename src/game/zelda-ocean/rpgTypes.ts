export type GameLayer = 'OCEAN' | 'ISLAND' | 'DUNGEON' | 'WORLD_MAP';

export interface RPGSave {
  rupeeWallet: number;
  maxHealth: number;
  currentHealth: number;
  hasSword: boolean;
  hasShield: boolean;
  hasHookshot: boolean;
  hasBow: boolean;
  discoveredIslands: string[];
  totalEnemiesDefeated: number;
  totalDungeonsCleared: number;
}

export interface IslandProgress {
  islandId: string;
  dungeonCleared: boolean;
  chestsOpened: string[];
  npcsMet: string[];
  dungeonAttempts: number;
  firstVisitedAt: string | null;
  clearedAt: string | null;
}

export type NpcRole = 'merchant' | 'sage' | 'quest_giver' | 'survivor';

export interface NpcDef {
  id: string;
  name: string;
  role: NpcRole;
  x: number;
  y: number;
  dialogue: string[];
  questId?: string;
  shopItems?: ShopItem[];
}

export interface ShopItem {
  id: string;
  name: string;
  cost: number;
  type: 'rupees' | 'health' | 'sword' | 'shield' | 'hookshot' | 'bow';
  description: string;
}

export interface ChestDef {
  id: string;
  x: number;
  y: number;
  contents: 'rupees_5' | 'rupees_20' | 'rupees_50' | 'heart_piece' | 'sword' | 'shield' | 'hookshot' | 'bow' | 'map';
  label: string;
}

export interface EnemyDef {
  id: string;
  type: 'bokoblin' | 'moblin' | 'keese' | 'lizalfos' | 'boss';
  x: number;
  y: number;
  health: number;
  damage: number;
  speed: number;
  rupeesDrop: number;
}

export interface RoomDef {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  doors: Array<{ side: 'north' | 'south' | 'east' | 'west'; toRoom: string; locked?: boolean }>;
  enemies: EnemyDef[];
  chests: ChestDef[];
  isBossRoom?: boolean;
}

export interface IslandDef {
  id: string;
  name: string;
  subtitle: string;
  worldX: number;
  worldY: number;
  oceanX: number;
  oceanZ: number;
  color: string;
  dungeonColor: string;
  requiredItem?: 'sword' | 'shield' | 'hookshot' | 'bow';
  requiredDungeon?: string;
  npcs: NpcDef[];
  chests: ChestDef[];
  dungeonRooms: RoomDef[];
  bossName: string;
  bossType: EnemyDef['type'];
  reward: ChestDef['contents'];
  rewardLabel: string;
  lore: string;
}

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  islandId?: string;
  requiredProgress: number;
  rewardRupees: number;
}

export interface DungeonRunResult {
  completed: boolean;
  enemiesDefeated: number;
  chestsOpened: number;
  damageTaken: number;
  timeSeconds: number;
  rupeesFound: number;
  itemFound?: string;
}

export interface IslandEngineCallbacks {
  onExitIsland: () => void;
  onEnterDungeon: () => void;
  onNpcTalk: (npc: NpcDef) => void;
  onChestOpen: (chest: ChestDef) => void;
  onHealthChange: (current: number, max: number) => void;
}

export interface DungeonEngineCallbacks {
  onExit: () => void;
  onComplete: (result: DungeonRunResult) => void;
  onHealthChange: (current: number, max: number) => void;
  onEnemyKilled: (rupeesDrop: number) => void;
  onChestOpen: (chest: ChestDef) => void;
}
