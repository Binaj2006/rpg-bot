
function updatePlayerGold(player, amount, saveDatabase) {
  if (!player) {
    console.error('❌ updatePlayerGold: Invalid player');
    return false;
  }

  // Initialize gold
  if (player.gold === undefined) player.gold = 0;

  // Update gold
  player.gold += amount;
  
  // Prevent negative
  if (player.gold < 0) {
    console.warn(`⚠️ Gold negative for ${player.name}, setting to 0`);
    player.gold = 0;
  }

  // Sync inventory
  if (!player.inventory) {
    player.inventory = {
      healthPotions: 0,
      manaPotions: 0,
      energyPotions: 0,
      reviveTokens: 0,
      gold: player.gold
    };
  } else {
    player.inventory.gold = player.gold;
  }

  // Save
  if (saveDatabase) {
    try {
      saveDatabase();
      console.log(`✅ Gold updated for ${player.name}: ${player.gold}`);
    } catch (error) {
      console.error('❌ Failed to save database:', error);
      return false;
    }
  }

  return true;
}

module.exports = { updatePlayerGold };
