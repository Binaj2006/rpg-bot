const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const rpgCommandHandler = require('./handlers/rpgCommandHandler');
const PlayerMigration = require('./rpg/utils/PlayerMigration');
const RegenManager = require('./rpg/utils/RegenManager');
const GateManager = require('./rpg/dungeons/GateManager');
const SeasonManager = require('./rpg/utils/SeasonManager');
const Announcer = require('./rpg/utils/Announcer');
const GuildWar = require('./commands/rpg/guildwar');

// Database path
const DB_PATH = path.join(__dirname, 'database', 'database.json');

// Initialize database
let database = { users: {}, banlist: {}, dailyQuests: {} };
const loadDatabase = () => {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      database = JSON.parse(data);
      
      // Migrate all players
      PlayerMigration.migrateAllPlayers(database);
      
      let fixedPlayers = 0;
      let removedPlayers = 0;
      
      for (const userId in database.users) {
        const player = database.users[userId];
        
        if (!player) {
          console.log(`⚠️ Removing corrupted player: ${userId}`);
          delete database.users[userId];
          removedPlayers++;
          continue;
        }
        
        if (!player.statusEffects) player.statusEffects = [];
        if (!player.comboCount) player.comboCount = 0;
        
        if (!player.stats) {
          console.error(`⚠️ Player ${userId} has no stats! Removing.`);
          delete database.users[userId];
          removedPlayers++;
          continue;
        }
        
        // Fix XP overflow
        let leveled = false;
        while (true) {
          const xpNeeded = Math.floor(100 * Math.pow(1.5, player.level - 1));
          if (player.xp >= xpNeeded) {
            player.level++;
            player.xp -= xpNeeded;
            player.stats.maxHp += 10;
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 10);
            
            if (player.stats.maxMana !== undefined && player.stats.maxEnergy === undefined) {
              player.stats.maxEnergy = player.stats.maxMana;
              player.stats.energy = player.stats.mana;
              delete player.stats.mana;
              delete player.stats.maxMana;
            }
            
            player.stats.maxEnergy += 5;
            player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + 5);
            player.stats.atk += 3;
            player.stats.def += 2;
            leveled = true;
          } else {
            break;
          }
        }
        
        // Fix negative gold
        if (player.gold < 0) {
          console.log(`⚠️ Fixed negative gold for ${player.name}: ${player.gold} → 0`);
          player.gold = 0;
          leveled = true;
        }
        
        if (!player.inventory) {
          player.inventory = {
            healthPotions: 0,
            manaPotions: 0,
            energyPotions: 0,
            reviveTokens: 0
          };
          leveled = true;
        }
        
        if (leveled) {
          fixedPlayers++;
        }
      }
      
      // Fix broken guilds
      if (database.guilds) {
        let guildsFixed = 0;
        let guildsRemoved = 0;
        
        for (const guildId in database.guilds) {
          const guild = database.guilds[guildId];
          
          if (!guild.leader) {
            console.log(`⚠️ Removing guild with no leader: ${guild.name || guildId}`);
            delete database.guilds[guildId];
            guildsRemoved++;
            continue;
          }
          
          if (!database.users[guild.leader]) {
            console.log(`⚠️ Removing guild with deleted leader: ${guild.name || guildId}`);
            delete database.guilds[guildId];
            guildsRemoved++;
            continue;
          }
          
          if (!guild.members || !Array.isArray(guild.members)) {
            guild.members = [{
              id: guild.leader,
              name: database.users[guild.leader]?.name || 'Unknown',
              rank: 'Leader',
              joinedAt: Date.now()
            }];
            guildsFixed++;
          }
          
          const validMembers = guild.members.filter(m => database.users[m.id]);
          if (validMembers.length !== guild.members.length) {
            guild.members = validMembers;
            guildsFixed++;
          }
          
          if (!guild.members.some(m => m.id === guild.leader)) {
            guild.members.push({
              id: guild.leader,
              name: database.users[guild.leader]?.name || 'Unknown',
              rank: 'Leader',
              joinedAt: Date.now()
            });
            guildsFixed++;
          }
        }
        
        if (guildsFixed > 0 || guildsRemoved > 0) {
          console.log(`✅ Fixed ${guildsFixed} guild(s), removed ${guildsRemoved} broken guild(s)`);
        }
      }
      
      if (fixedPlayers > 0 || removedPlayers > 0) {
        saveDatabase();
        console.log(`✅ Auto-fixed ${fixedPlayers} player(s), removed ${removedPlayers} corrupted player(s)`);
      }

      // ── Cleanup orphaned pvpBattle states ───────────────────────
      // If bot crashed mid-battle, pvpBattle is stuck in DB with no active timer.
      // Clear any battle older than 10 minutes so players aren't permanently softlocked.
      let battlesCleared = 0;
      const BATTLE_STALE_MS = 10 * 60 * 1000;
      for (const userId in database.users) {
        const player = database.users[userId];
        if (player?.pvpBattle && Date.now() - (player.pvpBattle.startTime || 0) > BATTLE_STALE_MS) {
          // Restore pet passives before clearing
          const b = player.pvpBattle;
          if (b.petPassiveAtk) player.stats.atk = Math.max(0, (player.stats.atk||0) - b.petPassiveAtk);
          if (b.petPassiveDef) player.stats.def = Math.max(0, (player.stats.def||0) - b.petPassiveDef);
          if (b.petPassiveSpd) player.stats.speed = Math.max(0, (player.stats.speed||0) - b.petPassiveSpd);
          player.pvpBattle = null;
          player.statusEffects = [];
          player.buffs = [];
          battlesCleared++;
        }
      }
      if (battlesCleared > 0) {
        console.log(`⚔️ Cleared ${battlesCleared} orphaned PvP battle(s) on startup`);
        saveDatabase();
      }

      // ── Cleanup stale pendingChallenges ──────────────────────────
      if (database.pendingChallenges) {
        const now = Date.now();
        let staleChallenges = 0;
        for (const targetId in database.pendingChallenges) {
          if (now - (database.pendingChallenges[targetId].timestamp || 0) > 90_000) {
            delete database.pendingChallenges[targetId];
            staleChallenges++;
          }
        }
        if (staleChallenges > 0) console.log(`🧹 Cleared ${staleChallenges} stale PvP challenge(s)`);
      }

      // ── Cleanup stale pendingTrades (#15) ────────────────────────
      if (database.pendingTrades) {
        const now = Date.now();
        const TRADE_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 hours
        let staleTrades = 0;
        for (const userId in database.pendingTrades) {
          const t = database.pendingTrades[userId];
          if (!t || (t.timestamp && now - t.timestamp > TRADE_EXPIRE_MS)) {
            delete database.pendingTrades[userId];
            staleTrades++;
          }
        }
        if (staleTrades > 0) console.log(`🧹 Cleared ${staleTrades} stale trade offer(s)`);
      }

      console.log('✅ Database loaded successfully');
      console.log(`👥 ${Object.keys(database.users).length} players loaded`);
    } else {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      saveDatabase();
      console.log('✅ New database created');
    }
  } catch (error) {
    console.error('❌ Error loading database:', error);
  }
};

