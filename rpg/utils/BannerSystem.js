// ═══════════════════════════════════════════════════════════════
// BANNER SYSTEM — Multi-banner gacha with rate-ups and rotation
// Each banner has its own pity counter.
// ═══════════════════════════════════════════════════════════════

const RARITY_EMOJI = { common:'⚪', rare:'🔵', epic:'🟣', legendary:'🟡' };

// ── Global item registry (all pullable items) ─────────────────────
const ITEM_REGISTRY = {
  // ── Standard Weapons ─────────────────────────────────────────
  'blade_of_dawn':       { name:'⚔️ Blade of Dawn',        type:'weapon', rarity:'rare',      bonus:{ atk:25 } },
  'arcane_staff':        { name:'🔮 Arcane Crystal Staff',  type:'weapon', rarity:'rare',      bonus:{ atk:22 } },
  'phantom_arrow':       { name:'🏹 Phantom Arrow',         type:'weapon', rarity:'rare',      bonus:{ atk:20, speed:8 } },
  'shadow_fang':         { name:'🗡️ Shadow Fang',          type:'weapon', rarity:'epic',      bonus:{ atk:40 } },
  'tidal_scepter':       { name:'🌊 Tidal Scepter',         type:'weapon', rarity:'epic',      bonus:{ atk:38, def:10 } },
  'hellfire_gs':         { name:'🔥 Hellfire Greatsword',   type:'weapon', rarity:'epic',      bonus:{ atk:45 } },
  'thunder_edge':        { name:'⚡ Thunder Edge',           type:'weapon', rarity:'legendary', bonus:{ atk:70, speed:15 } },
  'void_destroyer':      { name:'🌌 Void Destroyer',         type:'weapon', rarity:'legendary', bonus:{ atk:80 } },

  // ── Limited Weapons (rate-up only) ───────────────────────────
  'divine_judgment':     { name:'⚖️ Divine Judgment',       type:'weapon', rarity:'legendary', bonus:{ atk:90, def:20 }, limited:true },
  'eclipse_blade':       { name:'🌑 Eclipse Blade',          type:'weapon', rarity:'legendary', bonus:{ atk:85, speed:20 }, limited:true },
  'abyssal_scythe':      { name:'💀 Abyssal Scythe',         type:'weapon', rarity:'legendary', bonus:{ atk:95 }, limited:true },

  // ── Standard Artifacts ────────────────────────────────────────
  'ring_of_valor':       { name:'💍 Ring of Valor',          type:'artifact', rarity:'rare',      bonus:{ atk:8 },              desc:'+8 ATK permanently' },
  'necklace_of_thorns':  { name:'📿 Necklace of Thorns',     type:'artifact', rarity:'rare',      bonus:{ def:8 },              desc:'+8 DEF permanently' },
  'swift_boots':         { name:'👟 Swift Boots',             type:'artifact', rarity:'rare',      bonus:{ speed:10 },           desc:'+10 SPD permanently' },
  'gauntlet_of_giants':  { name:'🦾 Gauntlet of Giants',     type:'artifact', rarity:'epic',      bonus:{ atk:15, def:10 },    desc:'+15 ATK +10 DEF permanently' },
  'eye_of_abyss':        { name:'👁️ Eye of the Abyss',      type:'artifact', rarity:'epic',      bonus:{ atk:12, speed:12 },  desc:'+12 ATK +12 SPD permanently' },
  'life_crystal':        { name:'❤️ Life Crystal',           type:'artifact', rarity:'epic',      bonus:{ maxHp:50 },           desc:'+50 Max HP permanently' },
  'crown_of_dominion':   { name:'👑 Crown of Dominion',      type:'artifact', rarity:'legendary', bonus:{ atk:20, def:15, speed:15 }, desc:'+20 ATK +15 DEF +15 SPD permanently' },

  // ── Limited Artifacts ─────────────────────────────────────────
  'soul_prism':          { name:'🔮 Soul Prism',              type:'artifact', rarity:'legendary', bonus:{ atk:25, maxHp:80 },  desc:'+25 ATK +80 HP permanently', limited:true },
  'void_heart':          { name:'🖤 Void Heart',              type:'artifact', rarity:'legendary', bonus:{ def:25, speed:20 },  desc:'+25 DEF +20 SPD permanently', limited:true },

  // ── Pet Eggs ─────────────────────────────────────────────────
  'fire_egg':            { name:'🥚 Fire Egg',               type:'egg', rarity:'rare',      petType:'fire' },
  'storm_egg':           { name:'🥚 Storm Egg',              type:'egg', rarity:'rare',      petType:'storm' },
  'shadow_egg':          { name:'🥚 Shadow Egg',             type:'egg', rarity:'epic',      petType:'shadow' },
  'dragon_egg':          { name:'🥚 Dragon Egg',             type:'egg', rarity:'legendary', petType:'dragon' },
  'void_egg':            { name:'🖤 Void Dragon Egg',        type:'egg', rarity:'legendary', petType:'void_dragon', limited:true },
};

