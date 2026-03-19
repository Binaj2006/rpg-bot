const DungeonManager = require('./DungeonManager');

class GateManager {
  static activeGates = {}; // Format: { chatId: { gateId, rank, spawnTime, breakTime, cleared, monsters } }
  static gateIdCounter = 1;
  
  // Gate spawn intervals (in minutes)
  static SPAWN_MIN_INTERVAL = 30; // 30 minutes
  static SPAWN_MAX_INTERVAL = 60; // 60 minutes
  static GATE_BREAK_TIME = 120; // 2 hours before gate breaks
  
  // Generate a new gate for a chat
  static spawnGate(chatId, averageLevel = 1) {
    const gateId = `GATE-${this.gateIdCounter++}`;
    
    // Determine gate rank based on average level
    const rank = this.determineGateRank(averageLevel);
    
    // Generate monsters for this gate
    const monsters = this.generateGateMonsters(rank, averageLevel);
    
    const gate = {
      id: gateId,
      chatId: chatId,
      rank: rank,
      spawnTime: Date.now(),
      breakTime: Date.now() + (this.GATE_BREAK_TIME * 60 * 1000),
      cleared: false,
      broken: false,
      monsters: monsters,
      minLevel: this.getRankMinLevel(rank),
      recommendedPartySize: Math.min(5, Math.max(3, Math.floor(monsters.length / 2))),
      rewards: this.calculateGateRewards(rank, averageLevel)
    };
    
    this.activeGates[gateId] = gate;
    
    return gate;
  }
  
  // ✅ NEW METHOD - Spawn gate with specific rank
  static spawnGateWithRank(chatId, averageLevel = 1, rank) {
    const gateId = `GATE-${this.gateIdCounter++}`;
    
    // Validate rank
    const validRanks = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
    if (!validRanks.includes(rank)) {
      rank = this.determineGateRank(averageLevel);
    }
    
    // Generate monsters for this gate
    const monsters = this.generateGateMonsters(rank, averageLevel);
    
    const gate = {
      id: gateId,
      chatId: chatId,
      rank: rank,
      spawnTime: Date.now(),
      breakTime: Date.now() + (this.GATE_BREAK_TIME * 60 * 1000),
      cleared: false,
      broken: false,
      monsters: monsters,
      minLevel: this.getRankMinLevel(rank),
      recommendedPartySize: Math.min(5, Math.max(3, Math.floor(monsters.length / 2))),
      rewards: this.calculateGateRewards(rank, averageLevel)
    };
    
    this.activeGates[gateId] = gate;
    
    return gate;
  }
  
  // Determine gate rank based on average player level in group
  static determineGateRank(avgLevel) {
    const roll = Math.random();
    
    if (avgLevel <= 5) {
      return roll < 0.7 ? 'F' : 'E';
    } else if (avgLevel <= 10) {
      if (roll < 0.4) return 'F';
      if (roll < 0.8) return 'E';
      return 'D';
    } else if (avgLevel <= 20) {
      if (roll < 0.3) return 'E';
      if (roll < 0.6) return 'D';
      return 'C';
    } else if (avgLevel <= 30) {
      if (roll < 0.3) return 'D';
      if (roll < 0.6) return 'C';
      return 'B';
    } else if (avgLevel <= 40) {
      if (roll < 0.3) return 'C';
      if (roll < 0.6) return 'B';
      return 'A';
    } else {
      if (roll < 0.3) return 'B';
      if (roll < 0.6) return 'A';
      return 'S';
    }
  }
  
  static getRankMinLevel(rank) {
    const minLevels = {
      'F': 1, 'E': 6, 'D': 11, 'C': 21, 'B': 31, 'A': 41, 'S': 51
    };
    return minLevels[rank] || 1;
  }
  
  // Generate monsters for gate based on rank
  static generateGateMonsters(rank, avgLevel) {
    const monsterCount = rank === 'S' ? 8 : rank === 'A' ? 7 : rank === 'B' ? 6 : 5;
    const dungeonTemplates = DungeonManager.getDungeonTemplates();
    
    // Get dungeon template for this rank
    const template = dungeonTemplates.find(d => d.rank === rank && avgLevel >= d.minLevel && avgLevel <= d.maxLevel);
    
    if (!template) {
      // Fallback to generating basic monsters
      return this.generateFallbackMonsters(rank, monsterCount, avgLevel);
    }
    
    const monsters = [];
    for (let i = 0; i < monsterCount; i++) {
      const monsterName = template.monsters[Math.floor(Math.random() * template.monsters.length)];
      const monster = DungeonManager.createMonsterByName(monsterName, avgLevel);
      if (monster) monsters.push(monster);
    }
    
    return monsters.length > 0 ? monsters : this.generateFallbackMonsters(rank, monsterCount, avgLevel);
  }
  
  static generateFallbackMonsters(rank, count, avgLevel) {
    const monsters = [];
    const baseHp = { 'F': 50, 'E': 100, 'D': 200, 'C': 400, 'B': 600, 'A': 800, 'S': 1000 }[rank] || 50;
    const baseAtk = { 'F': 10, 'E': 20, 'D': 35, 'C': 55, 'B': 75, 'A': 95, 'S': 120 }[rank] || 10;
    
    for (let i = 0; i < count; i++) {
      monsters.push({
        name: `${rank}-Rank Monster`,
        rank: rank,
        emoji: '👹',
        abilities: ['Strike', 'Bash'],
        stats: {
          hp: Math.floor(baseHp * (1 + avgLevel * 0.1)),
          maxHp: Math.floor(baseHp * (1 + avgLevel * 0.1)),
          atk: Math.floor(baseAtk * (1 + avgLevel * 0.05)),
          def: Math.floor(baseAtk * 0.3)
        }
      });
    }
    
    return monsters;
  }
  
