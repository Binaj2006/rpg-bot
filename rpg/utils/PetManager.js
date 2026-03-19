// ═══════════════════════════════════════════════════════════════
// PET MANAGER - Pet System Handler
// ═══════════════════════════════════════════════════════════════

const { PET_DATABASE, PET_FOOD } = require('./PetDatabase');
const fs = require('fs').promises;
const path = require('path');

class PetManager {
  constructor() {
    this.petsFile = path.join(__dirname, '../data/playerPets.json');
    this.playerPets = new Map();
    this.init();
  }

  async init() {
    try {
      const data = await fs.readFile(this.petsFile, 'utf8');
      const pets = JSON.parse(data);
      this.playerPets = new Map(Object.entries(pets));
    } catch (error) {
      this.playerPets = new Map();
    }
  }

  async save() {
    try {
      const obj = Object.fromEntries(this.playerPets);
      await fs.writeFile(this.petsFile, JSON.stringify(obj, null, 2));
    } catch (error) {
      console.error('Failed to save pets:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GET PLAYER PET DATA
  // ═══════════════════════════════════════════════════════════════
  getPlayerData(playerId) {
    if (!this.playerPets.has(playerId)) {
      this.playerPets.set(playerId, {
        pets: [],
        activePet: null,
        storage: []
      });
    }
    return this.playerPets.get(playerId);
  }

  // ═══════════════════════════════════════════════════════════════
  // ATTEMPT TO CATCH A PET
  // ═══════════════════════════════════════════════════════════════
  attemptCatch(playerId, petId, bonusRate = 0, guaranteed = false) {
    const petTemplate = PET_DATABASE[petId];
    if (!petTemplate) {
      return { success: false, message: '❌ Unknown pet!' };
    }

    const playerData = this.getPlayerData(playerId);

    // Check pet limit (max 20 pets)
    if (playerData.pets.length >= 20) {
      return { success: false, message: '❌ Your pet storage is full! (Max 20 pets)' };
    }

    // Guaranteed catch (Paladin / owner)
    if (guaranteed) {
      const newPet = this.createPet(petTemplate);
      playerData.pets.push(newPet);
      if (!playerData.activePet) playerData.activePet = newPet.instanceId;
      this.save();
      return { success: true, message: `✨ Guaranteed capture! You caught ${petTemplate.name}!`, pet: newPet, isFirstPet: playerData.pets.length === 1 };
    }

    // Harder base catch rates (halved from template), bonus from luck potions
    const baseRate = Math.max(5, (petTemplate.catchRate || 50) * 0.5);
    const catchRate = Math.min(85, baseRate + bonusRate);
    const roll = Math.random() * 100;

    if (roll > catchRate) {
      return {
        success: false,
        message: `💨 ${petTemplate.name} broke free! (${Math.floor(catchRate)}% chance)`,
        almostCaught: roll <= catchRate + 10
      };
    }

    // Successfully caught!
    const newPet = this.createPet(petTemplate);
    playerData.pets.push(newPet);

    // Auto-set as active if no active pet
    if (!playerData.activePet) {
      playerData.activePet = newPet.instanceId;
    }

    this.save();

    return {
      success: true,
      message: `✨ You caught ${petTemplate.name}!`,
      pet: newPet,
      isFirstPet: playerData.pets.length === 1
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CREATE A NEW PET INSTANCE
  // ═══════════════════════════════════════════════════════════════
  createPet(template) {
    return {
      instanceId: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      id: template.id,
      name: template.name,
      nickname: null,
      rarity: template.rarity,
      type: template.type,
      emoji: template.emoji,
      level: 1,
      exp: 0,
      stats: { ...template.baseStats },
      bonding: 0, // 0-100 bonding level
      happiness: 100, // 0-100 happiness
      hunger: 0, // 0-100 hunger (higher = more hungry)
      lastFed: Date.now(),
      battles: 0,
      wins: 0,
      defeats: 0,
      abilities: template.abilities.filter(a => a.level <= 1), // Start with level 1 abilities
      evolution: template.evolution,
      acquiredDate: Date.now()
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FEED A PET
  // ═══════════════════════════════════════════════════════════════
  feedPet(playerId, petInstanceId, foodItem) {
    const playerData = this.getPlayerData(playerId);
    const pet = playerData.pets.find(p => p.instanceId === petInstanceId);

    if (!pet) {
      return { success: false, message: '❌ Pet not found!' };
    }

    // Case-insensitive food lookup
    const foodKey = Object.keys(PET_FOOD).find(k => k.toLowerCase() === foodItem.toLowerCase());
    const food = foodKey ? PET_FOOD[foodKey] : null;
    if (!food) {
      const foodList = Object.keys(PET_FOOD).join(', ');
      return { success: false, message: `❌ Unknown food: "${foodItem}"\n\nAvailable: ${foodList}` };
    }

    // Check if pet likes this food
    const petTemplate = PET_DATABASE[pet.id];
    const preferredFood = (petTemplate?.feedItems || []).map(f => f.toLowerCase());
    const isPreferred = preferredFood.includes(foodKey.toLowerCase());

    // Calculate bonding and happiness gain
    let bondingGain = food.bonding;
    let happinessGain = food.happiness;

    if (isPreferred) {
      bondingGain *= 2;
      happinessGain *= 1.5;
    }

    // Apply gains
    pet.bonding = Math.min(100, pet.bonding + bondingGain);
    pet.happiness = Math.min(100, pet.happiness + happinessGain);
    pet.hunger = Math.max(0, pet.hunger - 50);
    pet.lastFed = Date.now();

    this.save();

    return {
      success: true,
      message: isPreferred 
        ? `${pet.emoji} ${pet.nickname || pet.name} loved the ${foodKey}! ❤️`
        : `${pet.emoji} ${pet.nickname || pet.name} ate the ${foodKey}.`,
      bondingGain,
      happinessGain,
      pet
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GAIN PET EXPERIENCE
  // ═══════════════════════════════════════════════════════════════
  gainExp(playerId, petInstanceId, expAmount, won = true) {
    const playerData = this.getPlayerData(playerId);
    const pet = playerData.pets.find(p => p.instanceId === petInstanceId);

    if (!pet) return null;

    pet.exp += expAmount;
    pet.battles += 1;
    if (won) pet.wins += 1;
    else pet.defeats += 1;

    const levelsGained = [];
    const template = PET_DATABASE[pet.id];

    // Check for level ups
    while (pet.exp >= this.getExpRequirement(pet.level)) {
      pet.exp -= this.getExpRequirement(pet.level);
      pet.level += 1;
      levelsGained.push(pet.level);

      // Increase stats
      pet.stats.hp += template.growthRates.hp;
      pet.stats.atk += template.growthRates.atk;
      pet.stats.def += template.growthRates.def;
      pet.stats.spd += template.growthRates.spd;

      // Learn new abilities
      const newAbilities = template.abilities.filter(a => 
        a.level === pet.level && !pet.abilities.find(learned => learned.name === a.name)
      );
      pet.abilities.push(...newAbilities);

      // Check for evolution
      if (pet.evolution && pet.level >= pet.evolution.level) {
        // Evolution available but not automatic
      }
    }

    this.save();

    return {
      pet,
      levelsGained,
      newAbilities: levelsGained.length > 0 ? pet.abilities.filter(a => 
        levelsGained.includes(a.level)
      ) : []
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GET EXP REQUIREMENT FOR LEVEL
  // ═══════════════════════════════════════════════════════════════
  getExpRequirement(level) {
    return Math.floor(50 * Math.pow(level, 1.5));
  }

  // ═══════════════════════════════════════════════════════════════
  // EVOLVE A PET
  // ═══════════════════════════════════════════════════════════════
  evolvePet(playerId, petInstanceId, evolutionChoice) {
    const playerData = this.getPlayerData(playerId);
    const pet = playerData.pets.find(p => p.instanceId === petInstanceId);

    if (!pet) {
      return { success: false, message: '❌ Pet not found!' };
    }

    if (!pet.evolution) {
      return { success: false, message: '❌ This pet cannot evolve!' };
    }

    if (pet.level < pet.evolution.level) {
      return { success: false, message: `❌ Pet must be level ${pet.evolution.level} to evolve!` };
    }

    const evolutionOption = pet.evolution.options.find(opt => opt.id === evolutionChoice);
    if (!evolutionOption) {
      return { success: false, message: '❌ Invalid evolution choice!' };
    }

    // Check requirements
    if (evolutionOption.requires.bonding && pet.bonding < evolutionOption.requires.bonding) {
      return {
        success: false,
        message: `❌ Requires ${evolutionOption.requires.bonding} bonding! (Current: ${pet.bonding})`
      };
    }

    // Evolve the pet
    const newTemplate = PET_DATABASE[evolutionChoice];
    if (!newTemplate) {
      return { success: false, message: '❌ Evolution data not found!' };
    }

    const oldName = pet.name;
    
    // Update pet with new evolution
    pet.id = newTemplate.id;
    pet.name = newTemplate.name;
    pet.emoji = newTemplate.emoji;
    pet.rarity = newTemplate.rarity;
    pet.type = newTemplate.type;
    pet.evolution = newTemplate.evolution;

    // Boost stats
    pet.stats.hp += 20;
    pet.stats.atk += 10;
    pet.stats.def += 8;
    pet.stats.spd += 5;

    // Learn evolution abilities
    pet.abilities = [...pet.abilities, ...newTemplate.abilities.filter(a => a.level <= pet.level)];

    this.save();

    return {
      success: true,
      message: `🌟 ${oldName} evolved into ${newTemplate.name}!`,
      pet,
      newAbilities: newTemplate.abilities.filter(a => a.level <= pet.level)
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SET ACTIVE PET
  // ═══════════════════════════════════════════════════════════════
  setActivePet(playerId, petInstanceId) {
    const playerData = this.getPlayerData(playerId);
    const pet = playerData.pets.find(p => p.instanceId === petInstanceId);

    if (!pet) {
      return { success: false, message: '❌ Pet not found!' };
    }

    playerData.activePet = petInstanceId;
    this.save();

    return {
      success: true,
      message: `${pet.emoji} ${pet.nickname || pet.name} is now your active pet!`,
      pet
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GET ACTIVE PET
  // ═══════════════════════════════════════════════════════════════
  getActivePet(playerId) {
    const playerData = this.getPlayerData(playerId);
    if (!playerData.activePet) return null;

    return playerData.pets.find(p => p.instanceId === playerData.activePet);
  }

  // ═══════════════════════════════════════════════════════════════
  // RENAME PET
  // ═══════════════════════════════════════════════════════════════
  renamePet(playerId, petInstanceId, newNickname) {
    const playerData = this.getPlayerData(playerId);
    const pet = playerData.pets.find(p => p.instanceId === petInstanceId);

    if (!pet) {
      return { success: false, message: '❌ Pet not found!' };
    }

    if (newNickname.length > 20) {
      return { success: false, message: '❌ Nickname must be 20 characters or less!' };
    }

    pet.nickname = newNickname;
    this.save();

    return {
      success: true,
      message: `✅ Pet renamed to "${newNickname}"!`,
      pet
    };
  }  // ✅ REMOVED COMMA HERE

  // ═══════════════════════════════════════════════════════════════
  // RELEASE A PET
  // ═══════════════════════════════════════════════════════════════
  releasePet(playerId, petInstanceId) {
    const playerData = this.getPlayerData(playerId);
    const petIndex = playerData.pets.findIndex(p => p.instanceId === petInstanceId);

    if (petIndex === -1) {
      return { success: false, message: '❌ Pet not found!' };
    }

    const pet = playerData.pets[petIndex];
    playerData.pets.splice(petIndex, 1);

    // Clear active pet if it was released
    if (playerData.activePet === petInstanceId) {
      playerData.activePet = playerData.pets.length > 0 ? playerData.pets[0].instanceId : null;
    }

    this.save();

    return {
      success: true,
      message: `👋 You released ${pet.emoji} ${pet.nickname || pet.name}. It waves goodbye...`
    };
  }  // ✅ REMOVED COMMA HERE

  // ═══════════════════════════════════════════════════════════════
  // UPDATE HUNGER SYSTEM
  // ═══════════════════════════════════════════════════════════════
  updateHunger(playerId) {
    const playerData = this.getPlayerData(playerId);
    const now = Date.now();
    const hoursPassed = (now - (playerData.lastHungerCheck || now)) / (1000 * 60 * 60);

    if (hoursPassed < 1) return; // Update once per hour

    playerData.pets.forEach(pet => {
      // Increase hunger over time
      pet.hunger = Math.min(100, pet.hunger + (hoursPassed * 5));

      // Decrease happiness if very hungry
      if (pet.hunger > 70) {
        pet.happiness = Math.max(0, pet.happiness - (hoursPassed * 2));
      }
    });

    playerData.lastHungerCheck = now;
    this.save();
  }  // ✅ REMOVED COMMA HERE

  // ═══════════════════════════════════════════════════════════════
  // PET ASSIST IN BATTLE
  // ═══════════════════════════════════════════════════════════════
  getPetBattleBonus(playerId) {
    const pet = this.getActivePet(playerId);
    if (!pet) return null;

    // Bonus based on bonding and happiness
    const bondingBonus = pet.bonding / 100;
    const happinessBonus = pet.happiness / 100;
    const totalBonus = (bondingBonus + happinessBonus) / 2;

    return {
      pet,
      bonuses: {
        atk: Math.floor(pet.stats.atk * totalBonus * 0.45),
        def: Math.floor(pet.stats.def * totalBonus * 0.45),
        spd: Math.floor(pet.stats.spd * totalBonus * 0.45)
      },
      canUseAbility: pet.happiness > 30 && pet.hunger < 80
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // USE PET ABILITY IN BATTLE
  // ═══════════════════════════════════════════════════════════════
  usePetAbility(playerId, abilityIndex = 0) {
    const pet = this.getActivePet(playerId);
    if (!pet) return null;

    if (pet.happiness < 30) {
      return {
        success: false,
        message: `${pet.emoji} ${pet.nickname || pet.name} is too unhappy to help!`
      };
    }

    if (pet.hunger > 80) {
      return {
        success: false,
        message: `${pet.emoji} ${pet.nickname || pet.name} is too hungry to fight!`
      };
    }

    const ability = pet.abilities[abilityIndex];
    if (!ability) {
      return {
        success: false,
        message: '❌ Pet doesn\'t know that ability!'
      };
    }

    // Reduce happiness slightly after using ability
    pet.happiness = Math.max(0, pet.happiness - 5);
    this.save();

    // Apply 45% of original ability damage (55% reduction)
    const scaledAbility = ability.damage > 0
      ? { ...ability, damage: Math.floor(ability.damage * 0.45) }
      : ability;

    return {
      success: true,
      ability: scaledAbility,
      pet,
      message: `${pet.emoji} ${pet.nickname || pet.name} used ${ability.name}!`
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GET PET STATS STRING
  // ═══════════════════════════════════════════════════════════════
  getPetStatsString(pet) {
    const expReq = this.getExpRequirement(pet.level);
    const expPercent = Math.floor((pet.exp / expReq) * 100);

    let stats = `${pet.emoji} *${pet.nickname || pet.name}*\n`;
    stats += `Level ${pet.level} | ${pet.rarity.toUpperCase()}\n`;
    stats += `Type: ${pet.type}\n\n`;

    stats += `❤️ HP: ${pet.stats.hp}\n`;
    stats += `⚔️ ATK: ${pet.stats.atk}\n`;
    stats += `🛡️ DEF: ${pet.stats.def}\n`;
    stats += `⚡ SPD: ${pet.stats.spd}\n\n`;

    stats += `📊 EXP: ${pet.exp}/${expReq} (${expPercent}%)\n`;
    stats += `💕 Bonding: ${pet.bonding}/100\n`;
    stats += `😊 Happiness: ${pet.happiness}/100\n`;
    stats += `🍖 Hunger: ${pet.hunger}/100\n\n`;

    stats += `⚔️ Battles: ${pet.battles} (${pet.wins}W/${pet.defeats}L)\n`;

    return stats;
  }
}

module.exports = new PetManager();