// ── Banner definitions ────────────────────────────────────────────
const BANNERS = {
  standard: {
    id: 'standard',
    name: '⭐ Standard Summon',
    desc: 'The base banner — always available. All standard items.',
    emoji: '⭐',
    costCrystals: 100,
    cost10Crystals: 900,
    // Weights per rarity from this banner
    pool: [
      { id:'blade_of_dawn', weight:20 }, { id:'arcane_staff', weight:20 }, { id:'phantom_arrow', weight:18 },
      { id:'shadow_fang', weight:10 }, { id:'tidal_scepter', weight:8 }, { id:'hellfire_gs', weight:7 },
      { id:'thunder_edge', weight:2 }, { id:'void_destroyer', weight:1 },
      { id:'ring_of_valor', weight:15 }, { id:'necklace_of_thorns', weight:15 }, { id:'swift_boots', weight:12 },
      { id:'gauntlet_of_giants', weight:8 }, { id:'eye_of_abyss', weight:6 }, { id:'life_crystal', weight:5 },
      { id:'crown_of_dominion', weight:1 },
      { id:'fire_egg', weight:8 }, { id:'storm_egg', weight:8 }, { id:'shadow_egg', weight:4 }, { id:'dragon_egg', weight:0.5 },
    ],
    softPityAt: 50,
    hardPityAt: 100,
    // Not a guaranteed 50/50 — standard banner just has its own pity
  },

  weapon: {
    id: 'weapon',
    name: '⚔️ Weapon Summon',
    desc: 'Weapons only — higher epic/legendary rate!',
    emoji: '⚔️',
    costCrystals: 100,
    cost10Crystals: 900,
    pool: [
      { id:'blade_of_dawn', weight:25 }, { id:'arcane_staff', weight:25 }, { id:'phantom_arrow', weight:22 },
      { id:'shadow_fang', weight:15 }, { id:'tidal_scepter', weight:12 }, { id:'hellfire_gs', weight:12 },
      { id:'thunder_edge', weight:4 }, { id:'void_destroyer', weight:3 },
    ],
    softPityAt: 40,
    hardPityAt: 80,
    // Weapon banner: legendary pity hits faster
  },

  // Limited banners are set dynamically (active for 30 days)
  limited: {
    id: 'limited',
    name: '🌟 LIMITED SUMMON',
    desc: 'Rate-up legendary! Guarantee rule: first legendary = rate-up item (50/50 if lost).',
    emoji: '🌟',
    costCrystals: 160,     // slightly more expensive
    cost10Crystals: 1440,
    pool: [
      // Standard pool
      { id:'blade_of_dawn', weight:18 }, { id:'arcane_staff', weight:18 }, { id:'phantom_arrow', weight:15 },
      { id:'shadow_fang', weight:9 }, { id:'tidal_scepter', weight:7 }, { id:'hellfire_gs', weight:6 },
      { id:'thunder_edge', weight:1 }, { id:'void_destroyer', weight:1 },
      { id:'ring_of_valor', weight:12 }, { id:'necklace_of_thorns', weight:12 }, { id:'swift_boots', weight:10 },
      { id:'gauntlet_of_giants', weight:7 }, { id:'eye_of_abyss', weight:5 }, { id:'life_crystal', weight:4 },
      { id:'crown_of_dominion', weight:1 },
      { id:'fire_egg', weight:6 }, { id:'storm_egg', weight:6 }, { id:'shadow_egg', weight:3 },
      // Rate-up items (higher weight when banner is active)
      { id:'divine_judgment', weight:10 },
      { id:'soul_prism', weight:8 },
      { id:'void_egg', weight:2 },
    ],
    softPityAt: 50,
    hardPityAt: 90,
    // 50/50 mechanic: if previous legendary was NOT rate-up, next legendary IS rate-up
    rateUpIds: ['divine_judgment', 'soul_prism', 'void_egg'],
    // Banner expires — managed via db.activeLimitedBanner
    limitedDurationDays: 30,
  },
};

