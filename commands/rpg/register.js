const PlayerManager = require('../../rpg/player/PlayerManager');
const RegenManager = require('../../rpg/utils/RegenManager');

// ═══════════════════════════════════════════════════════════════
// ORIGIN SYSTEM — Chosen at registration, permanent bonus
// Each origin changes starting stats, inventory, and passive trait
// ═══════════════════════════════════════════════════════════════
const ORIGINS = {
  wanderer: {
    name: '🌍 Wanderer',
    desc: 'A seasoned traveler. Seen everything. Feared nothing.',
    bonus: '+15% XP from all sources. Start with extra gold.',
    statBonus: { speed: 8 },
    xpMult: 1.15,
    extraGold: 50000,
    extraItems: { healthPotions: 2 },
    passiveName: 'World-Weary',
    passiveEffect: '+15% XP gain permanently',
    trait: 'xp_boost',
    traitValue: 0.15,
  },
  noble: {
    name: '👑 Noble',
    desc: 'Born into power. Gold flows like water.',
    bonus: '+25% gold from all sources. Better shop prices.',
    statBonus: { def: 4 },
    goldMult: 1.25,
    extraGold: 80000,
    extraItems: { healthPotions: 1, reviveTokens: 1 },
    passiveName: 'Silver Tongue',
    passiveEffect: '+25% gold gain, -10% shop costs',
    trait: 'gold_boost',
    traitValue: 0.25,
  },
  soldier: {
    name: '⚔️ Soldier',
    desc: 'Forged in war. Knows only discipline.',
    bonus: '+10% ATK & DEF. Better starting weapon.',
    statBonus: { atk: 5, def: 5 },
    weaponBonus: 8,
    extraGold: 20000,
    extraItems: { healthPotions: 3, energyPotions: 2 },
    passiveName: 'Battlefield Discipline',
    passiveEffect: '+10% ATK & DEF passively',
    trait: 'stat_boost',
    traitValue: { atk: 0.10, def: 0.10 },
  },
  scholar: {
    name: '📚 Scholar',
    desc: 'Knowledge is power. Every skill hits harder.',
    bonus: 'Skills deal +15% damage. Start with 2 extra skill slots unlocked.',
    statBonus: { speed: 5 },
    skillDmgBonus: 0.15,
    extraGold: 30000,
    extraItems: { healthPotions: 2, energyPotions: 3 },
    passiveName: 'Academic Mastery',
    passiveEffect: '+15% skill damage, +2 skill memory',
    trait: 'skill_boost',
    traitValue: 0.15,
    extraSkillSlots: 2,
  },
  survivor: {
    name: '🔥 Survivor',
    desc: 'Been to hell. Still standing. HP is your shield.',
    bonus: '+20% max HP. Self-heals are 20% stronger.',
    statBonus: { hp: 20, maxHp: 20 },
    maxHpBonus: 0.20,
    healBonus: 0.20,
    extraGold: 25000,
    extraItems: { healthPotions: 5, reviveTokens: 1 },
    passiveName: 'Iron Survivor',
    passiveEffect: '+20% max HP, +20% self-heal strength',
    trait: 'hp_boost',
    traitValue: 0.20,
  },
  renegade: {
    name: '🌑 Renegade',
    desc: 'Hunted. Dangerous. Crits come naturally.',
    bonus: '+5% crit chance, +20% crit damage from the start.',
    statBonus: { speed: 10 },
    critChanceBonus: 5,
    critDmgBonus: 0.20,
    extraGold: 20000,
    extraItems: { healthPotions: 2, energyPotions: 2 },
    passiveName: 'Deadly Precision',
    passiveEffect: '+5% crit chance, +20% crit damage',
    trait: 'crit_boost',
    traitValue: { chance: 5, damage: 0.20 },
  },
};

const ORIGIN_LIST = Object.keys(ORIGINS);

