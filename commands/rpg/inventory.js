// ═══════════════════════════════════════════════════════════════
// /inventory (/inv alias) — Sectioned display: Gear / Potions / Pet Food / Consumables
// ═══════════════════════════════════════════════════════════════

module.exports = {
  name: 'inventory',
  aliases: ['inv'],
  description: 'View your full inventory',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered!\nUse /register [name] to start.' }, { quoted: msg });
    }

    const inv = player.inventory || {};
    const items = inv.items || [];

    // Separate into sections
    const gearItems       = items.filter(i => i.isGear);
    const petFoodItems    = items.filter(i => i.isPetFood || i.type === 'PetFood');
    const consumables     = items.filter(i => !i.isGear && !i.isPetFood && i.type !== 'PetFood' && i.type !== 'gear');

    // Old-style potions
    const oldPotions = [];
    if (inv.healthPotions  > 0) oldPotions.push({ name: 'Health Potion',  count: inv.healthPotions,  rarity: 'common',   type: 'Potion' });
    if ((inv.energyPotions || inv.manaPotions) > 0) oldPotions.push({ name: 'Energy Potion', count: inv.energyPotions || inv.manaPotions, rarity: 'common', type: 'Potion' });
    if (inv.reviveTokens   > 0) oldPotions.push({ name: 'Revive Token',   count: inv.reviveTokens,   rarity: 'uncommon', type: 'Consumable' });

    const rarityEmoji = { mythic:'🌌', legendary:'🟠', epic:'🟣', rare:'🔵', uncommon:'🟢', common:'⚪' };
    const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🎒 *INVENTORY* — ' + player.name + '\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🪙 Gold: ' + (player.gold || 0).toLocaleString() + '\n';
    message += '💎 Crystals: ' + (player.manaCrystals || 0) + '\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    // ── Gear ──────────────────────────────────────────────────
    message += '⚔️ *GEAR* (' + gearItems.length + ')\n';
    if (gearItems.length === 0) {
      message += '  _None — clear dungeons to find gear!_\n';
    } else {
      gearItems.sort((a,b) => (rarityOrder[a.rarity]||6)-(rarityOrder[b.rarity]||6));
      gearItems.forEach((g, i) => {
        const re = rarityEmoji[g.rarity] || '📦';
        message += `  ${i+1}. ${re} ${g.name} [${g.slot}] 🔧${g.durability}/${g.maxDurability}\n`;
      });
    }

    message += '\n💊 *POTIONS & CONSUMABLES*\n';
    for (const p of oldPotions) {
      const re = rarityEmoji[p.rarity] || '📦';
      message += `  ${re} ${p.name} ×${p.count}\n`;
    }
    // Stack consumables from items array
    const consStacked = {};
    for (const item of consumables) {
      const k = item.name;
      if (!consStacked[k]) consStacked[k] = { ...item, count: 0 };
      consStacked[k].count++;
    }
    const consSorted = Object.values(consStacked).sort((a,b)=>(rarityOrder[a.rarity]||6)-(rarityOrder[b.rarity]||6));
    if (consSorted.length === 0 && oldPotions.length === 0) message += '  _None_\n';
    for (const item of consSorted) {
      const re = rarityEmoji[item.rarity] || '📦';
      const cnt = item.count > 1 ? ' ×' + item.count : '';
      message += `  ${re} ${item.name}${cnt}\n`;
    }

    message += '\n🐾 *PET FOOD*\n';
    if (petFoodItems.length === 0) {
      message += '  _None_\n';
    } else {
      const foodStacked = {};
      for (const item of petFoodItems) {
        if (!foodStacked[item.name]) foodStacked[item.name] = { ...item, count: 0 };
        foodStacked[item.name].count++;
      }
      const foodSorted = Object.values(foodStacked).sort((a,b)=>(rarityOrder[a.rarity]||6)-(rarityOrder[b.rarity]||6));
      for (const item of foodSorted) {
        const re = rarityEmoji[item.rarity] || '🐾';
        message += `  ${re} ${item.name} ×${item.count}\n`;
      }
    }

    message += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '📌 /gear — manage gear\n';
    message += '📌 /find [name] — search inventory\n';
    message += '📌 /equip use [#] — use a consumable\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};
