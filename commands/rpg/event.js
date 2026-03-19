// event.js — /event command
// Shows active event, lists all events, admin can force start/stop

const SeasonManager = require('../../rpg/utils/SeasonManager');

module.exports = {
  name: 'event',
  aliases: ['season', 'events'],
  description: 'View the current seasonal event and bonuses',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId  = msg.key?.remoteJid;
    const db      = getDatabase();
    const OWNER   = '221951679328499@lid';
    const isOwner = sender === OWNER || (db.botAdmins || []).includes(sender);

    const sub = args[0]?.toLowerCase();

    // ── ADMIN: force start event ────────────────────────────
    if (sub === 'start' && isOwner) {
      const eventId = args[1]?.toLowerCase();
      if (!eventId) {
        const list = SeasonManager.getAllSeasons().map((e,i) => `${i+1}. ${e.emoji} ${e.id}`).join('\n');
        return sock.sendMessage(chatId, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎮 *EVENT IDs*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${list}\n\nUsage: /event start [id]` }, { quoted: msg });
      }
      // Collect all active group chats
      const groupChats = new Set();
      Object.values(db.users).forEach(u => { if (u.lastChatId?.endsWith('@g.us')) groupChats.add(u.lastChatId); });
      const result = SeasonManager.startEvent(eventId, sock, [...groupChats], true);
      if (!result.success) return sock.sendMessage(chatId, { text: `❌ ${result.msg}\n\nValid IDs: ${SeasonManager.getAllSeasons().map(e=>e.id).join(', ')}` }, { quoted: msg });
      return sock.sendMessage(chatId, { text: `✅ *${result.event.name}* started!\nDuration: ${result.event.duration} days\nAnnounced to ${groupChats.size} group(s).` }, { quoted: msg });
    }

    // ── ADMIN: stop event ───────────────────────────────────
    if (sub === 'stop' && isOwner) {
      const was = SeasonManager.stopEvent();
      if (!was) return sock.sendMessage(chatId, { text: '❌ No active event to stop.' }, { quoted: msg });
      return sock.sendMessage(chatId, { text: `✅ *${was.name}* stopped.` }, { quoted: msg });
    }

    // ── LIST all events ─────────────────────────────────────
    if (sub === 'list' || sub === 'all') {
      const active = SeasonManager.getActiveEvent();
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🗓️ *ALL SEASONAL EVENTS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      SeasonManager.getAllSeasons().forEach(e => {
        const isActive = active?.id === e.id;
        txt += `${isActive ? '▶️' : '  '} ${e.emoji} *${e.name}*${isActive ? ' ← ACTIVE' : ''}\n`;
        txt += `   ⏰ ${e.duration} days | ${e.description}\n\n`;
      });
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 Events rotate monthly automatically!`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── SHOW current event (default) ────────────────────────
    const active = SeasonManager.getActiveEvent();
    if (!active) {
      // Show upcoming
      const month     = new Date().getMonth() + 1;
      const nextMonth = (month % 12) + 1;
      const upcoming  = SeasonManager.SEASONS[SeasonManager.MONTHLY_SCHEDULE[nextMonth]];
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n😴 *NO ACTIVE EVENT*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe realm rests between seasons.\n\n🗓️ *COMING NEXT MONTH:*\n${upcoming ? `${upcoming.emoji} *${upcoming.name}*\n💭 ${upcoming.description}` : 'Unknown'}\n\n💡 /event list — see all events\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: SeasonManager.formatEventStatus() }, { quoted: msg });
  }
};