// Apply origin bonuses to a player object
function applyOrigin(player, originKey) {
  const origin = ORIGINS[originKey];
  if (!origin) return;

  player.origin = originKey;
  player.originName = origin.name;
  player.originTrait = { name: origin.passiveName, effect: origin.passiveEffect, key: origin.trait, value: origin.traitValue };

  // Stat bonuses
  if (origin.statBonus) {
    for (const [stat, val] of Object.entries(origin.statBonus)) {
      if (stat === 'hp' || stat === 'maxHp') {
        player.stats.maxHp += val;
        player.stats.hp += val;
      } else if (player.stats[stat] !== undefined) {
        player.stats[stat] += val;
      }
    }
  }
  if (origin.maxHpBonus) {
    const bonus = Math.floor(player.stats.maxHp * origin.maxHpBonus);
    player.stats.maxHp += bonus;
    player.stats.hp += bonus;
  }
  if (origin.critChanceBonus) player.stats.critChance = (player.stats.critChance||5) + origin.critChanceBonus;
  if (origin.critDmgBonus) player.stats.critDamage = (player.stats.critDamage||1.5) + origin.critDmgBonus;
  if (origin.weaponBonus) player.weapon.bonus = (player.weapon.bonus||0) + origin.weaponBonus;
  if (origin.extraSkillSlots) player.maxSkillSlots = 5 + origin.extraSkillSlots;

  // Multiplier traits stored for game logic to read
  if (origin.xpMult)       player.xpMultiplier = origin.xpMult;
  if (origin.goldMult)     player.goldMultiplier = origin.goldMult;
  if (origin.skillDmgBonus) player.skillDamageBonus = origin.skillDmgBonus;
  if (origin.healBonus)    player.healBonus = origin.healBonus;

  // Extra items
  if (origin.extraItems) {
    if (!player.inventory) player.inventory = {};
    for (const [item, qty] of Object.entries(origin.extraItems)) {
      player.inventory[item] = (player.inventory[item]||0) + qty;
    }
  }

  // Passive note
  if (!player.skills) player.skills = { active:[], passive:[], ultimate:null };
  if (!player.skills.passive) player.skills.passive = [];
  player.skills.passive.push({ name: origin.passiveName, effect: origin.passiveEffect, isOrigin: true });
}