// ── Pool builder ──────────────────────────────────────────────────
function buildPool(bannerId) {
  const banner = BANNERS[bannerId];
  if (!banner) return [];
  const pool = [];
  for (const entry of banner.pool) {
    const item = ITEM_REGISTRY[entry.id];
    if (!item) continue;
    for (let i = 0; i < Math.round(entry.weight * 10); i++) {
      pool.push({ ...item, id: entry.id });
    }
  }
  return pool;
}

const BUILT_POOLS = {};
for (const bid of Object.keys(BANNERS)) BUILT_POOLS[bid] = buildPool(bid);

// ── Pull logic ────────────────────────────────────────────────────
function doPull(bannerId, playerBannerState, forceRateUp = false) {
  const banner = BANNERS[bannerId];
  const pool   = BUILT_POOLS[bannerId];
  if (!pool || !pool.length) return null;

  const pity = playerBannerState.pity || 0;
  let item;

  // Hard pity
  if (pity >= banner.hardPityAt - 1) {
    const legs = pool.filter(x => x.rarity === 'legendary');
    item = legs[Math.floor(Math.random() * legs.length)];
  }
  // Soft pity
  else if (pity >= banner.softPityAt) {
    const highPool = pool.filter(x => x.rarity === 'epic' || x.rarity === 'legendary');
    if (Math.random() < 0.5) item = highPool[Math.floor(Math.random() * highPool.length)];
  }

  if (!item) item = pool[Math.floor(Math.random() * pool.length)];

  // 50/50 mechanic for limited banner
  if (bannerId === 'limited' && item.rarity === 'legendary') {
    const isRateUp = banner.rateUpIds?.includes(item.id);
    if (!isRateUp) {
      if (playerBannerState.guaranteedRateUp || forceRateUp) {
        // Guaranteed rate-up: replace with a random rate-up item
        const rateUpPool = pool.filter(x => banner.rateUpIds?.includes(x.id));
        if (rateUpPool.length) item = rateUpPool[Math.floor(Math.random() * rateUpPool.length)];
        playerBannerState.guaranteedRateUp = false;
      } else {
        // Lost 50/50 — next legendary will be rate-up
        playerBannerState.guaranteedRateUp = true;
      }
    } else {
      playerBannerState.guaranteedRateUp = false;
    }
  }

  // Update pity — only legendary resets
  playerBannerState.pity = (pity + 1);
  if (item.rarity === 'legendary') playerBannerState.pity = 0;

  return item;
}

