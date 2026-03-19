// ═══════════════════════════════════════════════════════════════
// /craft — Crafting system using Legendary Fragments + materials
// Fragments drop from dungeon full clears (1 per clear)
// ═══════════════════════════════════════════════════════════════

const RECIPES = [
  {
    id: 'void_core',
    name: '🌑 Void Core',
    type: 'artifact',
    rarity: 'epic',
    desc: 'A dense fragment of void energy. +20 ATK +20 DEF permanently.',
    bonus: { atk:20, def:20 },
    cost: { 'Legendary Fragment':3, gold:50000 },
    result_desc: '+20 ATK +20 DEF permanently',
  },
  {
    id: 'ancient_blade',
    name: '⚔️ Ancient Blade',
    type: 'weapon',
    rarity: 'epic',
    desc: 'Forged from ancient dungeon steel. +55 ATK.',
    bonus: { atk:55 },
    cost: { 'Legendary Fragment':5, gold:100000 },
  },
  {
    id: 'phantom_shield',
    name: '🛡️ Phantom Shield',
    type: 'artifact',
    rarity: 'epic',
    desc: '+30 DEF +50 Max HP permanently.',
    bonus: { def:30, maxHp:50 },
    cost: { 'Legendary Fragment':4, gold:80000 },
    result_desc: '+30 DEF +50 Max HP permanently',
  },
  {
    id: 'draconite_orb',
    name: '🐉 Draconite Orb',
    type: 'artifact',
    rarity: 'legendary',
    desc: 'Crafted from dragon essence. +35 ATK +25 DEF +20 SPD permanently.',
    bonus: { atk:35, def:25, speed:20 },
    cost: { 'Legendary Fragment':10, gold:500000 },
    result_desc: '+35 ATK +25 DEF +20 SPD permanently',
  },
  {
    id: 'abyss_sword',
    name: '🌌 Abyss Sword',
    type: 'weapon',
    rarity: 'legendary',
    desc: 'Forged in the void. The strongest craftable weapon. +100 ATK.',
    bonus: { atk:100 },
    cost: { 'Legendary Fragment':15, gold:1000000 },
  },
  {
    id: 'summon_ticket',
    name: '🎟️ Summon Ticket',
    type: 'ticket',
    rarity: 'rare',
    desc: 'Grants 1 free standard pull.',
    cost: { 'Legendary Fragment':2, gold:20000 },
  },
];

const RARITY_EMOJI = { common:'⚪', rare:'🔵', epic:'🟣', legendary:'🟡' };

function countFragments(player) {
  const items = player.inventory?.items || [];
  return items.filter(i => i.name === 'Legendary Fragment').length;
}

function spendFragments(player, count) {
  let spent = 0;
  player.inventory.items = (player.inventory.items || []).filter(i => {
    if (i.name === 'Legendary Fragment' && spent < count) { spent++; return false; }
    return true;
  });
}

module.exports = {
  name: 'craft',
  aliases: ['forge', 'crafting'],
  description: '🔨 Craft powerful items using Legendary Fragments',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });

    const sub   = (args[0] || '').toLowerCase();
    const frags = countFragments(player);

    // ── /craft  (menu) ─────────────────────────────────────────
    if (!sub || sub === 'list' || sub === 'menu') {
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔨 *CRAFTING FORGE*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📜 *Legendary Fragments:* ${frags}\n💰 Gold: ${(player.gold||0).toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      RECIPES.forEach((r, i) => {
        const re = RARITY_EMOJI[r.rarity];
        const fragCost = r.cost['Legendary Fragment'];
        const goldCost = r.cost.gold || 0;
        const canCraft = frags >= fragCost && (player.gold||0) >= goldCost;
        txt += `${i+1}. ${re} *${r.name}* [${r.rarity.toUpperCase()}]\n`;
        txt += `   ${r.desc}\n`;
        txt += `   Cost: 📜×${fragCost} + 💰${goldCost.toLocaleString()} ${canCraft ? '✅' : '❌'}\n\n`;
      });
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/craft [#] — craft by number\n📜 *Earn fragments:* Full-clear any dungeon!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /craft [number] ────────────────────────────────────────
    const idx = parseInt(sub) - 1;
    if (isNaN(idx) || idx < 0 || idx >= RECIPES.length) {
      return sock.sendMessage(chatId, { text: `❌ Invalid recipe number.\nUse /craft to see the list.` }, { quoted: msg });
    }

    const recipe   = RECIPES[idx];
    const fragCost = recipe.cost['Legendary Fragment'];
    const goldCost = recipe.cost.gold || 0;

    if (frags < fragCost) return sock.sendMessage(chatId, { text: `❌ Not enough fragments!\nNeed: 📜×${fragCost} | Have: 📜×${frags}\n\nFull-clear a dungeon to earn fragments!` }, { quoted: msg });
    if ((player.gold||0) < goldCost) return sock.sendMessage(chatId, { text: `❌ Not enough gold!\nNeed: ${goldCost.toLocaleString()}g | Have: ${(player.gold||0).toLocaleString()}g` }, { quoted: msg });

    // Craft it
    spendFragments(player, fragCost);
    player.gold = (player.gold||0) - goldCost;

    let resultMsg = '';

    if (recipe.type === 'weapon') {
      const curBonus = player.weapon?.bonus || 0;
      const newBonus = recipe.bonus?.atk || 0;
      if (newBonus > curBonus) {
        player.weapon = { name: recipe.name, bonus: newBonus, crafted: true };
        resultMsg = '⬆️ Equipped as your new weapon!';
      } else {
        const sellVal = { epic:20000, legendary:100000 }[recipe.rarity] || 5000;
        player.gold += sellVal;
        resultMsg = `💰 Sold for ${sellVal.toLocaleString()}g (you have a better weapon)`;
      }
    } else if (recipe.type === 'artifact') {
      if (!Array.isArray(player.summonArtifacts)) player.summonArtifacts = [];
      if (recipe.bonus) {
        for (const [stat, val] of Object.entries(recipe.bonus)) {
          if (stat === 'maxHp') { player.stats.maxHp = (player.stats.maxHp||100)+val; player.stats.hp=Math.min(player.stats.maxHp,player.stats.hp+val); }
          else if (player.stats[stat]!==undefined) player.stats[stat]=(player.stats[stat]||0)+val;
        }
      }
      player.summonArtifacts.push({ id:recipe.id, name:recipe.name, rarity:recipe.rarity, desc:recipe.result_desc||recipe.desc, bonus:recipe.bonus, crafted:true, constellation:1 });
      resultMsg = `✨ Applied! ${recipe.result_desc||recipe.desc}`;
    } else if (recipe.type === 'ticket') {
      player.summonTickets = (player.summonTickets||0) + 1;
      resultMsg = '🎟️ Added to your Summon Tickets!';
    }

    saveDatabase();
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔨 *CRAFTED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${RARITY_EMOJI[recipe.rarity]} *${recipe.name}* [${recipe.rarity.toUpperCase()}]\n${resultMsg}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📜 Fragments left: ${countFragments(player)}\n💰 Gold left: ${(player.gold||0).toLocaleString()}`
    }, { quoted: msg });
  }
};
