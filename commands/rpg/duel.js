// /duel @user — Quick instant PvP (one action each, no back-and-forth)
// Perfect for a quick fight in any group, especially the PvP group
const LevelUpManager = require('../../rpg/utils/LevelUpManager');

const ACTIONS = ['attack', 'guard', 'counter'];
const ACTION_EMOJI = { attack:'⚔️', guard:'🛡️', counter:'🔄' };

// Simple rock-paper-scissors: attack beats counter, counter beats guard, guard beats attack
const BEATS = { attack:'counter', counter:'guard', guard:'attack' };

function rollAction() { return ACTIONS[Math.floor(Math.random() * ACTIONS.length)]; }

function calcDamage(atk, def, action, oppAction) {
  let base = Math.max(5, atk - Math.floor(def * 0.5));
  if (action === 'attack' && oppAction === 'counter') base = Math.floor(base * 0.3);  // punished
  if (action === 'counter' && oppAction === 'attack') base = Math.floor(base * 1.8);  // counter wins
  if (action === 'guard') base = 0; // guard deals no damage
  if (BEATS[action] === oppAction) base = Math.floor(base * 1.3); // general advantage
  const crit = Math.random() < 0.15;
  return { damage: crit ? Math.floor(base * 1.5) : base, crit };
}

const DUEL_COOLDOWN = new Map(); // in-memory cooldown

module.exports = {
  name: 'duel',
  description: '⚡ Quick instant PvP — one action each, instant result!',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const challenger = db.users[sender];
    if (!challenger) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });

    // Cooldown — 60 seconds
    const lastDuel = DUEL_COOLDOWN.get(sender) || 0;
    const cdLeft = Math.max(0, 60_000 - (Date.now() - lastDuel));
    if (cdLeft > 0) return sock.sendMessage(chatId, { text: `⏳ Duel cooldown! Wait *${Math.ceil(cdLeft/1000)}s*` }, { quoted: msg });

    if (challenger.pvpBattle) return sock.sendMessage(chatId, { text: '❌ Finish your current PvP battle first!' }, { quoted: msg });

    const mentionedId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedId) return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ *QUICK DUEL*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nInstant PvP — both sides pick one action, result is instant!\n\n📌 Usage: /duel @user\n⏱️ Cooldown: 60 seconds\n\nActions are random — pure stats & luck!\n(For full strategy PvP, use /pvp challenge @user)`
    }, { quoted: msg });

    if (mentionedId === sender) return sock.sendMessage(chatId, { text: '❌ Cannot duel yourself!' }, { quoted: msg });
    const opponent = db.users[mentionedId];
    if (!opponent) return sock.sendMessage(chatId, { text: '❌ That player is not registered!' }, { quoted: msg });
    if (opponent.pvpBattle) return sock.sendMessage(chatId, { text: '❌ That player is in a PvP battle!' }, { quoted: msg });

    DUEL_COOLDOWN.set(sender, Date.now());
    DUEL_COOLDOWN.set(mentionedId, Date.now());

    // Both get random actions (simulating instant choice)
    const cAct = rollAction();
    const oAct = rollAction();

    // Compute damage
    const cAtk = (challenger.stats.atk || 10) + (challenger.weapon?.bonus || 0);
    const oDef  = opponent.stats.def || 5;
    const oAtk  = (opponent.stats.atk || 10) + (opponent.weapon?.bonus || 0);
    const cDef  = challenger.stats.def || 5;

    const cResult = calcDamage(cAtk, oDef, cAct, oAct);
    const oResult = calcDamage(oAtk, cDef, oAct, cAct);

    // Apply damage (capped at 30% of max HP for fairness)
    const cMaxDmg = Math.floor(challenger.stats.maxHp * 0.3);
    const oMaxDmg = Math.floor(opponent.stats.maxHp * 0.3);
    const cTook = Math.min(oResult.damage, cMaxDmg);
    const oTook = Math.min(cResult.damage, oMaxDmg);

    challenger.stats.hp = Math.max(1, challenger.stats.hp - cTook);
    opponent.stats.hp   = Math.max(1, opponent.stats.hp   - oTook);

    // Determine winner
    const cNet = oTook - cTook;
    const winner   = cNet > 0 ? challenger : cNet < 0 ? opponent : null;
    const winnerId = cNet > 0 ? sender : cNet < 0 ? mentionedId : null;
    const loserId  = cNet > 0 ? mentionedId : cNet < 0 ? sender : null;

    // Rewards — small since no ELO at stake
    const goldReward = 200 + Math.floor((winner?.level || 1) * 10);
    if (winner) {
      winner.gold = (winner.gold || 0) + goldReward;
      winner.xp   = (winner.xp   || 0) + 50;
      LevelUpManager.checkAndApplyLevelUps(winner, saveDatabase, sock, chatId);
    }

    saveDatabase();

    const cCls = challenger.class?.name || challenger.class || 'Hunter';
    const oCls = opponent.class?.name   || opponent.class   || 'Hunter';

    const resultLine = winner
      ? `🏆 *${winner.name}* wins the duel! (+${goldReward}g +50xp)`
      : `🤝 *DRAW!* Both fighters are evenly matched!`;

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ *QUICK DUEL!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${ACTION_EMOJI[cAct]} *${challenger.name}* [${cCls}] — **${cAct.toUpperCase()}**\n` +
        `  Dealt: ${oTook} dmg${cResult.crit ? ' 💥 CRIT!' : ''} | Took: ${cTook} dmg\n` +
        `  ❤️ ${challenger.stats.hp}/${challenger.stats.maxHp}\n\n` +
        `  ⚡ VS ⚡\n\n` +
        `${ACTION_EMOJI[oAct]} *${opponent.name}* [${oCls}] — **${oAct.toUpperCase()}**\n` +
        `  Dealt: ${cTook} dmg${oResult.crit ? ' 💥 CRIT!' : ''} | Took: ${oTook} dmg\n` +
        `  ❤️ ${opponent.stats.hp}/${opponent.stats.maxHp}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${resultLine}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 For full strategy PvP: /pvp challenge @user`,
      mentions: [sender, mentionedId]
    }, { quoted: msg });
  }
};
