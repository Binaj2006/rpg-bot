// ═══════════════════════════════════════════════════════════════
// /summon — Multi-banner gacha system
// Standard | Weapon | Limited (rate-up, 50/50)
// Pity per banner | Constellation | Refinement | Pull history
// ═══════════════════════════════════════════════════════════════
const BS = require('../../rpg/utils/BannerSystem');

function getState(player, bannerId) {
  if (!player.bannerState) player.bannerState = {};
  if (!player.bannerState[bannerId]) player.bannerState[bannerId] = { pity: 0, guaranteedRateUp: false };
  return player.bannerState[bannerId];
}

function rarityLine(rarity, rates) {
  const e = BS.RARITY_EMOJI[rarity] || '⚪';
  return `${e} ${rarity.charAt(0).toUpperCase()+rarity.slice(1)}: ${rates[rarity] || '0%'}`;
}

function pityBar(pity, soft, hard) {
  const filled = Math.min(20, Math.round((pity / hard) * 20));
  return '[' + '█'.repeat(filled) + '░'.repeat(20 - filled) + `] ${pity}/${hard}`;
}

module.exports = {
  name: 'summon',
  aliases: ['pull', 'gacha', 'banner'],
  description: '🎲 Multi-banner gacha — Standard, Weapon, and Limited rate-up banners',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });

    const sub  = (args[0] || '').toLowerCase();
    const sub2 = (args[1] || '').toLowerCase();

    // ── /summon  (banner selection menu) ──────────────────────
    if (!sub || sub === 'menu' || sub === 'banners') {
      const db2 = getDatabase();
      const limited = db2.activeLimitedBanner;
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎲 *SUMMON PORTAL*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💎 Crystals: *${player.manaCrystals||0}*\n\n`;
      txt += `⭐ *Standard Banner* — always open\n   /summon standard x1 (100💎) | x10 (900💎)\n\n`;
      txt += `⚔️ *Weapon Banner* — weapons only, faster pity\n   /summon weapon x1 (100💎) | x10 (900💎)\n\n`;
      if (limited && Date.now() < limited.expiresAt) {
        const days = Math.ceil((limited.expiresAt - Date.now()) / 86400000);
        txt += `🌟 *LIMITED BANNER* ← ⏰ Ends in ${days}d\n   *${limited.name}*\n   ${limited.desc}\n   50/50 mechanic — win = rate-up guaranteed!\n   /summon limited x1 (160💎) | x10 (1440💎)\n\n`;
      } else {
        txt += `🌟 *Limited Banner* — No active banner\n   Watch for special events!\n\n`;
      }
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/summon [banner] pity  — pity counters\n/summon history        — last 20 pulls\n/summon collection     — weapons & artifacts\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /summon history ────────────────────────────────────────
    if (sub === 'history') {
      const hist = player.summonHistory || [];
      if (!hist.length) return sock.sendMessage(chatId, { text: '📭 No pull history yet! Use /summon to start.' }, { quoted: msg });
      const lines = hist.slice(0, 20).map((h, i) => {
        const re = BS.RARITY_EMOJI[h.rarity] || '⚪';
        const d  = new Date(h.timestamp);
        const ds = `${d.getDate()}/${d.getMonth()+1}`;
        return `${i+1}. ${re} *${h.itemName}* [${h.bannerId}] ${ds}`;
      });
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📜 *PULL HISTORY (last 20)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /summon collection ─────────────────────────────────────
    if (sub === 'collection' || sub === 'artifacts' || sub === 'weapons') {
      const arts = player.summonArtifacts || [];
      const weaps = player.summonWeapons ? Object.values(player.summonWeapons) : [];
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🗃️ *SUMMON COLLECTION*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      if (weaps.length) {
        txt += `\n⚔️ *WEAPONS*\n`;
        weaps.forEach(w => { txt += `${BS.RARITY_EMOJI[w.rarity]} *${w.name}* R${w.refinement||1} (+${w.bonus?.atk||0} ATK)\n`; });
      }
      if (arts.length) {
        txt += `\n🏺 *ARTIFACTS*\n`;
        arts.forEach(a => { txt += `${BS.RARITY_EMOJI[a.rarity]} *${a.name}* C${a.constellation||1}\n   ${a.desc}\n`; });
      }
      if (!weaps.length && !arts.length) txt += '\n📭 Nothing yet — start pulling!';
      txt += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── Banner-specific commands ───────────────────────────────
    // /summon [banner] pity | x1 | x10
    const VALID_BANNERS = ['standard', 'weapon', 'limited'];
    if (!VALID_BANNERS.includes(sub)) {
      return sock.sendMessage(chatId, {
        text: `❌ Unknown command.\n\nUse /summon to see all banners.\n/summon [standard|weapon|limited] x1\n/summon [banner] pity`
      }, { quoted: msg });
    }

    const bannerId = sub;
    const banner   = BS.BANNERS[bannerId];
    const state    = getState(player, bannerId);
    const rates    = BS.getBannerRates(bannerId);

    // Check limited banner is active
    if (bannerId === 'limited') {
      const lb = db.activeLimitedBanner;
      if (!lb || Date.now() > lb.expiresAt) {
        return sock.sendMessage(chatId, { text: '❌ No active limited banner right now!\nCheck back during special events.' }, { quoted: msg });
      }
    }

    // ── /summon [banner] pity ──────────────────────────────────
    if (sub2 === 'pity' || sub2 === 'info') {
      const p    = state.pity || 0;
      const soft = banner.softPityAt;
      const hard = banner.hardPityAt;
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${banner.emoji} *${banner.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      txt += `🎯 *PITY:* ${pityBar(p, soft, hard)}\n`;
      txt += `🟣 Soft pity at: ${soft} | 🟡 Hard pity at: ${hard}\n`;
      if (bannerId === 'limited') {
        txt += `\n🎰 *50/50 Status:*\n`;
        txt += state.guaranteedRateUp ? `✅ *Guaranteed rate-up!* (You lost last 50/50)` : `🎲 50/50 active — 50% chance for rate-up`;
      }
      txt += `\n\n📊 *REAL RATES*\n${rarityLine('rare',rates)}\n${rarityLine('epic',rates)}\n${rarityLine('legendary',rates)}`;
      txt += `\n\nPity resets ONLY on legendary.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /summon [banner] x1 | x10 ─────────────────────────────
    const isMulti  = sub2 === 'x10' || sub2 === '10';
    const isSingle = sub2 === 'x1'  || sub2 === '1' || sub2 === 'single';
    if (!isSingle && !isMulti) {
      return sock.sendMessage(chatId, {
        text: `${banner.emoji} *${banner.name}*\n${banner.desc}\n\n💡 Commands:\n/summon ${bannerId} x1  — ${banner.costCrystals}💎\n/summon ${bannerId} x10 — ${banner.cost10Crystals}💎\n/summon ${bannerId} pity — your pity counter\n\n📊 Rates: ${rarityLine('rare',rates)} | ${rarityLine('epic',rates)} | ${rarityLine('legendary',rates)}`
      }, { quoted: msg });
    }

    const cost  = isMulti ? banner.cost10Crystals : banner.costCrystals;
    const count = isMulti ? 10 : 1;

    if ((player.manaCrystals||0) < cost) {
      return sock.sendMessage(chatId, {
        text: `❌ Not enough crystals!\nNeed: *${cost}💎* | Have: *${player.manaCrystals||0}💎*\n\n💡 Earn from: dungeons, world boss, /daily, events, /pass`
      }, { quoted: msg });
    }

    player.manaCrystals -= cost;

    const results = [];
    for (let i = 0; i < count; i++) {
      const item = BS.doPull(bannerId, state);
      if (!item) continue;
      const outcome = BS.applyDuplicate(player, item);
      BS.recordPull(player, bannerId, item);
      results.push({ item, outcome });
    }

    try { const BP2=require('../../rpg/utils/BattlePass'); BP2.addPassXP(player,'summon_pull',count); } catch(e) {}
    saveDatabase();

    // ── Format output ─────────────────────────────────────────
    const PFXMAP = { common:'', rare:'✨ ', epic:'💫 ', legendary:'🌟 ' };

    if (isSingle) {
      const { item, outcome } = results[0];
      const special = item.rarity==='legendary' ? '\n\n🌟🌟 *LEGENDARY PULL!* 🌟🌟' : item.rarity==='epic' ? '\n\n💫 *EPIC!*' : '';
      const isLimitedRU = bannerId==='limited' && BS.BANNERS.limited.rateUpIds?.includes(item.id);
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${banner.emoji} *SUMMON RESULT*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${PFXMAP[item.rarity]||''}${BS.RARITY_EMOJI[item.rarity]} *${item.name}* [${item.rarity.toUpperCase()}]${isLimitedRU?' ⭐ RATE-UP':''}\n` +
          `${outcome.msg}${special}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💎 Left: *${player.manaCrystals}* | 🎯 Pity: *${state.pity}/${banner.hardPityAt}*`
      }, { quoted: msg });
    }

    // 10-pull
    const lines = results.map((r,i) => {
      const isRU = bannerId==='limited' && BS.BANNERS.limited.rateUpIds?.includes(r.item.id);
      return `${i+1}. ${PFXMAP[r.item.rarity]||''}${BS.RARITY_EMOJI[r.item.rarity]} *${r.item.name}*${isRU?' ⭐':''}\n   └ ${r.outcome.msg}`;
    }).join('\n\n');

    const legs  = results.filter(r=>r.item.rarity==='legendary');
    const epics = results.filter(r=>r.item.rarity==='epic');
    const highlight = legs.length ? `\n\n🌟 *${legs.length} LEGENDARY!* 🌟` : epics.length ? `\n\n💫 *${epics.length} EPIC(S)!*` : '';

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${banner.emoji} *10-PULL*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${lines}${highlight}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💎 Left: *${player.manaCrystals}* | 🎯 Pity: *${state.pity}/${banner.hardPityAt}*`
    }, { quoted: msg });
  }
};
