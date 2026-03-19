const PlayerMigration = require('../../rpg/utils/PlayerMigration');
const ProfileCard     = require('../../rpg/utils/ProfileCard');


module.exports = {
  name: 'profile',
  description: '👤 View detailed player profile',
  usage: '/profile [@user]',
  category: 'rpg',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // Determine target player
    let targetId = sender;
    

    // Check if user mentioned someone
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    
    if (mentionedJid) {
      targetId = mentionedJid;
    } else if (args[0]) {
      // Try to find by name or number
      const searchTerm = args.join(' ').toLowerCase().replace('@', '');
      
      for (const userId in db.users) {
        const user = db.users[userId];
        if (user.name?.toLowerCase().includes(searchTerm) || userId.includes(searchTerm)) {
          targetId = userId;
          break;
        }
      }
    }

    const playerRaw = db.users[targetId];

if (!playerRaw) {
  return sock.sendMessage(chatId, {
    text: '❌ Player not found!\n\nUse: /profile [@user] or /profile [name]'
  }, { quoted: msg });
}

// ✅ MIGRATE SAFELY HERE
const player = PlayerMigration.migratePlayer(playerRaw);
db.users[targetId] = player;
saveDatabase();

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ Player not found!\n\nUse: /profile [@user] or /profile [name]'
      }, { quoted: msg });
    }

    // ── Profile lock check ──────────────────────────────────────
    const SUPER_USERS = ['221951679328499@lid', '194592469209292@lid'];
    const isSuperUser = SUPER_USERS.includes(sender);
    const isViewingOwn = sender === targetId;

    if (player.profileLocked && !isViewingOwn && !isSuperUser) {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔒 PROFILE LOCKED\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n*${player.name}* has locked their profile.\n\n🚫 Only they can view it.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }
    // ────────────────────────────────────────────────────────────

    // Get class info
    const className = typeof player.class === 'string' 
      ? player.class 
      : (player.class?.name || 'Unknown');
    
    const classRarity = typeof player.class === 'object' && player.class.rarity 
      ? player.class.rarity 
      : 'Common';

    // Class emoji mapping
    const classEmojis = {
      'Warrior':     '⚔️',
      'Mage':        '🔮',
      'Archer':      '🏹',
      'Rogue':       '🗡️',
      'Berserker':   '🪓',
      'Paladin':     '🛡️',
      'Necromancer': '💀',
      'Assassin':    '🔪',
      'DragonKnight':'🐉',
      'Dragon Knight':'🐉',
      'Devourer':    '👹',
      'Monk':        '🌀',
      'Shaman':      '🌿',
      'BloodKnight': '🩸',
      'SpellBlade':  '💜',
      'Summoner':    '🔮',
      'Phantom':     '🌑',
      'Warlord':     '👑',
      'Elementalist':'🌊',
      'Shadow Dancer':'💃',
      'Chronomancer': '⏳'
    };

    const classEmoji = classEmojis[className] || '⚔️';

    // Rarity colors
    const rarityEmoji = {
      'Common': '⚪',
      'Rare': '🔵',
      'Epic': '🟣',
      'Legendary': '🟡',
      'Evil': '🔴'
    };

    const rarity = rarityEmoji[classRarity] || '⚪';

    // Calculate stats
    const stats = player.stats || {};
    const hp = stats.hp || 100;
    const maxHp = stats.maxHp || 100;
    const energy = stats.energy || 100;
    const maxEnergy = stats.maxEnergy || 100;
    const atk = stats.atk || 10;
    const def = stats.def || 5;
    const spd = stats.spd || 10;

    // HP and Energy bars
    const hpPercent = Math.floor((hp / maxHp) * 100);
    const energyPercent = Math.floor((energy / maxEnergy) * 100);
    
    const hpBar = createBar(hpPercent, 10, '🟢', '⚪');
    const energyBar = createBar(energyPercent, 10, '🔵', '⚪');

    // Calculate level progress
    const level = player.level || 1;
    const xp = player.xp || 0;
    const xpNeeded = Math.floor(100 * Math.pow(1.5, level - 1));
    const xpPercent = Math.floor((xp / xpNeeded) * 100);
    const xpBar = createBar(xpPercent, 10, '🟨', '⬜');

    // Get inventory
    const gold = player.inventory?.gold || player.gold || 0;
    const crystals = player.inventory?.manaCrystals || player.manaCrystals || 0;

    // Get rank
    const rank = player.rank || 'F';
    const rankEmojis = {
      'F': '🔴', 'E': '🟠', 'D': '🟡', 'C': '🟢',
      'B': '🔵', 'A': '🟣', 'S': '🌟', 'SS': '✨',
      'National': '👑', 'Beyond': '🌌'
    };
    const rankEmoji = rankEmojis[rank] || '🔴';

    // Get skills count
    const activeSkills = player.skills?.active?.length || 0;
    const passiveSkills = player.skills?.passive?.length || 0;
    const skillCount = activeSkills + passiveSkills;
    // Calculate win rates
    const pvpWins = player.pvpWins || 0;
    const pvpLosses = player.pvpLosses || 0;
    const pvpTotal = pvpWins + pvpLosses;
    const pvpWinRate = pvpTotal > 0 ? Math.floor((pvpWins / pvpTotal) * 100) : 0;

    // Boss stats
    const bossKills =
  typeof player.bossesDefeated === 'object'
    ? Object.keys(player.bossesDefeated || {}).length
    : (player.bossesDefeated || 0);

    // Dungeon stats
    const dungeonsCleared = player.dungeon?.cleared || 0;

    // Status effects
    const statusEffects = player.statusEffects || [];
    const activeEffects = statusEffects.length > 0 
      ? statusEffects.map(e => `${e.type} (${e.duration})`).join(', ')
      : 'None';

    // Combat power calculation (rough estimate)
    const combatPower = Math.floor(
      (atk * 10) + 
      (def * 8) + 
      (maxHp * 0.5) + 
      (spd * 5) + 
      (level * 50)
    );

    // Registration date
    const regDate = player.registeredAt 
      ? new Date(player.registeredAt).toLocaleDateString()
      : 'Unknown';

    // Build profile message
    const isViewing = targetId !== sender;
    const profileOwner = isViewing ? `${player.name}'s` : 'Your';

    const profile = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 ${profileOwner.toUpperCase()} PROFILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📛 Name: ${player.name}
