// /title — View, equip and manage activity-earned titles
const { TITLES, checkAndAwardTitles, getTitleDisplay } = require('../../rpg/utils/TitleSystem');

module.exports = {
  name: 'title',
  aliases: ['titles'],
  description: '🎖️ View and equip your earned titles (each gives a stat boost)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();

    // Check for newly earned titles on every /title command
    const newTitles = checkAndAwardTitles(player);
    if (newTitles.length) saveDatabase();

    const owned = player.titles || [];
    const equipped = player.equippedTitle;

    // ── /title equip [name] ────────────────────────────────────
    if (sub === 'equip' || sub === 'use' || sub === 'set') {
      if (!args[1]) {
        return sock.sendMessage(chatId, {
          text: `❌ Specify a title to equip!\n/title equip [title name]\n\nUse /title to see your titles.`
        }, { quoted: msg });
      }
      const query = args.slice(1).join(' ');
      // Match by partial name (case insensitive)
      const match = Object.keys(TITLES).find(id =>
        owned.includes(id) &&
        (id.toLowerCase().includes(query.toLowerCase()) ||
         TITLES[id].display.toLowerCase().includes(query.toLowerCase()))
      );
      if (!match) {
        return sock.sendMessage(chatId, {
          text: `❌ Title *"${query}"* not found or not yet earned!\n\nUse /title to see your titles.`
        }, { quoted: msg });
      }
      player.equippedTitle = match;
      saveDatabase();
      const def = TITLES[match];
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *TITLE EQUIPPED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${def.display}\n\n⚡ *Stat Boost:* ${def.boostDesc}\n\n💡 Your title shows in /profile, /rank, and PvP!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /title unequip ─────────────────────────────────────────
    if (sub === 'unequip' || sub === 'remove') {
      if (!player.equippedTitle) return sock.sendMessage(chatId, { text: '❌ No title equipped.' }, { quoted: msg });
      const was = TITLES[player.equippedTitle]?.display || player.equippedTitle;
      delete player.equippedTitle;
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ Unequipped *${was}*.` }, { quoted: msg });
    }

    // ── /title all — show all available titles ─────────────────
    if (sub === 'all' || sub === 'list') {
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *ALL TITLES*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      const categories = {
        'PvP':     ['Duelist','Blade Master','War God','Unbreakable','Grandmaster'],
        'Dungeon': ['Gate Breaker','Conqueror','Nightmare Slayer'],
        'Boss':    ['Boss Hunter','Raid Legend'],
        'Level':   ['Rising Hunter','Elite Hunter','Shadow Monarch'],
        'Daily':   ['Devoted','Veteran'],
        'Gacha':   ['Lucky Star','Collector'],
        'Special': ['Shadow Hunter','Shadow Survivor','War Veteran'],
      };
      for (const [cat, ids] of Object.entries(categories)) {
        txt += `\n*${cat}:*\n`;
        for (const id of ids) {
          const def = TITLES[id];
          if (!def) continue;
          const have = owned.includes(id);
          const eq   = equipped === id;
          const icon = eq ? '✅' : have ? '🔓' : '🔒';
          txt += `${icon} ${def.display}\n   ${def.desc}\n   ⚡ ${def.boostDesc}\n`;
        }
      }
      txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ = Equipped | 🔓 = Owned | 🔒 = Locked`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /title  (main view — your earned titles) ───────────────
    if (!owned.length) {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *YOUR TITLES*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📭 No titles yet!\n\n💡 Titles are earned through gameplay:\n• Win PvP battles\n• Clear dungeons\n• Defeat world bosses\n• Reach level milestones\n• Pull legendaries in gacha\n\n/title all — see all available titles\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *YOUR TITLES* (${owned.length})\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    for (const id of owned) {
      const def = TITLES[id];
      if (!def) continue;
      const isEquipped = equipped === id;
      txt += `${isEquipped ? '✅' : '🎖️'} *${def.display}*${isEquipped ? ' ← EQUIPPED' : ''}\n`;
      txt += `   ⚡ ${def.boostDesc}\n\n`;
    }

    if (newTitles.length) {
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎊 *JUST UNLOCKED!*\n`;
      for (const id of newTitles) txt += `🆕 ${TITLES[id]?.display || id}\n`;
      txt += '\n';
    }

    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/title equip [name] — equip a title\n/title all          — see all titles`;
    return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
  }
};
