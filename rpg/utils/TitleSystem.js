// ═══════════════════════════════════════════════════════════════
// TITLE SYSTEM — Activity-based titles with stat boosts
// Earned automatically based on what the player does.
// ═══════════════════════════════════════════════════════════════

const TITLES = {
  // ── PvP Titles ───────────────────────────────────────────────
  'Duelist': {
    display: '⚔️ Duelist',
    desc: 'Win 10 PvP battles',
    condition: p => (p.pvpWins||0) >= 10,
    boost: { atk: 5 },
    boostDesc: '+5 ATK',
  },
  'Blade Master': {
    display: '🗡️ Blade Master',
    desc: 'Win 50 PvP battles',
    condition: p => (p.pvpWins||0) >= 50,
    boost: { atk: 15, speed: 5 },
    boostDesc: '+15 ATK, +5 SPD',
  },
  'War God': {
    display: '⚡ War God',
    desc: 'Win 200 PvP battles',
    condition: p => (p.pvpWins||0) >= 200,
    boost: { atk: 30, speed: 10 },
    boostDesc: '+30 ATK, +10 SPD',
  },
  'Unbreakable': {
    display: '🛡️ Unbreakable',
    desc: 'Achieve a 10-win PvP streak',
    condition: p => (p.pvpStreak||0) >= 10,
    boost: { def: 20, maxHp: 50 },
    boostDesc: '+20 DEF, +50 HP',
  },
  'Grandmaster': {
    display: '👑 Grandmaster',
    desc: 'Reach Grandmaster ELO (2000+)',
    condition: p => (p.pvpElo||1000) >= 2000,
    boost: { atk: 20, def: 10, speed: 10 },
    boostDesc: '+20 ATK, +10 DEF, +10 SPD',
  },

  // ── Dungeon Titles ───────────────────────────────────────────
  'Gate Breaker': {
    display: '🏰 Gate Breaker',
    desc: 'Clear 10 dungeons',
    condition: p => (p.dungeon?.cleared||0) >= 10,
    boost: { def: 5, maxHp: 30 },
    boostDesc: '+5 DEF, +30 HP',
  },
  'Conqueror': {
    display: '🏆 Conqueror',
    desc: 'Clear 50 dungeons',
    condition: p => (p.dungeon?.cleared||0) >= 50,
    boost: { def: 15, maxHp: 80 },
    boostDesc: '+15 DEF, +80 HP',
  },
  'Nightmare Slayer': {
    display: '💀 Nightmare Slayer',
    desc: 'Fully clear 100 dungeons (all 20 floors)',
    condition: p => (p.dungeon?.cleared||0) >= 100,
    boost: { atk: 25, def: 20 },
    boostDesc: '+25 ATK, +20 DEF',
  },

  // ── Boss Titles ──────────────────────────────────────────────
  'Boss Hunter': {
    display: '👹 Boss Hunter',
    desc: 'Defeat 10 world bosses',
    condition: p => (p.bossesDefeated||0) >= 10,
    boost: { atk: 10 },
    boostDesc: '+10 ATK',
  },
  'Raid Legend': {
    display: '🌍 Raid Legend',
    desc: 'Defeat 50 world bosses',
    condition: p => (p.bossesDefeated||0) >= 50,
    boost: { atk: 20, maxHp: 100 },
    boostDesc: '+20 ATK, +100 HP',
  },

  // ── Level Titles ─────────────────────────────────────────────
  'Rising Hunter': {
    display: '🌱 Rising Hunter',
    desc: 'Reach Level 25',
    condition: p => (p.level||1) >= 25,
    boost: { atk: 5, def: 5 },
    boostDesc: '+5 ATK, +5 DEF',
  },
  'Elite Hunter': {
    display: '🔥 Elite Hunter',
    desc: 'Reach Level 50',
    condition: p => (p.level||1) >= 50,
    boost: { atk: 15, def: 10, speed: 8 },
    boostDesc: '+15 ATK, +10 DEF, +8 SPD',
  },
  'Shadow Monarch': {
    display: '🌑 Shadow Monarch',
    desc: 'Reach Level 100',
    condition: p => (p.level||1) >= 100,
    boost: { atk: 40, def: 30, speed: 20, maxHp: 200 },
    boostDesc: '+40 ATK, +30 DEF, +20 SPD, +200 HP',
  },

  // ── Streak Titles ────────────────────────────────────────────
  'Devoted': {
    display: '📅 Devoted',
    desc: '30-day daily streak',
    condition: p => (p.dailyQuest?.streak||0) >= 30,
    boost: { speed: 10, maxHp: 50 },
    boostDesc: '+10 SPD, +50 HP',
  },
  'Veteran': {
    display: '🏅 Veteran',
    desc: '365-day daily streak',
    condition: p => (p.dailyQuest?.streak||0) >= 365,
    boost: { atk: 30, def: 20, speed: 20, maxHp: 150 },
    boostDesc: '+30 ATK, +20 DEF, +20 SPD, +150 HP',
  },

  // ── Gacha Titles ─────────────────────────────────────────────
  'Lucky Star': {
    display: '⭐ Lucky Star',
    desc: 'Pull your first legendary item',
    condition: p => (p.summonHistory||[]).some(h => h.rarity === 'legendary'),
    boost: { maxHp: 30 },
    boostDesc: '+30 HP',
  },
  'Collector': {
    display: '🗃️ Collector',
    desc: 'Collect 10 unique summon items',
    condition: p => {
      const weapons = Object.keys(p.summonWeapons||{}).length;
      const arts = (p.summonArtifacts||[]).length;
      return weapons + arts >= 10;
    },
    boost: { atk: 8, def: 8 },
    boostDesc: '+8 ATK, +8 DEF',
  },

  // ── Special / Pass Titles (granted externally) ───────────────
  'Shadow Hunter': {
    display: '🌑 Shadow Hunter',
    desc: 'Season 1 Premium Pass holder',
    condition: p => (p.titles||[]).includes('Shadow Hunter'),
    boost: { atk: 12, speed: 8 },
    boostDesc: '+12 ATK, +8 SPD',
  },
  'Shadow Survivor': {
    display: '👁️ Shadow Survivor',
    desc: 'Complete Season 1 (Level 50 Free Pass)',
    condition: p => (p.titles||[]).includes('Shadow Survivor'),
    boost: { def: 15, maxHp: 80 },
    boostDesc: '+15 DEF, +80 HP',
  },
  'War Veteran': {
    display: '⚔️ War Veteran',
    desc: 'Win 5 Guild Wars',
    condition: p => (p.guildWarsWon||0) >= 5,
    boost: { atk: 18, def: 8 },
    boostDesc: '+18 ATK, +8 DEF',
  },
};

// Check and award all earned titles to a player. Returns newly earned titles.
function checkAndAwardTitles(player) {
  if (!Array.isArray(player.titles)) player.titles = [];
  const newTitles = [];
  for (const [id, def] of Object.entries(TITLES)) {
    if (player.titles.includes(id)) continue;
    try {
      if (def.condition(player)) {
        player.titles.push(id);
        newTitles.push(id);
      }
    } catch(e) {}
  }
  return newTitles;
}

// Get the stat boost for the equipped title (applied at combat calc time, not stored in stats)
function getEquippedBoost(player) {
  const equipped = player.equippedTitle;
  if (!equipped || !TITLES[equipped]) return {};
  return TITLES[equipped].boost || {};
}

// Get display string for name + title
function getTitleDisplay(player) {
  const equipped = player.equippedTitle;
  if (!equipped || !TITLES[equipped]) return '';
  return TITLES[equipped].display;
}

module.exports = { TITLES, checkAndAwardTitles, getEquippedBoost, getTitleDisplay };
