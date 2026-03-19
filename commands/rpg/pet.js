// ═══════════════════════════════════════════════════════════════
// PET COMMAND - Player Pet Interface
// ═══════════════════════════════════════════════════════════════

const PetManager = require('../../rpg/utils/PetManager');
const { PET_DATABASE, PET_FOOD } = require('../../rpg/utils/PetDatabase');


module.exports = {
  name: 'pet',
  aliases: ['pets', 'companion'],
  description: 'Manage your pet companions',
  usage: '/pet <list|info|active|feed|evolve|rename|release>',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    try {
      const subCommand = (args[0] || 'list').toLowerCase();

      // ✅ DEFINE chatId HERE
      const chatId = msg.key.remoteJid;
      const db = getDatabase();
      const player = db.users[sender];

      if (!player) {
        return await sock.sendMessage(chatId, {
          text: '❌ You don\'t have a character! Use /register to start.'
        }, { quoted: msg });
      }

      // ✅ CHANGED senderId to sender
      PetManager.updateHunger(sender);

      switch (subCommand) {
        case 'list':
        case 'collection':
        case 'all':
          return await this.showPetList(sock, chatId, sender, msg);

        case 'info':
        case 'view':
        case 'stats':
          const petIndex = parseInt(args[1]) - 1;
          return await this.showPetInfo(sock, chatId, sender, petIndex, msg);

        case 'active':
        case 'current':
        case 'set':
          if (args[1]) {
            const setIndex = parseInt(args[1]) - 1;
            return await this.setActivePet(sock, chatId, sender, setIndex, msg);
          } else {
            return await this.showActivePet(sock, chatId, sender, msg);
          }

        case 'feed':
          const feedIndex = parseInt(args[1]) - 1;
          const foodItem = args.slice(2).join(' ');
          if (feedIndex < 0 || !foodItem) {
            return await sock.sendMessage(chatId, {
              text: '❌ Usage: `/pet feed <pet#> <food>`\nExample: `/pet feed 1 Meat`\n\nUse `/pet foods` to see available food!'
            }, { quoted: msg });
          }
          return await this.feedPet(sock, chatId, sender, feedIndex, foodItem, msg, getDatabase, saveDatabase);

        case 'foods':
        case 'food':
          return await this.showFoodList(sock, chatId, msg);

        case 'evolve':
          const evolveIndex = parseInt(args[1]) - 1;
          const evolutionChoice = args[2];
          if (evolveIndex < 0) {
            return await sock.sendMessage(chatId, {
              text: '❌ Usage: `/pet evolve <pet#> [evolution_id]`\nExample: `/pet evolve 1 king_slime`'
            }, { quoted: msg });
          }
          return await this.evolvePet(sock, chatId, sender, evolveIndex, evolutionChoice, msg);

        case 'rename':
        case 'nickname':
          const renameIndex = parseInt(args[1]) - 1;
          const newName = args.slice(2).join(' ');
          if (renameIndex < 0 || !newName) {
            return await sock.sendMessage(chatId, {
              text: '❌ Usage: `/pet rename <pet#> <new name>`\nExample: `/pet rename 1 Fluffy`'
            }, { quoted: msg });
          }
          return await this.renamePet(sock, chatId, sender, renameIndex, newName, msg);

        case 'release':
        case 'delete':
          const releaseIndex = parseInt(args[1]) - 1;
          if (releaseIndex < 0) {
            return await sock.sendMessage(chatId, {
              text: '❌ Usage: `/pet release <pet#>`\nExample: `/pet release 1`'
            }, { quoted: msg });
          }
          return await this.releasePet(sock, chatId, sender, releaseIndex, msg);

        case 'abilities':
        case 'skills':
          const abilityIndex = parseInt(args[1]) - 1;
          return await this.showPetAbilities(sock, chatId, sender, abilityIndex, msg);

        case 'catch':
        case 'capture':
          return await sock.sendMessage(chatId, {
            text: '💡 To catch pets, you need to find them in dungeons or specific locations!\n\nWhen you encounter a wild pet during exploration, use `/catch` to attempt to capture it.'
          }, { quoted: msg });

        default:
          return await sock.sendMessage(chatId, {
            text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐾 PET COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 View Pets:
• /pet list - All your pets
• /pet info <#> - Pet details
• /pet active - Current pet
• /pet abilities <#> - Pet skills

🎯 Manage Pets:
• /pet active <#> - Set active pet
• /pet feed <#> <food> - Feed pet
• /pet evolve <#> - Evolve pet
• /pet rename <#> <name> - Rename
• /pet release <#> - Release pet

📚 Information:
• /pet foods - Available food

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          }, { quoted: msg });
      }
    } catch (error) {
      console.error('Error in pet command:', error);
      const chatId = msg.key.remoteJid;
      await sock.sendMessage(chatId, {
        text: '❌ An error occurred while processing your pet command.'
      }, { quoted: msg });
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // SHOW PET LIST
  // ═══════════════════════════════════════════════════════════════
  async showPetList(sock, chatId, senderId, msg) {
    const playerData = PetManager.getPlayerData(senderId);

    if (playerData.pets.length === 0) {
      return await sock.sendMessage(chatId, {
        text: '📭 You don\'t have any pets yet!\n\n💡 Explore dungeons and locations to find wild pets to catch!'
      }, { quoted: msg });
    }

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🐾 YOUR PET COLLECTION\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    playerData.pets.forEach((pet, index) => {
      const isActive = playerData.activePet === pet.instanceId;
      const displayName = pet.nickname || pet.name;

      message += `${index + 1}. ${pet.emoji} ${displayName}${isActive ? ' ⭐' : ''}\n`;
      message += `   Lv.${pet.level} ${pet.rarity.toUpperCase()} | ${pet.type}\n`;
      message += `   💕 ${pet.bonding} | 😊 ${pet.happiness} | 🍖 ${pet.hunger}\n`;

      // Warnings
      if (pet.happiness < 30) message += `   ⚠️ Unhappy!\n`;
      if (pet.hunger > 70) message += `   ⚠️ Hungry!\n`;

      message += '\n';
    });

    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += `Total: ${playerData.pets.length}/20 pets\n`;
    message += '💡 Use `/pet info <#>` for details';

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // SHOW PET INFO
  // ═══════════════════════════════════════════════════════════════
  async showPetInfo(sock, chatId, senderId, petIndex, msg) {
    const playerData = PetManager.getPlayerData(senderId);
    const pet = playerData.pets[petIndex];

    if (!pet) {
      return await sock.sendMessage(chatId, {
        text: '❌ Pet not found! Use `/pet list` to see your pets.'
      }, { quoted: msg });
    }

    const petTemplate = PET_DATABASE[pet.id];
    const expReq = PetManager.getExpRequirement(pet.level);
    const expPercent = Math.floor((pet.exp / expReq) * 100);

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += `${pet.emoji} ${pet.nickname || pet.name}\n`;
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    message += `*Type:* ${pet.type} ${pet.rarity.toUpperCase()}\n`;
    message += `*Level:* ${pet.level}\n`;
    message += `*EXP:* ${pet.exp}/${expReq} (${expPercent}%)\n\n`;

    message += '*Stats:*\n';
    message += `❤️ HP: ${pet.stats.hp}\n`;
    message += `⚔️ ATK: ${pet.stats.atk}\n`;
    message += `🛡️ DEF: ${pet.stats.def}\n`;
    message += `⚡ SPD: ${pet.stats.spd}\n\n`;

    message += '*Bond & Care:*\n';
    message += `💕 Bonding: ${this.getProgressBar(pet.bonding, 100)} ${pet.bonding}/100\n`;
    message += `😊 Happiness: ${this.getProgressBar(pet.happiness, 100)} ${pet.happiness}/100\n`;
    message += `🍖 Hunger: ${this.getProgressBar(pet.hunger, 100)} ${pet.hunger}/100\n\n`;

    message += '*Battle Record:*\n';
    const winRate = pet.battles > 0 ? Math.floor((pet.wins / pet.battles) * 100) : 0;
    message += `⚔️ ${pet.battles} battles | ${pet.wins}W - ${pet.defeats}L (${winRate}%)\n\n`;

    // Abilities
    message += '*Abilities:*\n';
    pet.abilities.forEach((ability, index) => {
      message += `${index + 1}. ${ability.name} - ${ability.desc}\n`;
    });

    // Evolution info
    if (pet.evolution) {
      message += '\n*Evolution:*\n';
      if (pet.level >= pet.evolution.level) {
        message += `✅ Ready! Use: /pet evolve ${petIndex + 1}\n`;
        pet.evolution.options.forEach(opt => {
          message += `  → ${opt.name} (${opt.id})\n`;
        });
      } else {
        message += `❌ Level ${pet.evolution.level} required (Currently ${pet.level})\n`;
      }
    }

    // Preferred foods
    if (petTemplate.feedItems && petTemplate.feedItems.length > 0) {
      message += '\n*Favorite Foods:*\n';
      message += petTemplate.feedItems.join(', ');
    }

    message += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // SHOW ACTIVE PET
  // ═══════════════════════════════════════════════════════════════
  async showActivePet(sock, chatId, senderId, msg) {
    const pet = PetManager.getActivePet(senderId);

    if (!pet) {
      return await sock.sendMessage(chatId, {
        text: '❌ You don\'t have an active pet!\n\nUse `/pet active <#>` to set one.'
      }, { quoted: msg });
    }

    const statsString = PetManager.getPetStatsString(pet);

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '⭐ ACTIVE COMPANION\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    message += statsString;
    message += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '💡 Your pet assists in battles!';

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // SET ACTIVE PET
  // ═══════════════════════════════════════════════════════════════
  async setActivePet(sock, chatId, senderId, petIndex, msg) {
    const playerData = PetManager.getPlayerData(senderId);
    const pet = playerData.pets[petIndex];

    if (!pet) {
      return await sock.sendMessage(chatId, {
        text: '❌ Pet not found! Use `/pet list` to see your pets.'
      }, { quoted: msg });
    }

    const result = PetManager.setActivePet(senderId, pet.instanceId);
    await sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // FEED PET
  // ═══════════════════════════════════════════════════════════════
  async feedPet(sock, chatId, senderId, petIndex, foodItem, msg, getDatabase, saveDatabase) {
    const { PET_FOOD } = require('../../rpg/utils/PetDatabase');
    const db = getDatabase ? getDatabase() : null;
    const player = db ? db.users[senderId] : null;
    const playerData = PetManager.getPlayerData(senderId);
    const pet = playerData.pets[petIndex];

    if (!pet) {
      return await sock.sendMessage(chatId, {
        text: '❌ Pet not found! Use `/pet list` to see your pets.'
      }, { quoted: msg });
    }

    // Case-insensitive food key lookup
    const foodKey = Object.keys(PET_FOOD).find(k => k.toLowerCase() === foodItem.toLowerCase());
    if (!foodKey) {
      return await sock.sendMessage(chatId, {
        text: `❌ Unknown food: "${foodItem}"\n\nUse /food to see your food inventory.`
      }, { quoted: msg });
    }

    // Check player inventory for this food
    const PET_FOOD_NAMES = new Set([
      'Gel','Water','Meat','Bone','Coal','Fish','Fire Gem','Electric Crystal',
      'Metal','Shadow Essence','Dragon Meat','Rare Gems','Spirit Essence',
      'Celestial Fruit','Ice Crystal','Phoenix Tears','Chaos Shard',
      'Ancient Stone','Void Crystal','Star Dust','Primordial Essence','Existence Shard'
    ]);

    // Check player's real inventory for this food
    let itemIdx = -1;
    if (player && player.inventory && player.inventory.items) {
      itemIdx = player.inventory.items.findIndex(i =>
        (i.isPetFood || PET_FOOD_NAMES.has(i.name) || (i.type||'').toLowerCase() === 'petfood') &&
        i.name.toLowerCase() === foodKey.toLowerCase()
      );
    }

    if (itemIdx === -1) {
      return await sock.sendMessage(chatId, {
        text: `❌ You don't have any *${foodKey}*!\n\n💡 Use /food to see your food inventory.`
      }, { quoted: msg });
    }

    // Consume one from inventory
    player.inventory.items.splice(itemIdx, 1);
    if (saveDatabase) saveDatabase();

    const result = PetManager.feedPet(senderId, pet.instanceId, foodKey);

    if (!result.success) {
      return await sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
    }

    let message = `${result.message}\n\n`;
    message += `💕 Bonding: +${result.bondingGain}\n`;
    message += `😊 Happiness: +${result.happinessGain}\n`;
    message += `🍖 Hunger: ${result.pet.hunger}/100`;

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // SHOW FOOD LIST
  // ═══════════════════════════════════════════════════════════════
  async showFoodList(sock, chatId, msg) {
    // This is /pet foods — shows all TYPES of food that exist (reference list)
    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🍖 ALL PET FOOD TYPES\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    const foodByRarity = {
      common: [], uncommon: [], rare: [], epic: [], legendary: [], mythic: []
    };

    for (const [name, stats] of Object.entries(PET_FOOD)) {
      if (foodByRarity[stats.rarity]) foodByRarity[stats.rarity].push({ name, ...stats });
    }

    const rarityEmoji = { common:'⚪', uncommon:'🟢', rare:'🔵', epic:'🟣', legendary:'🟠', mythic:'🌌' };
    for (const [rarity, foods] of Object.entries(foodByRarity)) {
      if (foods.length === 0) continue;
      message += `${rarityEmoji[rarity]} *${rarity.toUpperCase()}*\n`;
      foods.forEach(food => {
        message += `  • ${food.name} — 💕+${food.bonding} 😊+${food.happiness}\n`;
      });
      message += '\n';
    }

    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '📌 /food — your food inventory\n';
    message += '📌 /pet feed [#] [food name]';

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // EVOLVE PET
  // ═══════════════════════════════════════════════════════════════
  async evolvePet(sock, chatId, senderId, petIndex, evolutionChoice, msg) {
    const playerData = PetManager.getPlayerData(senderId);
    const pet = playerData.pets[petIndex];

    if (!pet) {
      return await sock.sendMessage(chatId, {
        text: '❌ Pet not found! Use `/pet list` to see your pets.'
      }, { quoted: msg });
    }

    if (!pet.evolution) {
      return await sock.sendMessage(chatId, {
        text: `❌ ${pet.emoji} ${pet.nickname || pet.name} cannot evolve!`
      }, { quoted: msg });
    }

    if (pet.level < pet.evolution.level) {
      return await sock.sendMessage(chatId, {
        text: `❌ ${pet.emoji} ${pet.nickname || pet.name} must reach level ${pet.evolution.level} to evolve! (Currently ${pet.level})`
      }, { quoted: msg });
    }

    // If no evolution choice provided, show options
    if (!evolutionChoice) {
      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `🌟 EVOLUTION OPTIONS\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `${pet.emoji} ${pet.nickname || pet.name} can evolve into:\n\n`;

      pet.evolution.options.forEach(opt => {
        const evolvedPet = PET_DATABASE[opt.id];
        message += `${evolvedPet.emoji} *${opt.name}*\n`;
        message += `  ID: ${opt.id}\n`;
        message += `  ${evolvedPet.description}\n`;

        if (opt.requires) {
          message += `  Requirements:\n`;
          if (opt.requires.bonding) {
            const hasBonding = pet.bonding >= opt.requires.bonding;
            message += `  ${hasBonding ? '✅' : '❌'} Bonding ${opt.requires.bonding} (Current: ${pet.bonding})\n`;
          }
          if (opt.requires.item) {
            message += `  • ${opt.requires.item}\n`;
          }
        }
        message += '\n';
      });

      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `💡 Use: /pet evolve ${petIndex + 1} <evolution_id>`;

      return await sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // Attempt evolution
    const result = PetManager.evolvePet(senderId, pet.instanceId, evolutionChoice);

    if (!result.success) {
      return await sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
    }

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🌟 EVOLUTION!\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    message += `${result.message}\n\n`;

    if (result.newAbilities.length > 0) {
      message += '*New Abilities Learned:*\n';
      result.newAbilities.forEach(ability => {
        message += `• ${ability.name} - ${ability.desc}\n`;
      });
    }

    message += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // RENAME PET
  // ═══════════════════════════════════════════════════════════════
  async renamePet(sock, chatId, senderId, petIndex, newName, msg) {
    const playerData = PetManager.getPlayerData(senderId);
    const pet = playerData.pets[petIndex];

    if (!pet) {
      return await sock.sendMessage(chatId, {
        text: '❌ Pet not found! Use `/pet list` to see your pets.'
      }, { quoted: msg });
    }

    const result = PetManager.renamePet(senderId, pet.instanceId, newName);
    await sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // RELEASE PET
  // ═══════════════════════════════════════════════════════════════
  async releasePet(sock, chatId, senderId, petIndex, msg) {
    const playerData = PetManager.getPlayerData(senderId);
    const pet = playerData.pets[petIndex];

    if (!pet) {
      return await sock.sendMessage(chatId, {
        text: '❌ Pet not found! Use `/pet list` to see your pets.'
      }, { quoted: msg });
    }

    // Confirmation required
    const result = PetManager.releasePet(senderId, pet.instanceId);
    await sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // SHOW PET ABILITIES
  // ═══════════════════════════════════════════════════════════════
  async showPetAbilities(sock, chatId, senderId, petIndex, msg) {
    const playerData = PetManager.getPlayerData(senderId);
    const pet = playerData.pets[petIndex];

    if (!pet) {
      return await sock.sendMessage(chatId, {
        text: '❌ Pet not found! Use `/pet list` to see your pets.'
      }, { quoted: msg });
    }

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += `${pet.emoji} ${pet.nickname || pet.name}'S ABILITIES\n`;
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    if (pet.abilities.length === 0) {
      message += '📭 No abilities learned yet.';
    } else {
      pet.abilities.forEach((ability, index) => {
        message += `${index + 1}. *${ability.name}*\n`;
        message += `   ${ability.desc}\n`;
        message += `   Type: ${ability.type}`;
        if (ability.damage) message += ` | Damage: ${ability.damage}`;
        if (ability.aoe) message += ` | AOE`;
        message += '\n';

        if (ability.effect) {
          message += `   Effect: `;
          const effects = [];
          for (const [key, value] of Object.entries(ability.effect)) {
            effects.push(`${key} ${value}`);
          }
          message += effects.join(', ');
          message += '\n';
        }
        message += '\n';
      });
    }

    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '💡 Pets use abilities automatically in battle!';

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // HELPER: GET PROGRESS BAR
  // ═══════════════════════════════════════════════════════════════
  getProgressBar(current, max, length = 10) {
    const percent = Math.min(1, current / max);
    const filled = Math.floor(percent * length);
    const empty = length - filled;
    return '🟢'.repeat(filled) + '⚪'.repeat(empty);
  }
};