const BACKUP_PATH = DB_PATH.replace('.json', '.backup.json');

const saveDatabase = () => {
  try {
    // Backup current file before overwriting
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, BACKUP_PATH);
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
  } catch (error) {
    console.error('❌ Error saving database:', error);
    // Try writing to backup path if main fails
    try {
      fs.writeFileSync(BACKUP_PATH, JSON.stringify(database, null, 2));
      console.log('⚠️ Saved to backup file instead.');
    } catch (e2) {
      console.error('❌ Backup save also failed:', e2);
    }
  }
};

// ── CRASH PROTECTION ──────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION — saving DB before crash:', err);
  try { saveDatabase(); } catch(e) {}
  // Don't exit — let the bot keep running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ UNHANDLED PROMISE REJECTION:', reason);
  // Don't exit — log and continue
});
// ──────────────────────────────────────────────────────────────────────────────

// Auto-save every 2 minutes
setInterval(saveDatabase, 2 * 60 * 1000);

// Daily quest reset
setInterval(() => {
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
  const now = new Date();
  if (now.getHours() === config.dailyResetHour) {
    console.log('🔄 Resetting daily quests...');
    database.dailyQuests = {};
    saveDatabase();
  }
}, 60 * 60 * 1000);

// Bank interest — check every 6 hours, pay monthly
setInterval(() => {
  if (!database.banks) return;
  const BankingSystem = require('./rpg/banking/BankingSystem');
  let paid = 0;
  for (const bankId in database.banks) {
    const result = BankingSystem.collectMonthlyInterest(database, bankId);
    if (result.success && result.interest > 0) {
      const bank = database.banks[bankId];
      const owner = database.users[bank.owner];
      if (owner) {
        owner.gold = (owner.gold || 0) + result.interest;
        console.log(`🏦 Bank interest paid: ${result.interest}g to ${owner.name} (${bank.name})`);
        paid++;
      }
    }
  }
  if (paid > 0) saveDatabase();
}, 6 * 60 * 60 * 1000); // check every 6 hours
setInterval(() => {
  if (!database.afkUsers) return;
  const now = Date.now();
  const AFK_EXPIRE_MS = 8 * 60 * 60 * 1000; // 8 hours
  let expired = 0;
  for (const [userId, afk] of Object.entries(database.afkUsers)) {
    if (now - afk.since > AFK_EXPIRE_MS) {
      delete database.afkUsers[userId];
      expired++;
    }
  }
  if (expired > 0) {
    saveDatabase();
    console.log(`🧹 Auto-cleared ${expired} expired AFK status(es)`);
  }
}, 30 * 60 * 1000); // check every 30 minutes