  // Calculate rewards for clearing gate
  static calculateGateRewards(rank, avgLevel) {
    const rankMultipliers = {
      'F': 1, 'E': 1.5, 'D': 2.5, 'C': 4, 'B': 6, 'A': 9, 'S': 15
    };
    
    const multiplier = rankMultipliers[rank] || 1;
    
    return {
      xp: Math.floor(500 * multiplier * (1 + avgLevel * 0.05)),
      gold: Math.floor(200 * multiplier * (1 + avgLevel * 0.05)),
      crystals: Math.floor(50 * multiplier * (1 + avgLevel * 0.05))
    };
  }
  
  // Get active gates
  static getActiveGates() {
    const now = Date.now();
    return Object.values(this.activeGates).filter(gate => 
      !gate.cleared && !gate.broken && gate.breakTime > now
    );
  }
  
  // Get gate by ID
  static getGate(gateId) {
    return this.activeGates[gateId];
  }
  
  // Check if gate should break (timer expired)
  static checkGateBreak(gateId) {
    const gate = this.activeGates[gateId];
    if (!gate) return false;
    
    const now = Date.now();
    if (now >= gate.breakTime && !gate.cleared) {
      gate.broken = true;
      return true;
    }
    
    return false;
  }
  
  // Mark gate as cleared
  static clearGate(gateId) {
    const gate = this.activeGates[gateId];
    if (gate) {
      gate.cleared = true;
      gate.clearTime = Date.now();
    }
  }
  
  // Get time remaining before gate breaks
  static getTimeRemaining(gateId) {
    const gate = this.activeGates[gateId];
    if (!gate) return 0;
    
    const remaining = gate.breakTime - Date.now();
    return Math.max(0, Math.floor(remaining / 1000 / 60)); // Minutes
  }
  
  // Format gate announcement for spawn
  static formatGateAnnouncement(gate) {
    const timeRemaining = this.getTimeRemaining(gate.id);
    const hours = Math.floor(timeRemaining / 60);
    const minutes = timeRemaining % 60;
    
    const rankEmojis = {
      'F': '⚪', 'E': '🟢', 'D': '🔵', 'C': '🟡', 'B': '🟠', 'A': '🔴', 'S': '⭐'
    };
    
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 GATE DETECTED! 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚪 A mysterious gate has appeared!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 GATE INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 Gate ID: ${gate.id}
${rankEmojis[gate.rank]} Rank: ${gate.rank}-Rank
⚔️ Min Level: ${gate.minLevel}
👥 Recommended Party: ${gate.recommendedPartySize} players
👹 Monsters Inside: ${gate.monsters.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ TIME LIMIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ ${hours}h ${minutes}m until Gate Break!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 CLEAR REWARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💫 ${gate.rewards.xp.toLocaleString()} XP
💎 ${gate.rewards.crystals} Crystals
🪙 ${gate.rewards.gold.toLocaleString()} Gold
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ WARNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━
If not cleared in time, the gate will
BREAK and monsters will escape,
attacking all nearby players!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 PARTY COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/gate party create ${gate.id}
/gate party join [party-id]
/gate info ${gate.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚔️ Gather your party and prepare for battle!`;
  }
  
  // Format gate info message (detailed view)
  static formatGateInfo(gate) {
    const timeRemaining = this.getTimeRemaining(gate.id);
    const hours = Math.floor(timeRemaining / 60);
    const minutes = timeRemaining % 60;
    
    const rankEmojis = {
      'F': '⚪', 'E': '🟢', 'D': '🔵', 'C': '🟡', 'B': '🟠', 'A': '🔴', 'S': '⭐'
    };
    
    let monsterList = '';
    gate.monsters.forEach((monster, i) => {
      monsterList += `${i + 1}. ${monster.emoji} ${monster.name} (${monster.rank})\n`;
      monsterList += `   HP: ${monster.stats.hp}/${monster.stats.maxHp}\n`;
    });
    
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚪 GATE DETAILS 🚪
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Gate ID: ${gate.id}
${rankEmojis[gate.rank]} Rank: ${gate.rank}
⚔ Min Level: ${gate.minLevel}
👥 Recommended Party: ${gate.recommendedPartySize} players
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ TIME REMAINING
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${hours}h ${minutes}m until Gate Break!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👹 MONSTERS (${gate.monsters.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${monsterList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 REWARDS (Clear Bonus)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💫 ${gate.rewards.xp.toLocaleString()} XP
💎 ${gate.rewards.crystals} Crystals
🪙 ${gate.rewards.gold.toLocaleString()} Gold
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ WARNING: If not cleared in time,
the gate will BREAK and monsters
will escape!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/gate party create ${gate.id}
/gate party join [party-id]
/gate raid [party-id]
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
  
  // Format gate break message
  static formatGateBreak(gate) {
    const rankEmojis = {
      'F': '⚪', 'E': '🟢', 'D': '🔵', 'C': '🟡', 'B': '🟠', 'A': '🔴', 'S': '⭐'
    };
    
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💥 GATE BREAK! 💥
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${rankEmojis[gate.rank]} ${gate.rank}-Rank Gate has BROKEN!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ${gate.monsters.length} monsters have escaped!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

All players in this area will take
damage and lose gold!

Penalty:
💔 -${Math.floor(gate.rewards.xp * 0.2)} HP
🪙 -${Math.floor(gate.rewards.gold * 0.5)} Gold

━━━━━━━━━━━━━━━━━━━━━━━━━━━
The monsters have scattered...
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
}

module.exports = GateManager;