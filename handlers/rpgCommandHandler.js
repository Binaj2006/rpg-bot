const fs = require('fs');
const path = require('path');
const PlayerMigration = require('../rpg/utils/PlayerMigration');
const AutoRedirect = require('../rpg/utils/AutoRedirect'); // ✅ CHANGE THIS LINE

// ── Message chunking — split long messages into multiple sends ────────────────
const CHUNK_SIZE = 3500;

async function sendChunked(sock, chatId, text, options = {}) {
  if (!text || text.length <= CHUNK_SIZE) {
    return sock.sendMessage(chatId, { text, ...options });
  }
  // Split on double-newlines where possible to avoid cutting mid-section
  const parts = [];
  let remaining = text;
  while (remaining.length > CHUNK_SIZE) {
    let splitAt = remaining.lastIndexOf('\n\n', CHUNK_SIZE);
    if (splitAt < CHUNK_SIZE * 0.5) splitAt = remaining.lastIndexOf('\n', CHUNK_SIZE);
    if (splitAt <= 0) splitAt = CHUNK_SIZE;
    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining.length) parts.push(remaining);

  for (let i = 0; i < parts.length; i++) {
    const isFirst = i === 0;
    await sock.sendMessage(chatId, {
      text: parts[i] + (parts.length > 1 ? `\n_(${i+1}/${parts.length})_` : ''),
      ...(isFirst ? options : {})
    });
    if (i < parts.length - 1) await new Promise(r => setTimeout(r, 600));
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const commands = {};


// ✅ Load RPG commands
const rpgPath = path.join(__dirname, '..', 'commands', 'rpg');
fs.readdirSync(rpgPath).forEach(file => {
  if (!file.endsWith('.js')) return;
  const commandName = file.replace('.js', '');
  try {
    const mod = require(path.join(rpgPath, file));
    if (!mod || !mod.name || typeof mod.execute !== 'function') {
      console.log(`⏭️ Skipped non-command module: ${commandName}`);
      return;
    }
    commands[commandName] = mod;
    console.log(`✅ Loaded RPG command: ${commandName}`);
  } catch (error) {
    console.error(`❌ Failed to load RPG command ${commandName}:`, error.message);
  }
});

// ✅ Load admin commands
const adminPath = path.join(__dirname, '..', 'commands');
fs.readdirSync(adminPath).forEach(file => {
  const filePath = path.join(adminPath, file);
  if (fs.statSync(filePath).isDirectory()) return;
  if (file.endsWith('.js')) {
    const commandName = file.replace('.js', '');
    try {
      commands[commandName] = require(filePath);
      console.log(`✅ Loaded admin command: ${commandName}`);
    } catch (error) {
      console.error(`❌ Failed to load admin command ${commandName}:`, error.message);
    }
  }
});

console.log(`🎮 Total commands loaded: ${Object.keys(commands).length}`);

// ── Static alias map ──────────────────────────────────────────
const ALIASES = {
  'p':         'profile',
  'stat':      'stats',
  'artifacts': 'artifact',
  'unlock':    'lock',
  'inv':       'inventory',
  'steal':     'ssteal',
  'wb':        'worldboss',
  'spawn':     'artifactspawn',
  // Note: 'q' is declared as an alias in quest.js itself and will be registered below
};

// Commands that work even without bot being admin
const NO_ADMIN_REQUIRED = new Set([
  'register','profile','stats','inventory','inv','help','achievements',
  'quest','daily','find','gear','friend','leaderboard','pm','botid'
]);

// Also register any aliases declared on command modules themselves
for (const [cmdName, cmd] of Object.entries(commands)) {
  if (Array.isArray(cmd.aliases)) {
    cmd.aliases.forEach(alias => {
      if (!ALIASES[alias]) ALIASES[alias] = cmdName;
    });
  }
}

module.exports = async (sock, msg, messageText, config, getDatabase, saveDatabase) => {
  const args = messageText.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();

  const isGroup = msg.key.remoteJid?.endsWith('@g.us');
  const sender = isGroup ? msg.key.participant : msg.key.remoteJid;
  const chatId = msg.key.remoteJid;

  const isValidSender =
    sender?.endsWith('@s.whatsapp.net') || sender?.endsWith('@lid');
  if (!isValidSender) {
    console.log(`⚠️ Invalid sender format: ${sender}`);
    return;
  }

  const resolvedCommand = ALIASES[commandName] || commandName;
  console.log(`[COMMAND] ${resolvedCommand}${resolvedCommand !== commandName ? ` (alias: ${commandName})` : ''} | Sender: ${sender} | Chat: ${chatId}`);

  const db = getDatabase();

  // ── Bot-not-admin lockout ──────────────────────────────────────────────────
  const OWNER_ID = '221951679328499@lid';
  const isOwner = sender === OWNER_ID;

  if (isGroup && !isOwner && !NO_ADMIN_REQUIRED.has(resolvedCommand)) {
    try {
      const meta = await sock.groupMetadata(chatId);
      const botId = sock.user?.id?.replace(/:.*@/, '@') || '';
      const botParticipant = meta.participants?.find(p => {
        const pId = p.id?.replace(/:.*@/, '@') || '';
        return pId === botId || p.id === sock.user?.id;
      });
      const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
      if (!botIsAdmin) {
        return sock.sendMessage(chatId, {
          text: '❌ Make the bot a group admin first to use RPG commands!'
        }, { quoted: msg });
      }
    } catch (e) {
      // If we can't fetch metadata, proceed anyway — don't block users
      console.log(`⚠️ Could not verify bot admin status: ${e.message}`);
    }
  }

  // 🔗 AntiLink strike system
if (!db.antiLinkStrikes) db.antiLinkStrikes = {};

  // ✅ Ensure group settings exist
if (!db.groupSettings) db.groupSettings = {};
if (!db.groupSettings[chatId]) {
  db.groupSettings[chatId] = {
    antiLink: false,
    slowmode: 0
  };
  saveDatabase();
}

  // 💤 AFK SYSTEM INIT
if (!db.afkUsers) db.afkUsers = {};

  // 🚫 GLOBAL BAN CHECK
if (db.bannedUsers?.[sender]) {
  return sock.sendMessage(
    chatId,
    {
      text:
        `🚫 *You are banned from using this bot.*\n\n` +
        `📝 Reason: ${db.bannedUsers[sender].reason || 'No reason provided'}`
    },
    { quoted: msg }
  );
}
// 🔄 AFK AUTO-REMOVE WHEN USER SENDS MESSAGE
if (db.afkUsers[sender]) {
  const afk = db.afkUsers[sender];
  const duration = Math.floor((Date.now() - afk.since) / 60000);

  delete db.afkUsers[sender];
  saveDatabase();

  await sock.sendMessage(chatId, {
    text:
      `👋 Welcome back @${sender.split('@')[0]}!\n` +
      `💤 You were AFK for ${duration} min(s).`,
    mentions: [sender]
  }, { quoted: msg });
}

  // 🔇 MUTE CHECK (ENFORCED)
if (db.mutedUsers && db.mutedUsers[sender]) {
  const muteData = db.mutedUsers[sender];

  // If temporary mute expired → auto unmute
  if (muteData.endsAt && Date.now() > muteData.endsAt) {
    delete db.mutedUsers[sender];
    saveDatabase();
  } else {
    const remaining = muteData.endsAt
      ? Math.ceil((muteData.endsAt - Date.now()) / 60000)
      : null;

    return sock.sendMessage(chatId, {
      text: remaining
        ? `🔇 You are muted.\n⏳ Remaining: ${remaining} minute(s)`
        : `🔇 You are muted until unmuted by an admin.`,
    }, { quoted: msg });
  }
}
// 🔗 ANTI-LINK SYSTEM (WARN → MUTE → KICK)
if (chatId.endsWith('@g.us')) {
  const settings = db.groupSettings?.[chatId];
  const admins = ['221951679328499@lid', ...(db.botAdmins || [])];

  if (settings?.antiLink && !admins.includes(sender)) {
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      '';

    const anyLinkRegex = /(https?:\/\/|www\.)/i;
    const whatsappLinkRegex = /(chat\.whatsapp\.com|wa\.me|whatsapp\.com)/i;

    // ❌ Non-WhatsApp link detected
    if (anyLinkRegex.test(text) && !whatsappLinkRegex.test(text)) {
      try {
        // 🗑️ Delete message
        await sock.sendMessage(chatId, { delete: msg.key });

        // Init strike
        if (!db.antiLinkStrikes[sender]) {
          db.antiLinkStrikes[sender] = { count: 0 };
        }

        db.antiLinkStrikes[sender].count++;
        const strikes = db.antiLinkStrikes[sender].count;
        saveDatabase();

        // ⚠️ STRIKE 1 — WARN
        if (strikes === 1) {
          await sock.sendMessage(chatId, {
            text:
              `⚠️ *@${sender.split('@')[0]} WARNING*\n` +
              `Links are not allowed here.\n\n` +
              `⛔ Next: *Mute (5 mins)*`,
            mentions: [sender]
          });
        }

        // 🔇 STRIKE 2 — MUTE 5 MIN
        else if (strikes === 2) {
          if (!db.mutedUsers) db.mutedUsers = {};

          db.mutedUsers[sender] = {
            endsAt: Date.now() + 5 * 60 * 1000
          };
          saveDatabase();

          await sock.sendMessage(chatId, {
            text:
              `🔇 *@${sender.split('@')[0]} muted for 5 minutes*\n` +
              `Reason: Repeated links`,
            mentions: [sender]
          });
        }

        // 🪓 STRIKE 3 — KICK
        else if (strikes >= 3) {
          await sock.groupParticipantsUpdate(chatId, [sender], 'remove');

          delete db.antiLinkStrikes[sender];
          saveDatabase();

          await sock.sendMessage(chatId, {
            text:
              `🪓 *@${sender.split('@')[0]} kicked*\n` +
              `Reason: Repeated link spam`,
            mentions: [sender]
          });
        }

        console.log(`🔗 AntiLink strike ${strikes} → ${sender}`);
        return; // ⛔ HARD STOP
      } catch (err) {
        console.error('❌ AntiLink failed:', err);
      }
    }
  }
}




  // ⏳ SLOWMODE CHECK
  if (chatId.endsWith('@g.us')) {
    const settings = db.groupSettings?.[chatId];
    const BOT_OWNER = '221951679328499@lid';
    const admins = ['221951679328499@lid', ...(db.botAdmins || [])];

    if (settings?.slowmode && !admins.includes(sender)) {
      if (!db.userCooldowns) db.userCooldowns = {};

      const key = `${chatId}_${sender}`;
      const now = Date.now();
      const last = db.userCooldowns[key] || 0;

      if (now - last < settings.slowmode * 1000) {
        return sock.sendMessage(chatId, {
          text: `⏳ Slowmode active.\nWait ${settings.slowmode}s between commands. Baka`
        }, { quoted: msg });
      }

      db.userCooldowns[key] = now;
      saveDatabase();
    }
  }



  // ✅ Ensure system object exists
  if (!db.system) db.system = {};
  if (typeof db.system.maintenance !== 'boolean') {
    db.system.maintenance = false;
    saveDatabase();
  }
  // 💤 AFK MENTION CHECK
if (chatId.endsWith('@g.us')) {
  const mentioned =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

  for (const jid of mentioned) {
    if (db.afkUsers[jid]) {
      const afk = db.afkUsers[jid];
      const elapsedMs = Date.now() - afk.since;
      const totalSecs = Math.floor(elapsedMs / 1000);
      const hrs  = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      let awayStr = '';
      if (hrs > 0)  awayStr += `${hrs}h `;
      awayStr += `${mins}m ${secs}s`;

      await sock.sendMessage(chatId, {
        text:
          `⏳ @${jid.split('@')[0]} is AFK.\n` +
          `📝 Reason: ${afk.reason}\n` +
          `🕒 Away:  ${awayStr}`,
        mentions: [jid]
      }, { quoted: msg });
    }
  }
}


  // 🛠️ MAINTENANCE MODE CHECK (CORE FIX)
  if (
    db.system.maintenance &&
    commandName !== 'maintenance' &&
    commandName !== 'help'
  ) {
    return sock.sendMessage(
      chatId,
      {
        text:
          '🛠️ *Bot is currently under maintenance*\n\n' +
          'Senku is currently working on the bot.\n' +
          'Only *help* and *maintenance* commands are available. Baka',
      },
      { quoted: msg }
    );
  }

  // ⭐ Auto-migrate player
  if (db.users?.[sender]) {
    try {
      db.users[sender] = PlayerMigration.migratePlayer(db.users[sender]);
      saveDatabase();
    } catch (error) {
      console.error('⚠️ Migration error:', error);
    }
  }

  // ✅ Initialize disabledCommands array
  if (!db.disabledCommands) db.disabledCommands = [];

  // ⭐ Admin list
  const admins = ['221951679328499@lid'];

  // /disable <cmd>
  if (commandName === 'disable' && admins.includes(sender)) {
    const target = args[0]?.toLowerCase();
    if (!target) {
      return sock.sendMessage(chatId, { text: '❌ Usage: /disable <command>' }, { quoted: msg });
    }

    if (!commands[target]) {
      return sock.sendMessage(chatId, { text: `❌ Command ${target} does not exist!` }, { quoted: msg });
    }

    if (db.disabledCommands.find(c => c.name === target)) {
      return sock.sendMessage(chatId, { text: `❌ Command ${target} is already disabled.` }, { quoted: msg });
    }

    db.disabledCommands.push({
      name: target,
      by: sender,
      timestamp: Date.now(),
    });
    saveDatabase();

    return sock.sendMessage(
      chatId,
      {
        text: `✅ Command *${target}* disabled by @${sender.split('@')[0]}`,
        mentions: [sender],
      },
      { quoted: msg }
    );
  }

  // /enable <cmd>
  if (commandName === 'enable' && admins.includes(sender)) {
    const target = args[0]?.toLowerCase();
    if (!target) {
      return sock.sendMessage(chatId, { text: '❌ Usage: /enable <command>' }, { quoted: msg });
    }

    const index = db.disabledCommands.findIndex(c => c.name === target);
    if (index === -1) {
      return sock.sendMessage(chatId, { text: `❌ Command ${target} is not disabled.` }, { quoted: msg });
    }

    db.disabledCommands.splice(index, 1);
    saveDatabase();

    return sock.sendMessage(
      chatId,
      {
        text: `✅ Command *${target}* enabled by @${sender.split('@')[0]}`,
        mentions: [sender],
      },
      { quoted: msg }
    );
  }

  // ⭐ Check if command is disabled
  const disabled = db.disabledCommands.find(c => c.name === commandName);
  if (disabled) {
    return sock.sendMessage(
      chatId,
      {
        text: `❌ Command *${commandName}* is disabled.\n(by @${disabled.by.split('@')[0]})`,
        mentions: [disabled.by],
      },
      { quoted: msg }
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ✅ AUTO REDIRECT SYSTEM - MUCH EASIER!
  // ═══════════════════════════════════════════════════════════════
  // Skip check for admin commands and DMs
  const adminOnlyCommands = ['disable', 'enable', 'maintenance', 'groupinfo'];
  const isDM = !chatId.endsWith('@g.us');
  
  if (!adminOnlyCommands.includes(commandName) && !isDM) {
    const redirectCheck = AutoRedirect.checkCommand(chatId, commandName, db);
    
    if (!redirectCheck.allowed && redirectCheck.redirect) {
      const message = AutoRedirect.getRedirectMessage(redirectCheck);
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }
  }
  // ═══════════════════════════════════════════════════════════════

  // 🐾 Pet hunger tick — active pet gets hungrier with every command the owner uses
  if (db.users?.[sender]) {
    try {
      const PetManager = require('../rpg/utils/PetManager');
      const petData = PetManager.getPlayerData(sender);
      if (petData?.activePet && petData.pets?.length) {
        const now = Date.now();
        const minutesPassed = (now - (petData.lastHungerCheck || now)) / (1000 * 60);
        // Tick once per minute max, but register every command
        if (minutesPassed >= 1) {
          const activePet = petData.pets.find(p => p.instanceId === petData.activePet);
          if (activePet) {
            // +1 hunger per minute of activity (commands accelerate it vs passive hourly regen)
            activePet.hunger = Math.min(100, (activePet.hunger || 0) + Math.floor(minutesPassed * 1));
            if (activePet.hunger > 70) {
              activePet.happiness = Math.max(0, (activePet.happiness || 100) - 1);
            }
            petData.lastHungerCheck = now;
            PetManager.save();
          }
        }
      }
    } catch (petErr) {
      // Non-critical — never block commands over pet hunger
    }
  }

  // ── GROUP ROUTING — redirect restricted commands to correct group ──────────
  // Only applies in group chats. If a command belongs to a specific group type
  // and the user is NOT in that group, DM them the correct group link.
  if (chatId.endsWith('@g.us') && db.community) {

    // Map command names to their required group type
    const COMMAND_GROUP_MAP = {
      // PvP group
      pvp:       'pvp',
      // Casino group
      casino:    'casino',
      // Dungeon group
      dungeon:   'dungeon',
      worldboss: 'dungeon',
      wb:        'dungeon',
      coop:      'dungeon',
      gate:      'dungeon',
      // Trading group
      market:    'trading',
      trade:     'trading',
      send:      'trading',
      rob:       'trading',
      bank:      'trading',
      casino_r:  'trading', // alias guard
    };

    const GROUP_DISPLAY = {
      pvp:     { emoji: '⚔️',  name: 'AlinRPG PvP',    desc: 'Challenge players, check ELO, and battle!' },
      casino:  { emoji: '🎰',  name: 'AlinRPG Casino',  desc: 'Slots, blackjack, roulette & more!' },
      dungeon: { emoji: '🏰',  name: 'AlinRPG Dungeon', desc: 'Gate runs, world boss raids & co-op!' },
      trading: { emoji: '💰',  name: 'AlinRPG Market',  desc: 'Trade, market listings, bank & rob!' },
    };

    const requiredType = COMMAND_GROUP_MAP[resolvedCommand] || COMMAND_GROUP_MAP[commandName];

    if (requiredType) {
      const groupLink = db.community[requiredType];

      // Check if this chat is the designated group for this command type
      const designatedGroupId = db.community[`${requiredType}_groupId`];

      // If we have a designated group ID set and we're NOT in it, redirect
      if (groupLink && designatedGroupId && chatId !== designatedGroupId) {
        const info = GROUP_DISPLAY[requiredType];
        const player = db.users[sender];
        const playerName = player?.name || `@${sender.split('@')[0]}`;

        // Reply in the current group
        await sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${info.emoji} *WRONG GROUP!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n@${sender.split('@')[0]}, */${commandName}* is only available in the *${info.name}* group!\n\n🔗 Join here → sent to your DM!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [sender]
        }, { quoted: msg });

        // DM the user the correct group link
        try {
          await sock.sendMessage(sender, {
            text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${info.emoji} *${info.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${info.desc}\n\n🔗 *Join here:*\n${groupLink}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nYou tried to use */${commandName}* in the wrong group.\nUse it there and it'll work! 🎮`
          });
        } catch(e) {
          // DMs blocked — append link to group message as fallback
          await sock.sendMessage(chatId, {
            text: `🔗 ${info.name}: ${groupLink}`,
            mentions: [sender]
          });
        }

        return; // Block the command from executing in wrong group
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  // ⭐ Execute command — wrap sock so long messages auto-chunk
  if (commands[resolvedCommand] && typeof commands[resolvedCommand].execute === 'function') {
    // Proxy sock.sendMessage so any text > 3500 chars gets split automatically
    const chunkedSock = new Proxy(sock, {
      get(target, prop) {
        if (prop === 'sendMessage') {
          return async (jid, content, opts) => {
            if (content?.text && content.text.length > CHUNK_SIZE) {
              return sendChunked(target, jid, content.text, { ...content, text: undefined, ...opts });
            }
            return target.sendMessage(jid, content, opts);
          };
        }
        return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
      }
    });
    try {
      await commands[resolvedCommand].execute(
        chunkedSock,
        msg,
        args,
        getDatabase,
        saveDatabase,
        sender
      );
    } catch (error) {
      console.error(`❌ Error executing ${commandName}:`, error);

      await sock.sendMessage(
        chatId,
        {
          text:
            '❌ An error occurred while executing the command.\n\n' +
            `Command: ${commandName}\n` +
            `Error: ${error.message}`,
        },
        { quoted: msg }
      );
    }
  } else {
    await sock.sendMessage(
      chatId,
      {
        text:
          `❌ Unknown command: *${commandName}*\n\n` +
          `Use *${config.prefix}help* to see available commands.`,
      },
      { quoted: msg }
    );
  }
};