module.exports = {
  name: 'register',
  description: '🎮 Register as a new hunter — choose your origin, roll your class',
  ORIGINS,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (db.users[sender]) {
      return sock.sendMessage(chatId, { text: '❌ Already registered!\nUse /stats to view your profile.' }, { quoted: msg });
    }

    const sub = args[0]?.toLowerCase();

    // ── SHOW ORIGINS MENU ──────────────────────────────────────
    if (!sub || sub === 'help' || sub === 'origins') {
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 HUNTER REGISTRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: Choose your ORIGIN (permanent bonus)
Step 2: Pick your NAME
Step 3: Roll a random CLASS

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 ORIGINS (Choose wisely!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      for (const [key, o] of Object.entries(ORIGINS)) {
        txt += `${o.name}\n"${o.desc}"\n✅ ${o.bonus}\n\n`;
      }
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 USAGE
/register [origin] [name]

Examples:
/register wanderer Kirito
/register soldier Sung Jin-Woo
/register noble Arthur
/register scholar Merlin
/register survivor Ellie
/register renegade Shadow

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎲 CLASSES (Rolled randomly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚪ Common (55%): Warrior, Mage, Archer, Rogue, Knight, Monk, Shaman, Warlord
🔵 Rare (27%): Paladin, Necromancer, Assassin, Elementalist, Ranger, BloodKnight, SpellBlade
🟣 Epic (13%): Berserker, DragonKnight, Summoner, ShadowDancer
🟠 Legendary (5%): Devourer, Chronomancer, Phantom
✨ Divine (0%): Senku [Owner Exclusive]
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── PARSE ORIGIN + NAME ────────────────────────────────────
    let originKey = null;
    let nameStart = 0;

    if (ORIGIN_LIST.includes(sub)) {
      originKey = sub;
      nameStart = 1;
    }

    const playerName = args.slice(nameStart).join(' ').trim();

    if (!playerName) {
      return sock.sendMessage(chatId, {
        text: `❌ Provide your name!\n\nExamples:\n/register wanderer Kirito\n/register soldier Sung Jin-Woo\n\nOr /register to see origin options.`
      }, { quoted: msg });
    }
    if (playerName.length < 3)  return sock.sendMessage(chatId, { text: '❌ Name must be at least 3 characters!' }, { quoted: msg });
    if (playerName.length > 20) return sock.sendMessage(chatId, { text: '❌ Name must be 20 characters or less!' }, { quoted: msg });

    // If no origin given, assign a random one
    if (!originKey) {
      originKey = ORIGIN_LIST[Math.floor(Math.random() * ORIGIN_LIST.length)];
    }

    try {
      // Suspense
      await sock.sendMessage(chatId, { text: `🎲 Rolling your class...\n⏳ Please wait...` }, { quoted: msg });
      await new Promise(r => setTimeout(r, 2000));

      const rolledClass = PlayerManager.rollRandomClass(sender);
      const player = PlayerManager.createNewPlayer(sender, playerName, rolledClass);
      if (!player) throw new Error(`Failed to create player: ${rolledClass}`);

      // Apply origin bonuses
      applyOrigin(player, originKey);

      // Registration gold bonus
      const BOT_OWNER = '221951679328499@lid';
      const CO_OWNER  = '194592469209292@lid';
      if (sender === BOT_OWNER) {
        player.gold = 500_000_000_000;
        player.manaCrystals = 1_000_000_000;
      } else if (sender === CO_OWNER) {
        player.gold = 10_000_000_000;
        player.manaCrystals = 100_000_000;
      } else {
        player.gold = 100000 + (ORIGINS[originKey]?.extraGold || 0);
        player.manaCrystals = 2000;
      }

      db.users[sender] = player;

      // ── Init PvP stats for leaderboard visibility (#5) ──────
      if (!player.pvpElo)    player.pvpElo    = 1000;
      if (!player.pvpWins)   player.pvpWins   = 0;
      if (!player.pvpLosses) player.pvpLosses = 0;
      if (!player.pvpStreak) player.pvpStreak = 0;

      RegenManager.startRegen(sender, player, db, saveDatabase);
      saveDatabase();

      const origin = ORIGINS[originKey];
      const rarityEmoji  = { common:'💪', rare:'🔥', epic:'✨', legendary:'🌟', divine:'⚗️' };
      const rarityText   = { common:'COMMON', rare:'RARE', epic:'EPIC', legendary:'LEGENDARY', divine:'DIVINE ✦' };
      const cls = player.class;

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 REGISTRATION COMPLETE! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 ${player.name}
${rarityEmoji[cls.rarity]||'⭐'} Class: *${cls.name}* [${rarityText[cls.rarity]||'UNKNOWN'}]
${origin.name} Origin: *${originKey.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BASE STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️ HP: ${player.stats.maxHp}
⚔️ ATK: ${player.stats.atk}
🛡️ DEF: ${player.stats.def}
💨 SPD: ${player.stats.speed}
💥 CRIT: ${player.stats.critChance}%
${player.energyColor} ${player.energyType}: ${player.stats.maxEnergy}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 ORIGIN BONUS: ${origin.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
"${origin.desc}"
✅ ${origin.bonus}
⚡ Passive: *${origin.passiveName}*
   ${origin.passiveEffect}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ STARTING SKILLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${player.skills.active.map((s,i) => `${i+1}. 🔮 ${s.name}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 STARTER ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🩹 Health Potions: ${player.inventory.healthPotions}
${player.energyColor} Energy Potions: ${player.inventory.energyPotions}
🔄 Revive Tokens: ${player.inventory.reviveTokens}
💰 Gold: ${player.gold.toLocaleString()}
💎 Crystals: ${player.manaCrystals.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 GETTING STARTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/help — All commands
/dungeon enter — Start hunting
/skills — Manage your skills
/upgrade — Invest stat points
/stats — View full profile
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });

      // ── Onboarding DM — sent a moment after registration ────
      setTimeout(async () => {
        try {
          await sock.sendMessage(sender, {
            text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 *WELCOME TO ANI R.P.G, ${player.name}!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Here's your quick-start guide 👇

*Step 1 — Claim free gold & XP*
/daily — claim every 24h (streaks = bigger rewards!)

*Step 2 — Run your first dungeon*
/dungeon party create → /dungeon ready → /dungeon start 1
(invite friends or go solo)

*Step 3 — Challenge someone*
/pvp challenge @user — fight for ELO & gold
(use this in the PvP group)

*Step 4 — Try your luck*
/casino slots [amount] — spin for big wins
(use this in the Casino group)

*Step 5 — Check your power*
/rank — see your hunter rank
/stats — full profile & stats

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *USEFUL SHORTCUTS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/me       — quick stats snapshot
/top      — instant leaderboard
/cooldowns — all your timers
/community — all group links
/help [pvp/dungeon/guild/economy] — category guides

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Good luck, Hunter. The gates await. ⚔️`
          });
        } catch(e) { /* DMs blocked — that's fine */ }
      }, 3000);


    } catch (err) {
      console.error('Registration error:', err);
      return sock.sendMessage(chatId, { text: `❌ Registration failed: ${err.message}` }, { quoted: msg });
    }
  }
};
