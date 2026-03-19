// ═══════════════════════════════════════════════════════════════
// PET DATABASE - Complete Pet System
// ═══════════════════════════════════════════════════════════════

const PET_DATABASE = {
  // ═══════════════════════════════════════════════════════════════
  // COMMON PETS - Easy to find
  // ═══════════════════════════════════════════════════════════════
  slime: {
    id: 'slime',
    name: 'Slime',
    rarity: 'common',
    type: 'basic',
    description: 'A cute gelatinous creature that wobbles around.',
    emoji: '🟢',
    baseStats: {
      hp: 450,
      atk: 30,
      def: 20,
      spd: 240
    },
    growthRates: {
      hp: 30,
      atk: 12,
      def: 6,
      spd: 30
    },
    abilities: [
      { level: 1, name: 'Bounce', desc: 'Small physical attack', damage: 15, type: 'physical' },
      { level: 5, name: 'Acid Spit', desc: 'Deals poison damage', damage: 20, type: 'poison', effect: { poison: 2 } },
      { level: 10, name: 'Divide', desc: 'Creates a clone to assist', damage: 0, type: 'support', effect: { summon: 'slime_clone' } }
    ],
    evolution: {
      level: 15,
      options: [
        { id: 'king_slime', name: 'King Slime', requires: { item: 'Slime Crown' } },
        { id: 'metal_slime', name: 'Metal Slime', requires: { item: 'Iron Ore', count: 10 } }
      ]
    },
    catchRate: 80, // % chance to catch
    habitat: ['dungeon_floor_1', 'forest'],
    feedItems: ['Gel', 'Water']
  },

  wolf_pup: {
    id: 'wolf_pup',
    name: 'Wolf Pup',
    rarity: 'common',
    type: 'beast',
    description: 'A young wolf with keen senses and sharp teeth.',
    emoji: '🐺',
    baseStats: {
      hp: 540,
      atk: 40,
      def: 20,
      spd: 360
    },
    growthRates: {
      hp: 36,
      atk: 18,
      def: 12,
      spd: 60
    },
    abilities: [
      { level: 1, name: 'Bite', desc: 'Quick bite attack', damage: 20, type: 'physical' },
      { level: 5, name: 'Howl', desc: 'Boosts attack power', damage: 0, type: 'support', effect: { atk_buff: 30, duration: 3 } },
      { level: 10, name: 'Pack Tactics', desc: 'Call wolf allies', damage: 25, type: 'physical', effect: { summon: 'wolf_pack' } }
    ],
    evolution: {
      level: 20,
      options: [
        { id: 'dire_wolf', name: 'Dire Wolf', requires: { bonding: 50 } },
        { id: 'frost_wolf', name: 'Frost Wolf', requires: { item: 'Ice Crystal' } }
      ]
    },
    catchRate: 70,
    habitat: ['forest', 'mountain'],
    feedItems: ['Meat', 'Bone']
  },

  fire_sprite: {
    id: 'fire_sprite',
    name: 'Fire Sprite',
    rarity: 'common',
    type: 'elemental',
    description: 'A tiny spirit of flame, playful but dangerous.',
    emoji: '🔥',
    baseStats: {
      hp: 405,
      atk: 50,
      def: 20,
      spd: 450
    },
    growthRates: {
      hp: 24,
      atk: 24,
      def: 6,
      spd: 90
    },
    abilities: [
      { level: 1, name: 'Ember', desc: 'Small fire attack', damage: 22, type: 'fire' },
      { level: 5, name: 'Flame Burst', desc: 'Burns the target', damage: 30, type: 'fire', effect: { burn: 3 } },
      { level: 10, name: 'Inferno', desc: 'Massive fire damage', damage: 50, type: 'fire', effect: { burn: 2 } }
    ],
    evolution: {
      level: 18,
      options: [
        { id: 'flame_elemental', name: 'Flame Elemental', requires: { bonding: 40 } },
        { id: 'phoenix_hatchling', name: 'Phoenix Hatchling', requires: { item: 'Phoenix Feather' } }
      ]
    },
    catchRate: 65,
    habitat: ['volcano', 'dungeon_floor_2'],
    feedItems: ['Coal', 'Fire Gem']
  },

  // ═══════════════════════════════════════════════════════════════
  // UNCOMMON PETS - Moderate rarity
  // ═══════════════════════════════════════════════════════════════
  griffin_chick: {
    id: 'griffin_chick',
    name: 'Griffin Chick',
    rarity: 'uncommon',
    type: 'mythical',
    description: 'A young griffin with eagle wings and lion courage.',
    emoji: '🦅',
    baseStats: {
      hp: 630,
      atk: 60,
      def: 40,
      spd: 540
    },
    growthRates: {
      hp: 42,
      atk: 24,
      def: 18,
      spd: 90
    },
    abilities: [
      { level: 1, name: 'Talon Strike', desc: 'Sharp claw attack', damage: 28, type: 'physical' },
      { level: 5, name: 'Dive Bomb', desc: 'High-speed aerial attack', damage: 40, type: 'physical', effect: { stun: 1 } },
      { level: 10, name: 'Screech', desc: 'Intimidate enemies', damage: 0, type: 'support', effect: { fear: 2 } },
      { level: 15, name: 'Wing Gust', desc: 'Wind damage to all', damage: 35, type: 'wind', aoe: true }
    ],
    evolution: {
      level: 25,
      options: [
        { id: 'royal_griffin', name: 'Royal Griffin', requires: { bonding: 70 } }
      ]
    },
    catchRate: 50,
    habitat: ['mountain', 'sky_tower'],
    feedItems: ['Meat', 'Fish']
  },

  shadow_cat: {
    id: 'shadow_cat',
    name: 'Shadow Cat',
    rarity: 'uncommon',
    type: 'dark',
    description: 'A feline that moves through shadows unseen.',
    emoji: '🐈‍⬛',
    baseStats: {
      hp: 495,
      atk: 70,
      def: 30,
      spd: 750
    },
    growthRates: {
      hp: 30,
      atk: 30,
      def: 12,
      spd: 120
    },
    abilities: [
      { level: 1, name: 'Shadow Claw', desc: 'Dark physical attack', damage: 30, type: 'dark' },
      { level: 5, name: 'Vanish', desc: 'Become invisible', damage: 0, type: 'support', effect: { dodge_next: true } },
      { level: 10, name: 'Night Slash', desc: 'Critical dark attack', damage: 45, type: 'dark', effect: { crit: 100 } },
      { level: 15, name: 'Shadow Realm', desc: 'Trap in darkness', damage: 35, type: 'dark', effect: { blind: 3 } }
    ],
    evolution: {
      level: 22,
      options: [
        { id: 'void_panther', name: 'Void Panther', requires: { bonding: 60, nightBattles: 20 } }
      ]
    },
    catchRate: 45,
    habitat: ['dark_forest', 'dungeon_floor_3'],
    feedItems: ['Shadow Essence', 'Meat']
  },

  thunder_lizard: {
    id: 'thunder_lizard',
    name: 'Thunder Lizard',
    rarity: 'uncommon',
    type: 'elemental',
    description: 'A lizard crackling with electrical energy.',
    emoji: '⚡',
    baseStats: {
      hp: 585,
      atk: 70,
      def: 20,
      spd: 600
    },
    growthRates: {
      hp: 36,
      atk: 30,
      def: 12,
      spd: 90
    },
    abilities: [
      { level: 1, name: 'Shock', desc: 'Electric jolt', damage: 32, type: 'lightning' },
      { level: 5, name: 'Chain Lightning', desc: 'Hits multiple targets', damage: 28, type: 'lightning', aoe: true },
      { level: 10, name: 'Thunder Wave', desc: 'Paralyze enemies', damage: 25, type: 'lightning', effect: { paralyze: 2 } },
      { level: 15, name: 'Thunderbolt', desc: 'Massive electric damage', damage: 60, type: 'lightning' }
    ],
    evolution: {
      level: 24,
      options: [
        { id: 'storm_dragon', name: 'Storm Dragon', requires: { bonding: 65, item: 'Storm Core' } }
      ]
    },
    catchRate: 48,
    habitat: ['storm_plains', 'dungeon_floor_4'],
    feedItems: ['Electric Crystal', 'Metal']
  },

  // ═══════════════════════════════════════════════════════════════
  // RARE PETS - Hard to find
  // ═══════════════════════════════════════════════════════════════
  baby_dragon: {
    id: 'baby_dragon',
    name: 'Baby Dragon',
    rarity: 'rare',
    type: 'dragon',
    description: 'A young dragon with immense potential.',
    emoji: '🐉',
    baseStats: {
      hp: 900,
      atk: 90,
      def: 60,
      spd: 450
    },
    growthRates: {
      hp: 60,
      atk: 36,
      def: 24,
      spd: 60
    },
    abilities: [
      { level: 1, name: 'Dragon Breath', desc: 'Fire breath attack', damage: 40, type: 'fire' },
      { level: 5, name: 'Wing Buffet', desc: 'Strong wind attack', damage: 35, type: 'wind' },
      { level: 10, name: 'Roar', desc: 'Terrifying roar', damage: 0, type: 'support', effect: { fear: 3, def_debuff: -20 } },
      { level: 15, name: 'Dragon Rage', desc: 'Unleash fury', damage: 70, type: 'fire', effect: { burn: 2 } },
      { level: 20, name: 'Ancient Power', desc: 'Draw on dragon heritage', damage: 55, type: 'dragon', effect: { atk_buff: 50, duration: 3 } }
    ],
    evolution: {
      level: 30,
      options: [
        { id: 'fire_dragon', name: 'Fire Dragon', requires: { bonding: 80, item: 'Dragon Heart' } },
        { id: 'ice_dragon', name: 'Ice Dragon', requires: { bonding: 80, item: 'Frozen Scale' } },
        { id: 'lightning_dragon', name: 'Lightning Dragon', requires: { bonding: 80, item: 'Storm Scale' } }
      ]
    },
    catchRate: 25,
    habitat: ['dragon_lair', 'volcano'],
    feedItems: ['Dragon Meat', 'Rare Gems']
  },

  celestial_fox: {
    id: 'celestial_fox',
    name: 'Celestial Fox',
    rarity: 'rare',
    type: 'divine',
    description: 'A mystical fox blessed by the heavens.',
    emoji: '🦊',
    baseStats: {
      hp: 720,
      atk: 80,
      def: 40,
      spd: 900
    },
    growthRates: {
      hp: 48,
      atk: 36,
      def: 18,
      spd: 150
    },
    abilities: [
      { level: 1, name: 'Mystic Flame', desc: 'Blue spirit fire', damage: 38, type: 'divine' },
      { level: 5, name: 'Illusion', desc: 'Create illusions', damage: 0, type: 'support', effect: { dodge_all: 1 } },
      { level: 10, name: 'Soul Steal', desc: 'Drain life force', damage: 45, type: 'divine', effect: { lifesteal: 50 } },
      { level: 15, name: 'Nine Tails', desc: 'Unlock true power', damage: 60, type: 'divine', effect: { multi_hit: 3 } },
      { level: 20, name: 'Divine Blessing', desc: 'Heal and empower', damage: 0, type: 'support', effect: { heal: 100, atk_buff: 40, duration: 4 } }
    ],
    evolution: {
      level: 35,
      options: [
        { id: 'nine_tail_fox', name: 'Nine-Tail Fox', requires: { bonding: 90, purity: 100 } }
      ]
    },
    catchRate: 20,
    habitat: ['sacred_shrine', 'moonlit_grove'],
    feedItems: ['Spirit Essence', 'Celestial Fruit']
  },

  frost_phoenix: {
    id: 'frost_phoenix',
    name: 'Frost Phoenix',
    rarity: 'rare',
    type: 'mythical',
    description: 'A legendary bird of ice that never dies.',
    emoji: '🦢',
    baseStats: {
      hp: 810,
      atk: 100,
      def: 50,
      spd: 840
    },
    growthRates: {
      hp: 54,
      atk: 42,
      def: 24,
      spd: 120
    },
    abilities: [
      { level: 1, name: 'Ice Shard', desc: 'Sharp ice projectile', damage: 42, type: 'ice' },
      { level: 5, name: 'Blizzard', desc: 'Freezing storm', damage: 50, type: 'ice', effect: { freeze: 2 }, aoe: true },
      { level: 10, name: 'Rebirth', desc: 'Revive from death once per battle', damage: 0, type: 'support', effect: { revive: 1 } },
      { level: 15, name: 'Absolute Zero', desc: 'Ultimate ice attack', damage: 80, type: 'ice', effect: { freeze: 1, slow: 3 } },
      { level: 20, name: 'Frozen Eternity', desc: 'Freeze time itself', damage: 70, type: 'ice', effect: { stun_all: 1 } }
    ],
    evolution: {
      level: 40,
      options: [
        { id: 'eternal_phoenix', name: 'Eternal Phoenix', requires: { bonding: 95, deaths: 3 } }
      ]
    },
    catchRate: 15,
    habitat: ['frozen_tundra', 'ice_palace'],
    feedItems: ['Ice Crystal', 'Phoenix Tears']
  },

  // ═══════════════════════════════════════════════════════════════
  // EPIC PETS - Very rare
  // ═══════════════════════════════════════════════════════════════
  chaos_golem: {
    id: 'chaos_golem',
    name: 'Chaos Golem',
    rarity: 'epic',
    type: 'construct',
    description: 'A golem forged from pure chaos energy.',
    emoji: '🗿',
    baseStats: {
      hp: 1350,
      atk: 100,
      def: 120,
      spd: 300
    },
    growthRates: {
      hp: 90,
      atk: 42,
      def: 48,
      spd: 30
    },
    abilities: [
      { level: 1, name: 'Stone Fist', desc: 'Crushing punch', damage: 50, type: 'physical' },
      { level: 5, name: 'Fortify', desc: 'Increase defense', damage: 0, type: 'support', effect: { def_buff: 60, duration: 4 } },
      { level: 10, name: 'Earthquake', desc: 'Shake the ground', damage: 65, type: 'earth', effect: { stun: 1 }, aoe: true },
      { level: 15, name: 'Chaos Pulse', desc: 'Release chaotic energy', damage: 80, type: 'chaos', effect: { random_debuff: true } },
      { level: 20, name: 'Unstoppable Force', desc: 'Ignore all defense', damage: 100, type: 'physical', effect: { penetration: 100 } }
    ],
    evolution: {
      level: 50,
      options: [
        { id: 'titan_golem', name: 'Titan Golem', requires: { bonding: 100, item: 'Titan Core' } }
      ]
    },
    catchRate: 10,
    habitat: ['chaos_realm', 'ancient_ruins'],
    feedItems: ['Chaos Shard', 'Ancient Stone']
  },

  void_serpent: {
    id: 'void_serpent',
    name: 'Void Serpent',
    rarity: 'epic',
    type: 'cosmic',
    description: 'A serpent from the void between dimensions.',
    emoji: '🐍',
    baseStats: {
      hp: 1080,
      atk: 120,
      def: 80,
      spd: 1050
    },
    growthRates: {
      hp: 72,
      atk: 48,
      def: 30,
      spd: 180
    },
    abilities: [
      { level: 1, name: 'Void Bite', desc: 'Drain existence', damage: 55, type: 'void' },
      { level: 5, name: 'Dimensional Shift', desc: 'Phase out of reality', damage: 0, type: 'support', effect: { invulnerable: 1 } },
      { level: 10, name: 'Black Hole', desc: 'Consume everything', damage: 75, type: 'void', effect: { lifesteal: 100 } },
      { level: 15, name: 'Void Coil', desc: 'Constrict in void', damage: 60, type: 'void', effect: { paralyze: 2, bleed: 3 } },
      { level: 20, name: 'Reality Collapse', desc: 'Shatter dimensions', damage: 120, type: 'void', effect: { penetration: 80 } }
    ],
    evolution: {
      level: 45,
      options: [
        { id: 'world_serpent', name: 'World Serpent', requires: { bonding: 100, cosmicKnowledge: true } }
      ]
    },
    catchRate: 8,
    habitat: ['void_rift', 'cosmic_abyss'],
    feedItems: ['Void Crystal', 'Star Dust']
  },

  // ═══════════════════════════════════════════════════════════════
  // LEGENDARY PETS - Extremely rare, unique pets
  // ═══════════════════════════════════════════════════════════════
  primordial_beast: {
    id: 'primordial_beast',
    name: 'Primordial Beast',
    rarity: 'legendary',
    type: 'ancient',
    description: 'The first beast, older than time itself.',
    emoji: '👹',
    baseStats: {
      hp: 1800,
      atk: 150,
      def: 140,
      spd: 1200
    },
    growthRates: {
      hp: 120,
      atk: 60,
      def: 54,
      spd: 210
    },
    abilities: [
      { level: 1, name: 'Primal Fury', desc: 'Unleash ancient power', damage: 80, type: 'ancient' },
      { level: 10, name: 'Time Shatter', desc: 'Break the flow of time', damage: 100, type: 'time', effect: { stun_all: 2 } },
      { level: 20, name: 'Genesis Roar', desc: 'The cry of creation', damage: 120, type: 'ancient', effect: { fear: 5, def_debuff: -50 } },
      { level: 30, name: 'World Breaker', desc: 'Destroy everything', damage: 200, type: 'ancient', effect: { penetration: 100 }, aoe: true },
      { level: 40, name: 'Primordial Ascension', desc: 'Transcend mortality', damage: 0, type: 'support', effect: { all_stats_buff: 100, duration: 5, invulnerable: 2 } }
    ],
    evolution: null, // Already at peak form
    catchRate: 1,
    habitat: ['origin_realm'],
    feedItems: ['Primordial Essence', 'Existence Shard']
  }
};