// ── Constellation / Refinement (duplicate handling) ───────────────
// Weapons: Refinement 1→5 (+5 ATK each rank)
// Artifacts: Constellation 1→6 (+extra bonus per rank)
function applyDuplicate(player, item) {
  if (item.type === 'weapon') {
    // Find existing weapon in summon history
    if (!player.summonWeapons) player.summonWeapons = {};
    const existing = player.summonWeapons[item.id];
    if (!existing) {
      // First copy — equip if better
      player.summonWeapons[item.id] = { ...item, refinement: 1 };
      const curBonus = player.weapon?.bonus || 0;
      const newBonus = (item.bonus?.atk || 0);
      if (newBonus > curBonus) {
        player.weapon = { name: item.name, bonus: newBonus, id: item.id, refinement: 1 };
        return { action: 'equipped', msg: '⬆️ *EQUIPPED* as new weapon! (R1)' };
      }
      return { action: 'stored', msg: `📦 Stored in weapon collection (R1)` };
    } else {
      // Duplicate — refine
      const maxRef = 5;
      if (existing.refinement >= maxRef) {
        const sellVal = { rare:5000, epic:20000, legendary:100000 }[item.rarity] || 1000;
        player.gold = (player.gold||0) + sellVal;
        return { action: 'sold', msg: `💰 Max refinement! Sold for *${sellVal.toLocaleString()}g*` };
      }
      existing.refinement++;
      const atkBonus = 5 * (item.rarity === 'legendary' ? 3 : item.rarity === 'epic' ? 2 : 1);
      // Update equipped weapon if it matches
      if (player.weapon?.id === item.id) {
        player.weapon.bonus = (player.weapon.bonus || 0) + atkBonus;
        player.weapon.refinement = existing.refinement;
      }
      return { action: 'refined', msg: `⬆️ *REFINED* to R${existing.refinement}! (+${atkBonus} ATK)` };
    }
  }

  if (item.type === 'artifact') {
    if (!Array.isArray(player.summonArtifacts)) player.summonArtifacts = [];
    const existing = player.summonArtifacts.find(a => a.id === item.id);
    if (!existing) {
      // First copy — apply stats
      if (item.bonus) {
        for (const [stat, val] of Object.entries(item.bonus)) {
          if (stat === 'maxHp') { player.stats.maxHp += val; player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + val); }
          else if (player.stats[stat] !== undefined) player.stats[stat] = (player.stats[stat]||0) + val;
        }
      }
      player.summonArtifacts.push({ ...item, constellation: 1 });
      return { action: 'acquired', msg: `✨ *ACQUIRED!* ${item.desc} (C1)` };
    } else {
      const maxCon = 6;
      if (existing.constellation >= maxCon) {
        const sellVal = { rare:3000, epic:12000, legendary:60000 }[item.rarity] || 500;
        player.gold = (player.gold||0) + sellVal;
        return { action: 'sold', msg: `💰 Max constellation (C6)! Sold for *${sellVal.toLocaleString()}g*` };
      }
      existing.constellation++;
      // Each constellation gives a small additional boost
      const boost = { atk: 2, def: 2, speed: 2, maxHp: 10 };
      for (const [stat, val] of Object.entries(item.bonus || {})) {
        const extra = boost[stat] || 1;
        if (stat === 'maxHp') { player.stats.maxHp += extra; }
        else if (player.stats[stat] !== undefined) player.stats[stat] = (player.stats[stat]||0) + extra;
      }
      return { action: 'constellation', msg: `🌟 *CONSTELLATION C${existing.constellation}!* Small bonus applied.` };
    }
  }

  if (item.type === 'egg') {
    if (!player.inventory) player.inventory = {};
    if (!Array.isArray(player.inventory.items)) player.inventory.items = [];
    player.inventory.items.push({ name: item.name, type: 'pet_egg', rarity: item.rarity, petType: item.petType });
    return { action: 'egg', msg: `🥚 *Added to inventory* — /catch to hatch!` };
  }

  return { action: 'unknown', msg: '' };
}

// ── Real rate calculator ──────────────────────────────────────────
function getBannerRates(bannerId) {
  const pool = BUILT_POOLS[bannerId];
  if (!pool) return {};
  const total = pool.length;
  const r = {};
  for (const x of pool) r[x.rarity] = (r[x.rarity]||0) + 1;
  return Object.fromEntries(Object.entries(r).map(([k,v]) => [k, (v/total*100).toFixed(0)+'%']));
}

// ── Pull history ──────────────────────────────────────────────────
function recordPull(player, bannerId, item) {
  if (!player.summonHistory) player.summonHistory = [];
  player.summonHistory.unshift({
    bannerId,
    itemName: item.name,
    rarity: item.rarity,
    timestamp: Date.now()
  });
  if (player.summonHistory.length > 50) player.summonHistory = player.summonHistory.slice(0, 50);
}

module.exports = {
  BANNERS, ITEM_REGISTRY, BUILT_POOLS,
  doPull, applyDuplicate, recordPull, getBannerRates,
  RARITY_EMOJI,
};
