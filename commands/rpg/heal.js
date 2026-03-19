module.exports = {
  name: 'heal',
  description: 'Use health or energy potions',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      await sock.sendMessage(chatId, { 
        text: '❌ You are not registered!' 
      }, { quoted: msg });
      return;
    }

    if (!player.inventory) {
      player.inventory = { healthPotions: 0, energyPotions: 0, reviveTokens: 0 };
    }

    const action = args[0]?.toLowerCase();

    // ═══════════════════════════════════════
    // 📋 HEAL MENU
    // ═══════════════════════════════════════
    if (!action) {
      // Check if in battle
      const inSoloBattle = player.dungeon?.currentBattle || player.boss?.currentBattle;
      const party = Object.values(db.parties || {}).find(p => p.members.includes(sender));
      const inPartyBattle = party && db.partyBattles?.[party.id];
      
      let battleStatus = '';
      if (inSoloBattle) {
        battleStatus = '\n⚔️ *IN SOLO BATTLE* - Can use potions!\n';
      } else if (inPartyBattle) {
        battleStatus = '\n⚔️ *IN PARTY BATTLE* - Can use potions!\n';
      } else {
        battleStatus = '\n✅ Available anytime\n';
      }

      const menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💊 HEALING MENU 💊
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 YOUR POTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🩹 Health Potions: ${player.inventory.healthPotions}
   Restores: 50% HP
   
${player.energyColor} ${player.energyType} Potions: ${player.inventory.energyPotions || player.inventory.manaPotions || 0}
   Restores: 50% ${player.energyType}
${battleStatus}━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/heal health - Use Health Potion
/heal energy - Use ${player.energyType} Potion

💡 Buy more at /shop
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(chatId, { text: menu }, { quoted: msg });
      return;
    }

    // ═══════════════════════════════════════
    // 🩹 USE HEALTH POTION
    // ═══════════════════════════════════════
    if (action === 'health' || action === 'hp') {
      if (player.inventory.healthPotions <= 0) {
        await sock.sendMessage(chatId, { 
          text: '❌ You have no Health Potions!\n\nBuy them at /shop\nPrice: 50 gold each' 
        }, { quoted: msg });
        return;
      }

      if (player.stats.hp >= player.stats.maxHp) {
        await sock.sendMessage(chatId, { 
          text: '❌ Your HP is already full!\n\n❤️ HP: ' + player.stats.hp + '/' + player.stats.maxHp 
        }, { quoted: msg });
        return;
      }

      const healAmount = Math.floor(player.stats.maxHp * 0.5);
      const oldHp = player.stats.hp;
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healAmount);
      const actualHeal = player.stats.hp - oldHp;
      player.inventory.healthPotions--;
      
      // ✅ CHECK IF IN BATTLE (solo or party)
      const inSoloBattle = player.dungeon?.currentBattle || player.boss?.currentBattle;
      const party = Object.values(db.parties || {}).find(p => p.members.includes(sender));
      const inPartyBattle = party && db.partyBattles?.[party.id];
      
      let battleNote = '';
      if (inSoloBattle) {
        battleNote = '\n\n⚔️ Used in battle!';
      } else if (inPartyBattle) {
        battleNote = '\n\n⚔️ Used in party battle!';
        
        // Update party battle participant HP
        const participant = db.partyBattles[party.id].participants.find(p => p.id === sender);
        if (participant) {
          participant.currentHp = player.stats.hp;
        }
      }
      
      saveDatabase();

      let response = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💚 HEALTH POTION USED 💚
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🩹 ${player.name} used Health Potion!

✨ Restored: +${actualHeal} HP

❤️ HP: ${player.stats.hp}/${player.stats.maxHp}
🩹 Potions Left: ${player.inventory.healthPotions}${battleNote}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(chatId, { text: response }, { quoted: msg });
      return;
    }

    // ═══════════════════════════════════════
    // 💙 USE ENERGY POTION
    // ═══════════════════════════════════════
    if (action === 'energy' || action === 'mana' || action === 'stamina' || 
        action === 'focus' || action === 'rage' || action === 'faith' || 
        action === 'blood' || action === 'dragon' || action === 'force') {
      
      // ✅ Check both old 'manaPotions' and new 'energyPotions'
      const energyPotions = player.inventory.energyPotions || player.inventory.manaPotions || 0;
      
      if (energyPotions <= 0) {
        await sock.sendMessage(chatId, { 
          text: `❌ You have no ${player.energyType} Potions!\n\nBuy them at /shop\nPrice: 40 gold each` 
        }, { quoted: msg });
        return;
      }

      if (player.stats.energy >= player.stats.maxEnergy) {
        await sock.sendMessage(chatId, { 
          text: `❌ Your ${player.energyType} is already full!\n\n${player.energyColor} ${player.energyType}: ${player.stats.energy}/${player.stats.maxEnergy}` 
        }, { quoted: msg });
        return;
      }

      const restoreAmount = Math.floor(player.stats.maxEnergy * 0.5);
      const oldEnergy = player.stats.energy;
      player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + restoreAmount);
      const actualRestore = player.stats.energy - oldEnergy;
      
      // Update correct inventory field
      if (player.inventory.energyPotions) {
        player.inventory.energyPotions--;
      } else {
        player.inventory.manaPotions--;
      }
      
      // ✅ CHECK IF IN BATTLE (solo or party)
      const inSoloBattle = player.dungeon?.currentBattle || player.boss?.currentBattle;
      const party = Object.values(db.parties || {}).find(p => p.members.includes(sender));
      const inPartyBattle = party && db.partyBattles?.[party.id];
      
      let battleNote = '';
      if (inSoloBattle) {
        battleNote = '\n\n⚔️ Used in battle!';
      } else if (inPartyBattle) {
        battleNote = '\n\n⚔️ Used in party battle!';
      }
      
      saveDatabase();

      let response = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
${player.energyColor} ${player.energyType.toUpperCase()} POTION USED ${player.energyColor}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💙 ${player.name} used ${player.energyType} Potion!

✨ Restored: +${actualRestore} ${player.energyType}

${player.energyColor} ${player.energyType}: ${player.stats.energy}/${player.stats.maxEnergy}
💙 Potions Left: ${player.inventory.energyPotions || player.inventory.manaPotions || 0}${battleNote}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(chatId, { text: response }, { quoted: msg });
      return;
    }

    await sock.sendMessage(chatId, { 
      text: '❌ Invalid option!\n\nUse: /heal health or /heal energy' 
    }, { quoted: msg });
  }
};