// ═══════════════════════════════════════════════════════════════
// PET FOOD DATABASE
// ═══════════════════════════════════════════════════════════════
const PET_FOOD = {
  'Gel': { bonding: 1, happiness: 2, rarity: 'common' },
  'Water': { bonding: 1, happiness: 1, rarity: 'common' },
  'Meat': { bonding: 2, happiness: 3, rarity: 'common' },
  'Bone': { bonding: 1, happiness: 2, rarity: 'common' },
  'Coal': { bonding: 2, happiness: 2, rarity: 'common' },
  'Fish': { bonding: 2, happiness: 3, rarity: 'common' },
  'Fire Gem': { bonding: 5, happiness: 5, rarity: 'uncommon' },
  'Electric Crystal': { bonding: 5, happiness: 5, rarity: 'uncommon' },
  'Metal': { bonding: 3, happiness: 2, rarity: 'uncommon' },
  'Shadow Essence': { bonding: 6, happiness: 6, rarity: 'rare' },
  'Dragon Meat': { bonding: 10, happiness: 10, rarity: 'rare' },
  'Rare Gems': { bonding: 8, happiness: 8, rarity: 'rare' },
  'Spirit Essence': { bonding: 12, happiness: 12, rarity: 'epic' },
  'Celestial Fruit': { bonding: 15, happiness: 15, rarity: 'epic' },
  'Ice Crystal': { bonding: 10, happiness: 10, rarity: 'epic' },
  'Phoenix Tears': { bonding: 20, happiness: 20, rarity: 'legendary' },
  'Chaos Shard': { bonding: 15, happiness: 15, rarity: 'epic' },
  'Ancient Stone': { bonding: 12, happiness: 10, rarity: 'epic' },
  'Void Crystal': { bonding: 18, happiness: 18, rarity: 'legendary' },
  'Star Dust': { bonding: 20, happiness: 20, rarity: 'legendary' },
  'Primordial Essence': { bonding: 30, happiness: 30, rarity: 'mythic' },
  'Existence Shard': { bonding: 25, happiness: 25, rarity: 'mythic' }
};

module.exports = {
  PET_DATABASE,
  PET_FOOD
};