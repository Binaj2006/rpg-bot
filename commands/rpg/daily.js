// ═══════════════════════════════════════════════════════════════
// /daily - 24hr cooldown, 1000-day streak, milestone rewards
// ═══════════════════════════════════════════════════════════════

const AchievementManager = require('../../rpg/utils/AchievementManager');
const BP = require('../../rpg/utils/BattlePass');
const SeasonManager = require('../../rpg/utils/SeasonManager');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const DC = require('../../rpg/utils/DailyChallenges');
let TitleSystem; try { TitleSystem = require('../../rpg/utils/TitleSystem'); } catch(e) {}

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Milestone rewards every 10 days up to 1000
function getMilestoneReward(streak) {
  const milestones = {
    10:   { gold: 5000,          crystals: 50,     label: 'Week+ Hunter' },
    20:   { gold: 10000,         crystals: 100,    items: 3,  label: 'Dedicated' },
    30:   { gold: 20000,         crystals: 200,    pet: 'common', label: 'Monthly Warrior' },
    50:   { gold: 50000,         crystals: 500,    pet: 'rare',   label: 'Committed' },
    100:  { gold: 500000,        crystals: 5000,   items: 10, pet: 'epic',      label: 'Centurion' },
    200:  { gold: 1000000,       crystals: 10000,  pet: 'legendary', label: 'Veteran' },
    365:  { gold: 10000000,      crystals: 50000,  pet: 'legendary', title: 'Veteran', label: 'Year One' },
    500:  { gold: 50000000,      crystals: 100000, pet: 'legendary', title: 'Elite',   label: 'Half-Thousand' },
    700:  { gold: 250000000,     crystals: 300000, pet: 'legendary', title: 'Legend',  label: 'Seven Hundred' },
    1000: { gold: 10000000000,   crystals: 1000000,pet: 'divine',   title: 'Mythic Hunter', label: 'Mythic' }
  };

  // Check every 10-day interval
  for (const day of [1000,700,500,365,200,100,50,30,20,10]) {
    if (streak === day) return { ...milestones[day], day };
  }
  return null;
}

// Base daily reward scales slightly with streak
function getBaseReward(streak) {
  const tier = Math.floor(streak / 10);
  return {
    gold:     500 + tier * 100,
    crystals: 20  + tier * 5,
    xp:       100 + tier * 20
  };
}

