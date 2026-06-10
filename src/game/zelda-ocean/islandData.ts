import type { IslandDef } from './rpgTypes';

export const ISLANDS: IslandDef[] = [
  {
    id: 'windfall',
    name: 'Windfall Isle',
    subtitle: 'A bustling port town clings to the cliff',
    worldX: 50,
    worldY: 40,
    oceanX: -60,
    oceanZ: -50,
    color: '#e8c87a',
    dungeonColor: '#7a5c3a',
    npcs: [
      {
        id: 'merchant_linda',
        name: 'Linda',
        role: 'merchant',
        x: 120,
        y: 180,
        dialogue: [
          'Welcome, sailor! I sell only the finest wares from across the Great Sea.',
          'Heard the Temple of Wind is restless lately. You might want a sword before you go...',
        ],
        shopItems: [
          { id: 'sword_buy', name: 'Short Sword', cost: 30, type: 'sword', description: 'A trusty blade. Deals 1 damage.' },
          { id: 'shield_buy', name: 'Wooden Shield', cost: 20, type: 'shield', description: 'Block enemy attacks.' },
          { id: 'health_buy', name: 'Potion', cost: 10, type: 'health', description: 'Restores 2 hearts.' },
        ],
      },
      {
        id: 'sage_orlan',
        name: 'Orlan the Sage',
        role: 'sage',
        x: 280,
        y: 120,
        dialogue: [
          'The four temples of the Great Sea hold the keys to an ancient power.',
          'Windfall, Forsaken, Dragon Roost, and the Forbidden Woods... each sealed by a Compass Stone.',
          'Bring me all four and I will reveal the path forward.',
        ],
        questId: 'q_compass_stones',
      },
    ],
    chests: [
      { id: 'windfall_chest_1', x: 200, y: 80, contents: 'rupees_20', label: '20 Rupees' },
      { id: 'windfall_chest_2', x: 340, y: 220, contents: 'map', label: 'Island Chart' },
    ],
    dungeonRooms: [
      {
        id: 'room_entrance',
        x: 0, y: 0, width: 320, height: 240,
        doors: [{ side: 'north', toRoom: 'room_hall' }],
        enemies: [
          { id: 'bok_1', type: 'bokoblin', x: 100, y: 100, health: 2, damage: 1, speed: 60, rupeesDrop: 1 },
          { id: 'bok_2', type: 'bokoblin', x: 220, y: 140, health: 2, damage: 1, speed: 60, rupeesDrop: 1 },
        ],
        chests: [],
      },
      {
        id: 'room_hall',
        x: 0, y: -240, width: 320, height: 240,
        doors: [{ side: 'south', toRoom: 'room_entrance' }, { side: 'north', toRoom: 'room_boss', locked: true }],
        enemies: [
          { id: 'mob_1', type: 'moblin', x: 160, y: -120, health: 4, damage: 1, speed: 45, rupeesDrop: 3 },
        ],
        chests: [
          { id: 'wind_dungeon_key', x: 260, y: -60, contents: 'rupees_5', label: '5 Rupees' },
        ],
      },
      {
        id: 'room_boss',
        x: 0, y: -480, width: 320, height: 240,
        doors: [{ side: 'south', toRoom: 'room_hall' }],
        enemies: [
          { id: 'boss_gale', type: 'boss', x: 160, y: -360, health: 12, damage: 2, speed: 80, rupeesDrop: 20 },
        ],
        chests: [
          { id: 'wind_boss_chest', x: 160, y: -450, contents: 'hookshot', label: 'Hookshot' },
        ],
        isBossRoom: true,
      },
    ],
    bossName: 'Gale Phantom',
    bossType: 'boss',
    reward: 'hookshot',
    rewardLabel: 'Hookshot',
    lore: 'The Temple of Wind predates the Great Sea itself. Sailors say you can hear it howling on still nights.',
  },
  {
    id: 'forsaken',
    name: 'Forsaken Fortress',
    subtitle: 'Dark walls rise from the stormy north',
    worldX: 78,
    worldY: 18,
    oceanX: 70,
    oceanZ: -80,
    color: '#5a4a6a',
    dungeonColor: '#2a1a3a',
    requiredItem: 'sword',
    npcs: [
      {
        id: 'survivor_mako',
        name: 'Mako',
        role: 'survivor',
        x: 80,
        y: 200,
        dialogue: [
          'I barely escaped with my life. The creatures inside... they\'re not natural.',
          'If you want to get through the inner sanctum, you\'ll need to find the three skull keys.',
          'I saw one in each of the side chambers.',
        ],
      },
    ],
    chests: [
      { id: 'forsaken_chest_1', x: 260, y: 200, contents: 'rupees_20', label: '20 Rupees' },
    ],
    dungeonRooms: [
      {
        id: 'room_courtyard',
        x: 0, y: 0, width: 320, height: 240,
        doors: [{ side: 'north', toRoom: 'room_west_wing' }, { side: 'east', toRoom: 'room_east_wing' }],
        enemies: [
          { id: 'liz_1', type: 'lizalfos', x: 80, y: 80, health: 3, damage: 1, speed: 70, rupeesDrop: 2 },
          { id: 'liz_2', type: 'lizalfos', x: 240, y: 160, health: 3, damage: 1, speed: 70, rupeesDrop: 2 },
        ],
        chests: [],
      },
      {
        id: 'room_west_wing',
        x: -320, y: 0, width: 320, height: 240,
        doors: [{ side: 'east', toRoom: 'room_courtyard' }],
        enemies: [
          { id: 'mob_w1', type: 'moblin', x: -200, y: 100, health: 5, damage: 2, speed: 50, rupeesDrop: 3 },
          { id: 'mob_w2', type: 'moblin', x: -80, y: 170, health: 5, damage: 2, speed: 50, rupeesDrop: 3 },
        ],
        chests: [
          { id: 'forsaken_w_chest', x: -280, y: 50, contents: 'rupees_20', label: '20 Rupees' },
        ],
      },
      {
        id: 'room_east_wing',
        x: 320, y: 0, width: 320, height: 240,
        doors: [{ side: 'west', toRoom: 'room_courtyard' }, { side: 'north', toRoom: 'room_throne', locked: true }],
        enemies: [
          { id: 'keese_1', type: 'keese', x: 400, y: 60, health: 1, damage: 1, speed: 90, rupeesDrop: 1 },
          { id: 'keese_2', type: 'keese', x: 560, y: 120, health: 1, damage: 1, speed: 90, rupeesDrop: 1 },
          { id: 'keese_3', type: 'keese', x: 480, y: 190, health: 1, damage: 1, speed: 90, rupeesDrop: 1 },
        ],
        chests: [],
      },
      {
        id: 'room_throne',
        x: 320, y: -240, width: 320, height: 240,
        doors: [{ side: 'south', toRoom: 'room_east_wing' }],
        enemies: [
          { id: 'boss_shadow', type: 'boss', x: 480, y: -360, health: 16, damage: 2, speed: 85, rupeesDrop: 30 },
        ],
        chests: [
          { id: 'forsaken_boss_chest', x: 480, y: -440, contents: 'bow', label: 'Hero\'s Bow' },
        ],
        isBossRoom: true,
      },
    ],
    bossName: 'Shadow Knight',
    bossType: 'boss',
    reward: 'bow',
    rewardLabel: "Hero's Bow",
    lore: 'Once a great watchtower, the Fortress fell to shadow long before the Great Flood. Its keeper never left.',
  },
  {
    id: 'dragon_roost',
    name: 'Dragon Roost Isle',
    subtitle: 'Home of the sky spirit Valoo',
    worldX: 25,
    worldY: 62,
    oceanX: -80,
    oceanZ: -130,
    color: '#c04a2a',
    dungeonColor: '#7a2010',
    requiredItem: 'hookshot',
    npcs: [
      {
        id: 'quest_medli',
        name: 'Medli',
        role: 'quest_giver',
        x: 160,
        y: 190,
        dialogue: [
          'Valoo is in pain! Something deep inside the cavern is pulling on his tail...',
          'Please, help him! Take the Grappling Hook — you\'ll need it to cross the lava pits.',
          'If Valoo is freed, he will grant you a great wind.',
        ],
        questId: 'q_free_valoo',
      },
    ],
    chests: [
      { id: 'dragon_chest_1', x: 100, y: 140, contents: 'rupees_50', label: '50 Rupees' },
      { id: 'dragon_chest_2', x: 280, y: 80, contents: 'heart_piece', label: 'Heart Piece' },
    ],
    dungeonRooms: [
      {
        id: 'room_lava_entry',
        x: 0, y: 0, width: 320, height: 240,
        doors: [{ side: 'north', toRoom: 'room_lava_bridge' }],
        enemies: [
          { id: 'liz_d1', type: 'lizalfos', x: 80, y: 120, health: 4, damage: 1, speed: 75, rupeesDrop: 2 },
          { id: 'liz_d2', type: 'lizalfos', x: 240, y: 80, health: 4, damage: 1, speed: 75, rupeesDrop: 2 },
        ],
        chests: [
          { id: 'dragon_d_c1', x: 300, y: 200, contents: 'rupees_5', label: '5 Rupees' },
        ],
      },
      {
        id: 'room_lava_bridge',
        x: 0, y: -240, width: 320, height: 240,
        doors: [{ side: 'south', toRoom: 'room_lava_entry' }, { side: 'north', toRoom: 'room_valoo', locked: true }],
        enemies: [
          { id: 'mob_d1', type: 'moblin', x: 120, y: -160, health: 6, damage: 2, speed: 55, rupeesDrop: 4 },
          { id: 'mob_d2', type: 'moblin', x: 200, y: -100, health: 6, damage: 2, speed: 55, rupeesDrop: 4 },
        ],
        chests: [
          { id: 'dragon_d_c2', x: 40, y: -200, contents: 'rupees_20', label: '20 Rupees' },
        ],
      },
      {
        id: 'room_valoo',
        x: 0, y: -480, width: 320, height: 320,
        doors: [{ side: 'south', toRoom: 'room_lava_bridge' }],
        enemies: [
          { id: 'boss_gohma', type: 'boss', x: 160, y: -600, health: 20, damage: 3, speed: 65, rupeesDrop: 40 },
        ],
        chests: [
          { id: 'valoo_chest', x: 160, y: -700, contents: 'heart_piece', label: 'Heart Container' },
        ],
        isBossRoom: true,
      },
    ],
    bossName: 'Gohma',
    bossType: 'boss',
    reward: 'heart_piece',
    rewardLabel: 'Heart Container',
    lore: "Valoo's roar shakes the island to its roots. The great spirit has watched over Dragon Roost since before memory.",
  },
  {
    id: 'forbidden_woods',
    name: 'Forbidden Woods',
    subtitle: 'Twisted trees guard an ancient power',
    worldX: 52,
    worldY: 75,
    oceanX: 55,
    oceanZ: -160,
    color: '#2a6a3a',
    dungeonColor: '#142a1a',
    requiredItem: 'bow',
    requiredDungeon: 'dragon_roost',
    npcs: [
      {
        id: 'sage_makar',
        name: 'Makar',
        role: 'sage',
        x: 200,
        y: 170,
        dialogue: [
          'This forest sings a lullaby... but lately the song has turned dark.',
          'The Great Deku Tree is afraid. Something stirs in the deepest grove.',
          'Only one who bears the Hero\'s Bow can pierce the eye of evil.',
        ],
        questId: 'q_compass_stones',
      },
    ],
    chests: [
      { id: 'woods_chest_1', x: 60, y: 100, contents: 'rupees_20', label: '20 Rupees' },
      { id: 'woods_chest_2', x: 300, y: 200, contents: 'rupees_50', label: '50 Rupees' },
    ],
    dungeonRooms: [
      {
        id: 'room_grove',
        x: 0, y: 0, width: 320, height: 240,
        doors: [{ side: 'north', toRoom: 'room_deep_woods' }],
        enemies: [
          { id: 'keese_w1', type: 'keese', x: 60, y: 60, health: 1, damage: 1, speed: 95, rupeesDrop: 1 },
          { id: 'keese_w2', type: 'keese', x: 260, y: 80, health: 1, damage: 1, speed: 95, rupeesDrop: 1 },
          { id: 'mob_w_1', type: 'moblin', x: 160, y: 160, health: 7, damage: 2, speed: 50, rupeesDrop: 5 },
        ],
        chests: [],
      },
      {
        id: 'room_deep_woods',
        x: 0, y: -240, width: 320, height: 240,
        doors: [{ side: 'south', toRoom: 'room_grove' }, { side: 'east', toRoom: 'room_east_grove' }, { side: 'north', toRoom: 'room_deku', locked: true }],
        enemies: [
          { id: 'liz_w1', type: 'lizalfos', x: 80, y: -160, health: 5, damage: 2, speed: 70, rupeesDrop: 3 },
          { id: 'liz_w2', type: 'lizalfos', x: 240, y: -80, health: 5, damage: 2, speed: 70, rupeesDrop: 3 },
        ],
        chests: [
          { id: 'woods_d_c1', x: 20, y: -220, contents: 'rupees_20', label: '20 Rupees' },
        ],
      },
      {
        id: 'room_east_grove',
        x: 320, y: -240, width: 240, height: 240,
        doors: [{ side: 'west', toRoom: 'room_deep_woods' }],
        enemies: [
          { id: 'keese_e1', type: 'keese', x: 380, y: -200, health: 1, damage: 1, speed: 95, rupeesDrop: 1 },
          { id: 'keese_e2', type: 'keese', x: 500, y: -150, health: 1, damage: 1, speed: 95, rupeesDrop: 1 },
        ],
        chests: [
          { id: 'woods_d_c2', x: 520, y: -340, contents: 'rupees_50', label: '50 Rupees' },
        ],
      },
      {
        id: 'room_deku',
        x: 0, y: -480, width: 320, height: 320,
        doors: [{ side: 'south', toRoom: 'room_deep_woods' }],
        enemies: [
          { id: 'boss_kalle', type: 'boss', x: 160, y: -620, health: 24, damage: 3, speed: 55, rupeesDrop: 50 },
        ],
        chests: [
          { id: 'deku_boss_chest', x: 160, y: -720, contents: 'heart_piece', label: 'Heart Container' },
        ],
        isBossRoom: true,
      },
    ],
    bossName: 'Kalle Demos',
    bossType: 'boss',
    reward: 'heart_piece',
    rewardLabel: 'Heart Container',
    lore: 'The Deku Tree has slumbered for a hundred years. Its roots reach into the bedrock of the world.',
  },
];

export const QUESTS = [
  {
    id: 'q_compass_stones',
    title: 'The Four Compass Stones',
    description: 'Speak to the sage Orlan on Windfall Isle and discover the secret of the four temples.',
    islandId: 'windfall',
    requiredProgress: 4,
    rewardRupees: 100,
  },
  {
    id: 'q_free_valoo',
    title: 'Free the Sky Spirit',
    description: 'Enter Dragon Roost Cavern and defeat what torments the sky spirit Valoo.',
    islandId: 'dragon_roost',
    requiredProgress: 1,
    rewardRupees: 80,
  },
];