${classEmoji} Class: ${className} ${rarity}
📊 Level: ${level}
${rankEmoji} Rank: ${rank}
⚡ Combat Power: ${combatPower.toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

❤️ HP: ${hp}/${maxHp}
${hpBar} ${hpPercent}%

💙 Energy: ${energy}/${maxEnergy}
${energyBar} ${energyPercent}%

⚔️ ATK: ${atk}
🛡️ DEF: ${def}
⚡ SPD: ${spd}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 PROGRESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━

💫 XP: ${xp}/${xpNeeded}
${xpBar} ${xpPercent}%

📚 Skills: ${skillCount}
💰 Gold: ${gold.toLocaleString()}
💎 Crystals: ${crystals.toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 ACHIEVEMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

👑 Bosses Defeated: ${bossKills}
🏰 Dungeons Cleared: ${dungeonsCleared}

🌟 PVP Record:
   Wins: ${pvpWins} | Losses: ${pvpLosses}
   Win Rate: ${pvpWinRate}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💫 STATUS EFFECTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${activeEffects}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Registered: ${regDate}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Use /stats for quick status
💡 Use /skills to view abilities
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    // Try to send canvas profile card, fall back to text if canvas not installed
    try {
      const cardBuffer = await ProfileCard.generateProfileCard(player);
      if (cardBuffer) {
        await sock.sendMessage(chatId, {
          image: cardBuffer,
          caption: `👤 *${player.name}*'s Profile\n📊 Lv.${player.level} ${typeof player.class === 'string' ? player.class : player.class?.name || 'Unknown'}\n\n💡 /stats • /skills • /inventory`,
          mentions: [targetId]
        }, { quoted: msg });
      } else {
        // Canvas not installed — send text profile
        await sock.sendMessage(chatId, { text: profile, mentions: [targetId] }, { quoted: msg });
      }
    } catch (e) {
      // Any canvas error — fall back silently
      await sock.sendMessage(chatId, { text: profile, mentions: [targetId] }, { quoted: msg });
    }
  }
};

// Helper function to create visual bars
function createBar(percent, length, fillChar, emptyChar) {
  percent = Number(percent);

  // 🛡️ Clamp percent
  if (isNaN(percent)) percent = 0;
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;

  const filled = Math.floor((percent / 100) * length);
  const empty = Math.max(0, length - filled);

  return fillChar.repeat(filled) + emptyChar.repeat(empty);
}