// Anti-spam
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Rate limiting
let messageCount = 0;
const MAX_MESSAGES_PER_MINUTE = 20;
const COMMAND_COOLDOWN = new Map();

setInterval(() => {
  messageCount = 0;
}, 60 * 1000);

setInterval(() => {
  const now = Date.now();
  for (const [user, time] of COMMAND_COOLDOWN.entries()) {
    if (now - time > 5 * 60 * 1000) {
      COMMAND_COOLDOWN.delete(user);
    }
  }
}, 5 * 60 * 1000);

const question = (text) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(text, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

// ========================================
// GATE AUTO-SPAWN SYSTEM
// ========================================
function startGateAutoSpawn(sock, getDatabase, saveDatabase) {
  const SPAWN_INTERVAL_MIN = 30 * 60 * 1000; // 30 minutes
  const SPAWN_INTERVAL_MAX = 60 * 60 * 1000; // 60 minutes

  function scheduleNextSpawn() {
    const delay = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    const delayMinutes = Math.floor(delay / 60000);
    
    console.log(`⏰ Next gate spawn in ${delayMinutes} minutes`);
    
    setTimeout(async () => {
      try {
        const db = getDatabase();
        const activeChats = new Set();
        
        // Get all active group chats
        Object.values(db.users).forEach(user => {
          if (user.lastChatId && user.lastChatId.endsWith('@g.us')) {
            activeChats.add(user.lastChatId);
          }
        });

        // Spawn gate in random active chat
        if (activeChats.size > 0) {
          const chats = Array.from(activeChats);
          const randomChat = chats[Math.floor(Math.random() * chats.length)];
          
          // Get average level
          const chatMembers = Object.values(db.users).filter(u => u.lastChatId === randomChat);
          const avgLevel = chatMembers.length > 0
            ? Math.floor(chatMembers.reduce((sum, u) => sum + (u.level || 1), 0) / chatMembers.length)
            : 10;

          const gate = GateManager.spawnGate(randomChat, avgLevel);
          const announcement = GateManager.formatGateAnnouncement(gate);
          
          await sock.sendMessage(randomChat, { text: announcement });
          console.log(`✅ Gate spawned: ${gate.id} (${gate.rank}-Rank) in chat ${randomChat.substring(0, 15)}...`);
        } else {
          console.log('⚠️ No active chats found for gate spawn');
        }
      } catch (error) {
        console.error('❌ Error spawning gate:', error.message);
      }

      // Schedule next spawn
      scheduleNextSpawn();
    }, delay);
  }

  scheduleNextSpawn();
  console.log('🚀 Gate auto-spawn system started!');
}

// ========================================
// MAIN BOT CONNECTION
// ========================================
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`📱 Using WhatsApp v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: ['Ani R.P.G Bot', 'Chrome', '10.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      return { conversation: '' };
    },
  });

  if (!state.creds.registered) {
    console.log('\n🔐 Bot not registered yet!');
    console.log('📱 QR Code will appear below. Scan with your phone.\n');
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 Scan this QR code:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.output?.payload?.error;
      
      console.log(`❌ Connection closed. Status: ${statusCode}, Reason: ${reason}`);

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      if (shouldReconnect) {
        const reconnectDelay = statusCode === 405 ? 30000 : 5000;
        console.log(`♻️ Reconnecting in ${reconnectDelay / 1000} seconds...`);
        setTimeout(() => connectToWhatsApp(), reconnectDelay);
      } else {
        console.log('🚫 Logged out. Please delete ./auth folder and restart.');
      }
    } else if (connection === 'open') {
      console.log('✅ Bot connected successfully!');
      console.log('🎮 RPG Bot is ready!');
      console.log(`⚡ Rate limit: ${MAX_MESSAGES_PER_MINUTE} messages/minute`);
      
      // ⭐ INITIALIZE REGENERATION SYSTEM
      try {
        RegenManager.initAllPlayers(getDatabase, saveDatabase, sock);
        const db = getDatabase();
        const playerCount = Object.keys(db.users).length;
        console.log(`🌟 Regeneration system initialized! (${playerCount} players)`);
      } catch (error) {
        console.error('❌ Failed to initialize regeneration:', error.message);
      }

      // ⭐ START GATE AUTO-SPAWN
      try {
        startGateAutoSpawn(sock, getDatabase, saveDatabase);
      } catch (error) {
        console.error('❌ Failed to start gate auto-spawn:', error.message);
      }

      // ⭐ START ARTIFACT SPAWN SYSTEM (every 2 hours per group chat)
      try {
        const artifactSpawnCmd = commands.get('claim');
        if (artifactSpawnCmd && artifactSpawnCmd.startSpawnCycle) {
          const db = getDatabase();
          const activeGroups = new Set();
          Object.values(db.users || {}).forEach(user => {
            if (user.groupId) activeGroups.add(user.groupId);
          });
          console.log(`🎁 Artifact spawn system ready! (${activeGroups.size} groups detected)`);
          activeGroups.forEach(gid => {
            try { artifactSpawnCmd.startSpawnCycle(sock, gid); } catch(e) {}
          });
        }
      } catch (error) {
        console.error('❌ Failed to start artifact spawn:', error.message);
      }

      // ⭐ INIT SEASON MANAGER (monthly rotating events)
      try {
        const db = getDatabase();
        const activeGroups = new Set();
        Object.values(db.users || {}).forEach(u => {
          if (u.lastChatId?.endsWith('@g.us')) activeGroups.add(u.lastChatId);
        });
        const groupList = [...activeGroups];
        SeasonManager.initFromSchedule(sock, groupList, (event) => {
          groupList.forEach(chatId => {
            Announcer.announceEventStart(sock, chatId, event).catch(()=>{});
          });
        });
        console.log('🌟 Season Manager initialized!');
      } catch(err) {
        console.error('❌ Season Manager init failed:', err.message);
      }

      // ⭐ GUILD WAR EXPIRY CHECK (every 10 min)
      try {
        setInterval(() => {
          try {
            const db = getDatabase();
            GuildWar.resolveExpiredWars(db, saveDatabase);
          } catch(e) {}
        }, 10 * 60 * 1000);
        console.log('⚔️ Guild War system initialized!');
      } catch(err) {
        console.error('❌ Guild War init failed:', err.message);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Group join/leave announcements ────────────────────────
  const CREATOR_ID  = '221951679328499';
  const COOWNER_ID  = '194592469209292';

  const JOIN_NARUTO = [
    "⚡ *THE CHOSEN ONE ARRIVES.*\nNaruto — creator of this world — has entered the server.\nAll who stand before him, bow. 🌀",
    "🌟 The heavens tremble. *@naruto* steps in.\nWhere he walks, legends are born.",
    "💥 Reality cracks. The bot's creator materializes from thin air.\n*Naruto* is here. You're in safe hands.",
    "🌀 *CREATOR ONLINE.* The architect of this realm descends.\nAll hail the one who built your adventure.",
    "⚡ A familiar energy fills the room. The one who made it all possible — *Naruto* — has arrived."
  ];

  const JOIN_COOWNER = [
    "👑 *CO-OWNER IN THE BUILDING.*\nThe second throne is occupied. Walk carefully.",
    "🔥 Co-owner detected. Adjust your behavior accordingly. *Or don't — see what happens.*",
    "💎 A pillar of the server just walked in. Respect where it's due.",
    "🌑 The co-owner arrives. The energy shifts. The vibe changes. Welcome.",
    "⚔️ Co-owner online. The chain of command is complete."
  ];

  const JOIN_MSGS = [
    `⚔️ *A new soul has entered the battlefield.*\n\n@{tag} just walked through the gates. The dungeon doesn't care if you're ready.\n\nWill you rise... or be forgotten like the rest?\n\n🩸 *Welcome to the guild. Don't die on the first floor.*`,
    `🌀 *The gates creak open.*\n\n@{tag} steps into the unknown. No map. No guide. Just instinct.\n\n📌 */register [name]* — your legend starts now.`,
    `💥 *NEW CHALLENGER DETECTED.*\n\n@{tag} has arrived. The monsters are already watching.\n\nDon't let them feast. 🔥`,
    `🌟 *A familiar energy stirs in the air...*\n\n@{tag} descended from somewhere better and chose HERE.\n\nHonored. Now prove you belong. ⚡`,
    `🐉 *Even the dragons looked up.*\n\n@{tag} just walked in. Something about them feels... dangerous.\n\n📌 */register [name]* to begin your ascent.`,
    `🌌 *From the void, a warrior emerges.*\n\n@{tag} has joined the realm. The board shifts.\n\nEvery legend starts somewhere. This is yours.`,
    `🎯 *Locked in. Loaded. Ready.*\n\n@{tag} just entered the arena and the crowd went silent.\n\nLet's see if the hype is real. ⚔️`,
    `🌊 *The tide brought something new.*\n\n@{tag} arrived. Whether storm or calm, only time will tell.\n\nWelcome. */register [name]* to start.`,
    `🔮 *Fate led you here.*\n\n@{tag} answered the call that most people ignore.\n\nThe dungeon awaits. Are you ready?`,
    `👊 *They didn't knock. They just walked in.*\n\n@{tag} owns this entrance energy and we respect it.\n\nGet registered. Get strong. Get legendary. 💎`,
    `🏹 *A shadow moves at the edge of the forest.*\n\n@{tag} has arrived, silent and purposeful.\n\nThe hunt begins. */register [name]*`,
    `⭐ *One more star added to the sky.*\n\n@{tag} joins the constellation of warriors who dared to show up.\n\nShine bright. Or burn out. Your choice. 🔥`,
    `🗡️ *Steel hits the floor as the newcomer draws their blade.*\n\n@{tag} is here. No pleasantries. Just purpose.\n\nWelcome to the battlefield.`,
    `💀 *The grim reaper looked up... and put the pen down.*\n\n@{tag} isn't going anywhere yet. They just got here.\n\n📌 */register [name]* — let the journey begin.`,
    `🌿 *Something stirs in the wilderness.*\n\n@{tag} emerged from wherever they were hiding.\n\nThe real world is overrated anyway. Welcome home. ⚔️`,
    `🔥 *Heat signature detected. New warrior incoming.*\n\n@{tag} has entered the compound.\n\nThe monsters have been notified. Good luck.`,
    `🏆 *The trophy case just got more competitive.*\n\n@{tag} stepped into the arena.\n\nEvery rank starts at zero. Grind or be left behind.`,
    `💫 *A ripple in the server. Then silence. Then —*\n\n@{tag} appeared.\n\nThe timeline adjusted itself. Welcome.`,
    `🌑 *From the darkness, a presence emerges.*\n\n@{tag} walks among us now.\n\nFriend or foe? Only the dungeons will decide. ⚔️`,
    `🎮 *Player spawned.*\n\n@{tag} loaded into the world. Stats: unknown. Potential: limitless.\n\nStart your journey — */register [name]*`
  ];

  const LEAVE_MSGS = [
    `💔 *The battlefield lost a soldier.*\n\n@{tag} has left. No fanfare. No explanation.\n\nJust an empty seat and a story that ends here.`,
    `🌑 *A light went out.*\n\n@{tag} departed. The server felt it.\n\nMay wherever they went treat them better than the dungeon did.`,
    `🚶 *They walked away without looking back.*\n\n@{tag} is gone. Some people know when to leave.\n\nRespect the exit.`,
    `❄️ *Gone cold.*\n\n@{tag} ghosted without a goodbye. No message. No warning.\n\nJust... gone. We'll pour one out.`,
    `💨 *Blink and you'd have missed it.*\n\n@{tag} vanished like smoke.\n\nThe void claims another.`,
    `🌊 *Returned to the sea.*\n\n@{tag} sailed off. The horizon swallowed them whole.\n\nFair winds, warrior. Fair winds.`,
    `🎭 *The curtain fell.*\n\n@{tag} left the stage.\n\nThe show continues without them.`,
    `⚡ *Signal lost.*\n\n@{tag} disconnected. The server grid has one fewer node.\n\nMaybe they'll respawn somewhere better.`,
    `🌌 *Returned to the void.*\n\n@{tag} faded. All things come and go.\n\nThe dungeon remembers everyone it loses.`,
    `🕯️ *The torch goes dark.*\n\n@{tag}'s flame is out.\n\nSomeone else will carry it now.`,
    `🏃 *No warning. No countdown.*\n\n@{tag} dipped. Clean exit.\n\nNot everyone needs a goodbye.`,
    `💀 *Name removed from the roster.*\n\n@{tag} has been erased from the active ranks.\n\nThe dungeon doesn't pause for departures.`,
    `🌙 *Last login: now.*\n\n@{tag} logged off and didn't come back.\n\nPeace to wherever they ended up.`,
    `📭 *An empty seat remains.*\n\n@{tag} left it behind. Someone else will fill it eventually.`,
    `🎲 *Cashed out.*\n\n@{tag} folded their hand and walked away from the table.\n\nSmart exit or early quit — only time will tell.`,
    `🗺️ *Left to find other realms.*\n\n@{tag} packed up and headed somewhere unknown.\n\nMay the dungeons out there be kinder.`,
    `🔇 *Silence where there was sound.*\n\n@{tag} went quiet. Permanently.\n\nThe server noticed the gap they left.`,
    `🎯 *Missed the mark and moved on.*\n\n@{tag} is gone.\n\nCome back when you're ready to aim again.`,
    `🌿 *Back to the wild.*\n\n@{tag} returned to wherever adventurers go when they disappear.`,
    `⚔️ *The sword is sheathed.*\n\n@{tag} chose to walk away from the fight.\n\nEvery warrior picks their battles. This one's done.`
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  sock.ev.on('group-participants.update', async ({ id: chatId, participants, action }) => {
    if (action !== 'add' && action !== 'remove') return;
    const db = getDatabase();
    const settings = db.groupSettings?.[chatId];
    if (settings?.announcements === false) return;

    for (const participant of participants) {
      const numStr = participant.replace(/[^0-9]/g, '');
      let text = '';
      const mentions = [participant];

      if (action === 'add') {
        if (numStr.startsWith(CREATOR_ID)) {
          text = pick(JOIN_NARUTO);
          text += '\n\n@' + participant;
        } else if (numStr.startsWith(COOWNER_ID)) {
          text = pick(JOIN_COOWNER);
          text += '\n\n@' + participant;
        } else {
          text = pick(JOIN_MSGS).replace('{tag}', participant);
        }
      } else {
        text = pick(LEAVE_MSGS).replace('{tag}', participant);
      }

      try {
        await sock.sendMessage(chatId, { text, mentions });
      } catch(e) {
        console.error('Announce error:', e.message);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const isGroup = msg.key.remoteJid?.endsWith('@g.us');
    const sender = isGroup 
      ? msg.key.participant
      : msg.key.remoteJid;

    const isValidSender = sender?.endsWith('@s.whatsapp.net') || sender?.endsWith('@lid');
    
    if (!isValidSender) {
      console.log(`⚠️ Ignored invalid message from: ${sender}`);
      return;
    }

    const messageText = 
      msg.message.conversation || 
      msg.message.extendedTextMessage?.text || 
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      '';

    // Check bannedUsers (used by ban.js) AND legacy banlist
    if (database.bannedUsers?.[sender] || database.banlist?.[sender]) {
      console.log(`🚫 Banned user tried to use bot: ${sender}`);
      return;
    }

    const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
    
    if (messageText.startsWith(config.prefix)) {
      if (messageCount >= MAX_MESSAGES_PER_MINUTE) {
        console.log(`⚠️ Rate limit reached (${messageCount}/${MAX_MESSAGES_PER_MINUTE}). Ignoring command.`);
        return;
      }

      const lastCommandTime = COMMAND_COOLDOWN.get(sender) || 0;
      const timeSinceLastCommand = Date.now() - lastCommandTime;
      
      if (timeSinceLastCommand < 3000) {
        const remainingTime = ((3000 - timeSinceLastCommand) / 1000).toFixed(1);
        console.log(`⏰ User ${sender} on cooldown (${remainingTime}s remaining)`);
        return sock.sendMessage(chatId, {
          text: `⏳ Slow down! Wait *${remainingTime}s* before your next command.`,
          mentions: [sender]
        }, { quoted: msg });
      }

      COMMAND_COOLDOWN.set(sender, Date.now());
      messageCount++;
      
      console.log(`📨 Command received (${messageCount}/${MAX_MESSAGES_PER_MINUTE}): ${messageText}`);
      
      const randomDelay = 1000 + Math.random() * 1000;
      await delay(randomDelay);
      
      await rpgCommandHandler(sock, msg, messageText, config, getDatabase, saveDatabase);
    }
  });

  process.on('SIGINT', () => {
    console.log('\n💾 Saving database before exit...');
    saveDatabase();
    sock.end();
    process.exit(0);
  });

  return sock;
}

// ========================================
// INITIALIZE BOT
// ========================================
loadDatabase();
connectToWhatsApp().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});