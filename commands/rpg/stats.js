const PlayerMigration = require('../../rpg/utils/PlayerMigration');
const { getEquippedBonuses } = require('../../rpg/utils/GearSystem');
const { applyAllocationsToStats } = require('../../rpg/utils/StatAllocationSystem');

module.exports = {
  name: 'stats',
  description: 'View your hunter profile',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    let player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not registered! Use /register to start your journey.'
      }, { quoted: msg });
    }

    // ── COMPARE MODE: /stats @user ──────────────────────────
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mentioned && mentioned !== sender) {
      const other = db.users[mentioned];
      if (!other) return sock.sendMessage(chatId, { text: '❌ That player is not registered!' }, { quoted: msg });

      const { getEquippedBonuses } = require('../../rpg/utils/GearSystem');
      const getStats = (p) => {
        const g = getEquippedBonuses(p);
        const w = p.weapon?.bonus || 0;
        return {
          atk:  (p.stats.atk||0) + (g.atk||0) + w,
          def:  (p.stats.def||0) + (g.def||0),
          hp:   (p.stats.maxHp||100) + (g.hp||0),
          spd:  (p.stats.speed||0) + (g.speed||0),
          crit: (p.stats.critChance||0) + (g.crit||0),
        };
      };
      const ps = getStats(player);
      const os = getStats(other);
      const cmp = (a, b) => a > b ? '🟢' : a < b ? '🔴' : '🟡';
      const pClass = player.class?.name || player.class || '?';
      const oClass = other.class?.name || other.class || '?';
      const pRank = player.pvpElo || 1000;
      const oRank = other.pvpElo || 1000;

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *STAT COMPARISON*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `👤 *${player.name}*  vs  *${other.name}*\n` +
          `📖 ${pClass} Lv.${player.level}  ↔  ${oClass} Lv.${other.level}\n` +
          `⭐ ELO: ${pRank}  ↔  ${oRank}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `❤️ HP:   ${cmp(ps.hp,os.hp)} *${ps.hp}*  ↔  *${os.hp}* ${cmp(os.hp,ps.hp)}\n` +
          `⚔️ ATK:  ${cmp(ps.atk,os.atk)} *${ps.atk}*  ↔  *${os.atk}* ${cmp(os.atk,ps.atk)}\n` +
          `🛡️ DEF:  ${cmp(ps.def,os.def)} *${ps.def}*  ↔  *${os.def}* ${cmp(os.def,ps.def)}\n` +
          `💨 SPD:  ${cmp(ps.spd,os.spd)} *${ps.spd}*  ↔  *${os.spd}* ${cmp(os.spd,ps.spd)}\n` +
          `💥 CRIT: ${cmp(ps.crit,os.crit)} *${ps.crit}%*  ↔  *${os.crit}%* ${cmp(os.crit,ps.crit)}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🟢 = Higher  🔴 = Lower  🟡 = Equal\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [sender, mentioned]
      }, { quoted: msg });
    }

    player = PlayerMigration.migratePlayer(player);
    db.users[sender] = player;
    saveDatabase();

    const rarityEmoji = {
      'common': '⚪', 'rare': '🔵', 'epic': '🟣',
      'legendary': '🟡', 'evil': '🔴', 'divine': '⚗️'
    };

    if (!player.class || typeof player.class !== 'object') player.class = { name: 'Unknown', rarity: 'common' };
    if (!player.class.name) player.class.name = 'Unknown';
    if (!player.class.rarity) player.class.rarity = 'common';

    // ── Apply upgrade allocations to base stats ───────────────────
    try { applyAllocationsToStats(player); } catch(e) {}

    // ── Get gear bonuses ──────────────────────────────────────────
    const gear = getEquippedBonuses(player);

    // ── Weapon bonus ──────────────────────────────────────────────
    const weaponBonus = player.weapon?.bonus || 0;

    // ── Effective totals ──────────────────────────────────────────
    const totalAtk  = (player.stats.atk  || 0) + (gear.atk  || 0) + weaponBonus;
    const totalDef  = (player.stats.def  || 0) + (gear.def  || 0);
    const totalHp   = (player.stats.maxHp || 100) + (gear.hp || 0);
    const totalSpd  = (player.stats.speed || 0) + (gear.speed || 0);
    const totalCrit = (player.stats.critChance || 0) + (gear.crit || 0);

    // ── Helper to show breakdown if gear/weapon adds anything ─────
    const breakdown = (base, bonus, label) => bonus > 0 ? ` (${base} + ${bonus} ${label})` : '';

    const nextLevelXp = Math.floor(100 * Math.pow(1.5, player.level - 1));
    const xpProgress  = Math.floor((player.xp / nextLevelXp) * 100);

    let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 HUNTER PROFILE 📊
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Name: ${player.name}
${rarityEmoji[player.class.rarity]} Class: ${player.class.name}
⭐ Level: ${player.level}
✨ XP: ${player.xp}/${nextLevelXp} (${xpProgress}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💪 COMBAT STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️ HP: ${player.stats.hp}/${totalHp}${breakdown(player.stats.maxHp, gear.hp, 'gear')}
⚔️ ATK: ${totalAtk}${breakdown(player.stats.atk, (gear.atk || 0) + weaponBonus, 'bonus')}
🛡️ DEF: ${totalDef}${breakdown(player.stats.def, gear.def, 'gear')}
${player.energyColor || '💙'} ${player.energyType || 'Energy'}: ${player.stats.energy || 0}/${player.stats.maxEnergy || 100}`;

    if (totalSpd > 0)  message += `\n💨 SPD: ${totalSpd}${breakdown(player.stats.speed, gear.speed, 'gear')}`;
    if (totalCrit > 0) message += `\n💥 CRIT: ${totalCrit}%${breakdown(player.stats.critChance, gear.crit, 'gear')}`;
    if ((player.stats.critDamage || 0) > 0) message += `\n🔥 CRIT DMG: ${player.stats.critDamage}%`;
    if ((player.stats.lifesteal || 0) > 0)  message += `\n💚 LIFESTEAL: ${player.stats.lifesteal}%`;
    if ((player.stats.magicPower || 0) > 0) message += `\n✨ MAGIC: ${player.stats.magicPower}`;

    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗡️ EQUIPMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${player.weapon?.name || 'None'} (+${weaponBonus} ATK)`;

    // Show equipped gear if any
    if (player.equippedGear && Object.keys(player.equippedGear).length > 0) {
      for (const [slot, piece] of Object.entries(player.equippedGear)) {
        if (!piece) continue;
        const statStr = Object.entries(piece.stats || {})
          .filter(([k]) => k !== 'special')
          .map(([k, v]) => `+${v} ${k.toUpperCase()}`)
          .join(', ');
        message += `\n🔹 [${slot}] ${piece.name}${statStr ? ` (${statStr})` : ''}`;
      }
    }

    const activeSkills = player.skills?.active || [];
    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ SKILLS (${activeSkills.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    activeSkills.forEach(skill => {
      const energyCost = skill.energyCost || skill.manaCost || 10;
      message += `🔮 ${skill.name} [Lv.${skill.level}/${skill.maxLevel}]\n`;
      message += `   💥 ${skill.damage} | ${player.energyColor} ${energyCost} | ⏰ ${skill.cooldown || 10}s\n`;
    });

    if (player.availableSkills?.length > 0) {
      message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 AVAILABLE SKILLS (${player.availableSkills.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      player.availableSkills.slice(0, 3).forEach((skill, i) => {
        message += `${i + 1}. 🔮 ${skill.name}\n`;
      });
      if (player.availableSkills.length > 3) message += `   ...and ${player.availableSkills.length - 3} more\n`;
      message += `\n💡 Use /skills to manage abilities!\n`;
    }

    if (player.skills.passive?.length > 0) {
      message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 PASSIVE ABILITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      player.skills.passive.forEach(p => {
        message += `⚡ ${p.name}: ${p.effect}\n`;
      });
    }

    const artifactList = Array.isArray(player.artifacts) ? player.artifacts : (player.artifacts?.inventory || []);
    if (artifactList.length > 0) {
      message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏺 ARTIFACTS (${artifactList.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      artifactList.forEach(a => {
        const icon = a.rarity === 'Mythic' ? '🌟' : a.rarity === 'Legendary' ? '💎' : a.rarity === 'Epic' ? '🟣' : '🔵';
        message += `${icon} ${a.name}\n   ${a.effect}${a.applied ? ' ✅' : ''}\n`;
      });
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 RESOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 Mana Crystals: ${player.manaCrystals}
🪙 Gold: ${player.gold}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎒 INVENTORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🩹 Health Potions: ${player.inventory?.healthPotions || 0}
${player.energyColor} ${player.energyType} Potions: ${player.inventory?.manaPotions || player.inventory?.energyPotions || 0}
🎫 Revive Tokens: ${player.inventory?.reviveTokens || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 ACHIEVEMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 Gates Cleared: ${player.dungeon?.cleared || 0}
💀 Bosses Defeated: ${typeof player.bossesDefeated === 'object' ? Object.keys(player.bossesDefeated || {}).length : (player.bossesDefeated || 0)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};