module.exports = {
  name: 'daily',
  aliases: ['claim'],
  description: 'Claim your daily rewards and grow your streak',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not registered!\nUse /register [name] to begin your journey.'
      }, { quoted: msg });
    }

    // Ensure daily data exists on player object
    if (!player.dailyQuest) player.dailyQuest = { lastClaimed: 0, streak: 0 };

    const now = Date.now();
    const last = player.dailyQuest.lastClaimed || 0;
    const elapsed = now - last;

    // Cooldown check
    if (elapsed < COOLDOWN_MS) {
      const remaining = COOLDOWN_MS - elapsed;
      const hrs  = Math.floor(remaining / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      return sock.sendMessage(chatId, {
        text: [
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '⏳ *ALREADY CLAIMED*',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          `You already claimed today's rewards.`,
          `Come back in *${hrs}h ${mins}m*.`,
          '',
          `🔥 Current Streak: *${player.dailyQuest.streak} days*`,
          "Don't break it — the rewards only get better.",
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        ].join('\n')
      }, { quoted: msg });
    }

    // Streak logic — if more than 48hrs since last claim, streak resets
    const streakBreakMs = COOLDOWN_MS * 2;
    if (last > 0 && elapsed > streakBreakMs) {
      player.dailyQuest.streak = 0;
    }
    player.dailyQuest.streak = (player.dailyQuest.streak || 0) + 1;
    player.dailyQuest.lastClaimed = now;
    DC.trackProgress(player, 'claim_daily', 1);
    try { const BP2=require('../../rpg/utils/BattlePass'); BP2.addPassXP(player,'daily_claim'); } catch(e) {}
    try { if (TitleSystem) { const nt=TitleSystem.checkAndAwardTitles(player); if (nt.length) { const nm=nt.map(id=>TitleSystem.TITLES[id]?.display||id).join(', '); sock.sendMessage(chatId,{text:`🎖️ *NEW TITLE UNLOCKED!*\n${nm}\n\n/title to equip it!`,mentions:[sender]}); } } } catch(e) {}

    const streak = player.dailyQuest.streak;
    const base = getBaseReward(streak);
    const milestone = getMilestoneReward(streak);

    // Apply base rewards (with seasonal multipliers)
    const seasonXpMult   = SeasonManager.getXpMult();
    const seasonGoldMult = SeasonManager.getGoldMult();
    const activeEvent    = SeasonManager.getActiveEvent();
    const dailyMult      = activeEvent?.bonuses?.dailyBonusMult || 1;
    const finalGold      = Math.floor(base.gold     * seasonGoldMult * dailyMult);
    const finalXp        = Math.floor(base.xp       * seasonXpMult);
    const finalCrystals  = base.crystals;
    player.gold         = (player.gold || 0)         + finalGold;
    player.xp           = (player.xp || 0)           + finalXp;
    player.manaCrystals = (player.manaCrystals || 0) + finalCrystals;

    // Level up check via LevelUpManager (unlocks skills, weapons, UP)
    const levelResult = LevelUpManager.checkAndApplyLevelUps(player, saveDatabase, sock, chatId);
    const levelUps = levelResult?.levelsGained || 0;

    // Track achievement
    const AchMgr = AchievementManager;
    const achUnlocks = AchMgr.track(player, 'daily_quests', 1);

    saveDatabase();

    // Build the message
    const streakTitle = streak >= 365 ? '🌌 MYTHIC' : streak >= 100 ? '🏆 LEGENDARY' :
                        streak >= 30  ? '🔥 BLAZING' : streak >= 7 ? '⚡ RISING' : '📅 ACTIVE';

    const lines = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '☀️  *DAILY REWARD CLAIMED*',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `🔥 Streak: *${streak} days* — ${streakTitle}`,
      '',
      '🎁 *TODAY\'S REWARDS*',
      `💰 +${finalGold.toLocaleString()} Gold${seasonGoldMult>1?' ('+seasonGoldMult+'× '+SeasonManager.getActiveEvent()?.emoji+')':''}`,
      `💎 +${finalCrystals} Crystals`,
      `✨ +${finalXp} XP${seasonXpMult>1?' ('+seasonXpMult+'× '+SeasonManager.getActiveEvent()?.emoji+')':''}`,
    ];

    if (milestone) {
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push(`🌟 *DAY ${milestone.day} MILESTONE — ${milestone.label.toUpperCase()}!*`);
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (milestone.gold) {
        player.gold += milestone.gold;
        lines.push(`💰 +${milestone.gold.toLocaleString()} Bonus Gold`);
      }
      if (milestone.crystals) {
        player.manaCrystals += milestone.crystals;
        lines.push(`💎 +${milestone.crystals.toLocaleString()} Bonus Crystals`);
      }
      if (milestone.items) {
        if (!player.inventory) player.inventory = {};
        player.inventory.healthPotions = (player.inventory.healthPotions || 0) + milestone.items;
        lines.push(`🧪 +${milestone.items} Health Potions`);
      }
      if (milestone.pet) {
        lines.push(`🐾 ${milestone.pet.charAt(0).toUpperCase() + milestone.pet.slice(1)} Pet Token added!`);
        if (!player.inventory) player.inventory = {};
        if (!player.inventory.items) player.inventory.items = [];
        player.inventory.items.push({
          name: milestone.pet.charAt(0).toUpperCase() + milestone.pet.slice(1) + ' Pet Token',
          type: 'PetToken', rarity: milestone.pet
        });
      }
      if (milestone.title) {
        if (!player.titles) player.titles = [];
        if (!player.titles.includes(milestone.title)) player.titles.push(milestone.title);
        lines.push(`🎖️ Title Unlocked: *"${milestone.title}"*`);
      }
      saveDatabase();
    }

    if (levelUps > 0) {
      lines.push('');
      lines.push(`🎉 *LEVEL UP x${levelUps}!* → Now Level ${player.level}`);
    }

    const next10 = 10 - (streak % 10);
    lines.push('');
    lines.push(`📅 *${streak} / 1000 days*`);
    lines.push(`⏭️ Next milestone bonus in ${next10} day${next10 === 1 ? '' : 's'}`);
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });

    // Achievement notifications
    if (achUnlocks.length > 0) {
      const note = AchMgr.buildNotification(achUnlocks);
      if (note) await sock.sendMessage(chatId, { text: note }, { quoted: msg });
    }
  }
};
