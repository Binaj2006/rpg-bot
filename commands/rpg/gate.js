const GateManager = require('../../rpg/dungeons/GateManager');
const PartyManager = require('../../rpg/party/PartyManager');
const StatusEffectManager = require('../../rpg/utils/StatusEffectManager');
const SkillDescriptions = require('../../rpg/utils/SkillDescriptions');
const BarSystem = require('../../rpg/utils/BarSystem');
const { updatePlayerGold } = require('../../rpg/utils/GoldManager');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');

// ============================================
// 🌀 GATE ATMOSPHERE & FLAVOR TEXT
// ============================================
const gateAtmosphere = {
  'F': {
    entry: '💭 A weak spatial distortion appears...',
    ambient: ['💭 The air shimmers slightly', '💭 You feel a faint energy', '💭 This gate seems manageable'],
    break: '💥 The F-Rank gate shatters! Weak monsters scatter!'
  },
  'E': {
    entry: '💭 A rift tears through reality...',
    ambient: ['💭 Strange energies pulse', '💭 The gateway hums with power', '💭 Something dangerous lurks within'],
    break: '💥 The E-Rank gate explodes! Monsters flood out!'
  },
  'D': {
    entry: '💭 Space itself begins to fracture...',
    ambient: ['💭 Reality bends unnaturally', '💭 You hear roars from beyond', '💭 Danger radiates from the gate'],
    break: '💥 The D-Rank gate collapses! A horde escapes!'
  },
  'C': {
    entry: '💭 A crimson portal rips open!',
    ambient: ['💭 The gateway pulses with malice', '💭 Screams echo from within', '💭 Only the strong should enter'],
    break: '💥 The C-Rank gate BREAKS! Chaos erupts!'
  },
  'B': {
    entry: '💭 The void itself screams as reality tears!',
    ambient: ['💭 Your instincts scream DANGER', '💭 Ancient power emanates', '💭 Death awaits the unprepared'],
    break: '💥 The B-Rank gate SHATTERS! Disaster strikes!'
  },
  'A': {
    entry: '💭 A catastrophic dimensional breach forms!',
    ambient: ['💭 The very air crackles with power', '💭 Legends are born or die here', '💭 Few dare to enter'],
    break: '💥 The A-Rank gate EXPLODES! CALAMITY!'
  },
  'S': {
    entry: '💭 THE APOCALYPSE GATE OPENS!',
    ambient: ['💭 REALITY ITSELF IS IN DANGER', '💭 ONLY NATIONAL-LEVEL HUNTERS CAN SURVIVE', '💭 THIS IS THE END'],
    break: '💥 THE S-RANK GATE ANNIHILATES! THE END IS NEAR!'
  }
};

const monsterDialogue = {
  'Goblin': ['Grrr! Intruders!', 'Kill! Kill!', '*screeches*'],
  'Orc': ['You die here!', 'FOR BLOOD!', '*roars*'],
  'Skeleton': ['*rattle* *rattle*', 'Join us...', 'Death awaits!'],
  'Demon': ['Your soul is mine!', 'Suffer!', '*laughs maniacally*'],
  'Dragon': ['INSIGNIFICANT WORMS!', 'BURN!', '*deafening roar*']
};

module.exports = {
  name: 'gate',
  description: '🌀 Solo gate raids - Fight or die!',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { 
        text: '❌ You are not registered! Use /register first.' 
      }, { quoted: msg });
    }

    const subCommand = args[0]?.toLowerCase();

    // ============================================
    // ADMIN: Spawn Gate Manually
    // ============================================
    if (subCommand === 'spawn') {
      // Check if user is admin
      const BOT_OWNER = '221951679328499@lid'; // Change to your number
      const isAdmin = sender === BOT_OWNER || (db.botAdmins && db.botAdmins.includes(sender));
      
      if (!isAdmin) {
        return sock.sendMessage(chatId, { 
          text: '❌ Only admins can spawn gates!' 
        }, { quoted: msg });
      }

      const rankArg = args[1]?.toUpperCase();
      const avgLevel = parseInt(args[2]) || player.level || 1;
      let gate;

      if (rankArg && ['F', 'E', 'D', 'C', 'B', 'A', 'S'].includes(rankArg)) {
        gate = GateManager.spawnGateWithRank(chatId, avgLevel, rankArg);
      } else {
        gate = GateManager.spawnGate(chatId, avgLevel);
      }

      const atmosphere = gateAtmosphere[gate.rank] || gateAtmosphere['F'];
      const announcement = `${atmosphere.entry}

${GateManager.formatGateAnnouncement(gate)}

${atmosphere.ambient[Math.floor(Math.random() * atmosphere.ambient.length)]}`;

      return sock.sendMessage(chatId, { text: announcement });
    }

    // ============================================
    // List Active Gates
    // ============================================
    if (subCommand === 'list' || !subCommand) {
      const allGates = Object.values(GateManager.activeGates);
      const chatGates = allGates.filter(g => g.chatId === chatId && !g.cleared && !g.broken);
      
      if (chatGates.length === 0) {
        return sock.sendMessage(chatId, { 
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌀 GATE STATUS 🌀
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💭 No active gates detected...
💭 Gates spawn randomly every 30-60 minutes

📌 COMMANDS:
/gate list - View gates
/gate info [ID] - Gate details
/gate enter [ID] - Enter gate (SOLO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌀 ACTIVE GATES 🌀
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${chatGates.length} gate(s) detected!
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      chatGates.forEach((gate, index) => {
        const timeLeft = Math.floor((gate.breakTime - Date.now()) / 60000);
        const rankEmojis = { 'F': '⚪', 'E': '🟢', 'D': '🔵', 'C': '🟡', 'B': '🟠', 'A': '🔴', 'S': '⭐' };
        
        message += `${index + 1}. ${rankEmojis[gate.rank]} ${gate.id}\n`;
        message += `   📊 Rank: ${gate.rank} | Min Lv: ${gate.minLevel}\n`;
        message += `   👹 Monsters: ${gate.monsters.length}\n`;
        message += `   ⏰ ${timeLeft}m left\n`;
        message += `   💰 ${gate.rewards.xp} XP | ${gate.rewards.gold}g\n\n`;
      });

      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 USE:
/gate enter [ID] - Enter solo
/gate info [ID] - View details
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ============================================
    // Gate Info
    // ============================================
    if (subCommand === 'info') {
      const gateId = args[1];
      
      if (!gateId) {
        return sock.sendMessage(chatId, { 
          text: '❌ Specify gate ID!\n\nExample: /gate info GATE-1' 
        }, { quoted: msg });
      }

      const gate = GateManager.getGate(gateId);
      
      if (!gate || gate.chatId !== chatId) {
        return sock.sendMessage(chatId, { 
          text: '❌ Gate not found in this chat!' 
        }, { quoted: msg });
      }

      const gateInfo = GateManager.formatGateInfo(gate);
      const atmosphere = gateAtmosphere[gate.rank] || gateAtmosphere['F'];
      const ambient = atmosphere.ambient[Math.floor(Math.random() * atmosphere.ambient.length)];
      
      return sock.sendMessage(chatId, { 
        text: `${ambient}\n\n${gateInfo}` 
      }, { quoted: msg });
    }

    // ============================================
    // Enter Gate (SOLO ONLY!)
    // ============================================
    if (subCommand === 'enter') {
      const gateId = args[1];
      
      if (!gateId) {
        return sock.sendMessage(chatId, { 
          text: '❌ Specify gate ID!\n\nExample: /gate enter GATE-1' 
        }, { quoted: msg });
      }

      const gate = GateManager.getGate(gateId);
      
      if (!gate || gate.chatId !== chatId) {
        return sock.sendMessage(chatId, { 
          text: '❌ Gate not found!' 
        }, { quoted: msg });
      }

      if (gate.cleared) {
        return sock.sendMessage(chatId, { 
          text: '❌ This gate has already been cleared!' 
        }, { quoted: msg });
      }

      if (gate.broken) {
        return sock.sendMessage(chatId, { 
          text: '❌ This gate has broken!' 
        }, { quoted: msg });
      }

      // Check if player meets level requirement
      if (player.level < gate.minLevel) {
        return sock.sendMessage(chatId, { 
          text: `❌ Level too low!\n\nRequired: Level ${gate.minLevel}\nYour Level: ${player.level}` 
        }, { quoted: msg });
      }

      // Check if player already in a gate
      if (player.activeGate) {
        return sock.sendMessage(chatId, { 
          text: '❌ You\'re already in a gate!\n\nUse /gate flee to escape first.' 
        }, { quoted: msg });
      }

      // Initialize gate raid for player
      player.activeGate = {
        gateId: gate.id,
        monstersDefeated: 0,
        totalMonsters: gate.monsters.length,
        currentMonster: { ...gate.monsters[0] },
        turn: 0,
        startTime: Date.now()
      };

      // Initialize monster stats
      const monster = player.activeGate.currentMonster;
      if (!monster.stats) {
        monster.stats = {
          hp: monster.baseHp || 100,
          maxHp: monster.baseHp || 100,
          atk: monster.baseAtk || 20,
          def: monster.baseDef || 10
        };
      }
      monster.statusEffects = [];

      // Initialize player status
      if (!player.statusEffects) player.statusEffects = [];
      if (!player.buffs) player.buffs = [];

      saveDatabase();

      const atmosphere = gateAtmosphere[gate.rank] || gateAtmosphere['F'];
      const monsterHPBar = BarSystem.getMonsterHPBar(monster.stats.hp, monster.stats.maxHp);
      const dialogue = monsterDialogue[monster.name] || ['*growls*'];
      const monsterLine = dialogue[Math.floor(Math.random() * dialogue.length)];

      const message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌀 GATE ENTERED! 🌀
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${atmosphere.entry}
${atmosphere.ambient[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 ${gate.id} (${gate.rank}-Rank)
💀 Solo Challenge
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${monster.emoji} ${monster.name} [Lv.${monster.level}]
💬 "${monsterLine}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${monsterHPBar}
⚔️ ATK: ${monster.stats.atk}
🛡️ DEF: ${monster.stats.def}
💥 Abilities: ${monster.abilities?.join(', ') || 'Strike'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Progress: 0/${gate.monsters.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ WARNING: Death = 50% gold loss!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 COMMANDS:
/gate attack - Basic attack
/gate use [#] - Use skill by number
/gate skills - View your skills
/gate flee - Escape (forfeit rewards)
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ============================================
    // Attack
    // ============================================
    if (subCommand === 'attack') {
      if (!player.activeGate) {
        return sock.sendMessage(chatId, { 
          text: '❌ You\'re not in a gate!\n\nUse /gate enter [ID]' 
        }, { quoted: msg });
      }

      const gate = GateManager.getGate(player.activeGate.gateId);
      if (!gate) {
        delete player.activeGate;
        saveDatabase();
        return sock.sendMessage(chatId, { 
          text: '❌ Gate no longer exists!' 
        }, { quoted: msg });
      }

      const monster = player.activeGate.currentMonster;
      
      // Initialize arrays
      if (!player.statusEffects) player.statusEffects = [];
      if (!player.buffs) player.buffs = [];
      if (!monster.statusEffects) monster.statusEffects = [];

      player.activeGate.turn++;
      let combatLog = [];

      combatLog.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      combatLog.push(`⏰ TURN ${player.activeGate.turn}`);
      combatLog.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      combatLog.push('');

      // Check if player is stunned
      const stunned = player.statusEffects.some(e => ['stun', 'freeze', 'paralyze'].includes(e.type));
      if (stunned) {
        combatLog.push(`💫 You are stunned and cannot act!`);
        combatLog.push(`💭 Your body refuses to obey!`);
      } else {
        // Player attack
        combatLog.push(`⚔️ You attack ${monster.name}!`);
        const baseDamage = Math.floor(player.stats.atk * 0.9);
        const damage = Math.max(1, baseDamage - Math.floor(monster.stats.def * 0.3));
        
        monster.stats.hp -= damage;
        combatLog.push(`💥 Dealt ${damage} damage!`);
        combatLog.push(`💭 ${monster.name} staggers!`);
      }

      combatLog.push('');

      // Check monster death
      if (monster.stats.hp <= 0) {
        return handleMonsterDefeated(sock, chatId, player, gate, monster, db, saveDatabase, msg);
      }

      // Monster counter-attack
      combatLog.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      combatLog.push(`🔄 ${monster.name.toUpperCase()}'S TURN`);
      combatLog.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      const monsterStunned = monster.statusEffects.some(e => ['stun', 'freeze', 'paralyze'].includes(e.type));
      if (monsterStunned) {
        combatLog.push(`💫 ${monster.name} is stunned!`);
        combatLog.push(`💭 They struggle helplessly!`);
      } else {
        const monsterAction = executeMonsterAI(monster, player, db);
        combatLog.push(monsterAction);
      }

      // Status effects
      const playerDOT = processStatusEffects(player);
      const monsterDOT = processStatusEffects(monster);

      if (playerDOT || monsterDOT) {
        combatLog.push('');
        combatLog.push(`🌀 STATUS EFFECTS:`);
        if (playerDOT) combatLog.push(playerDOT);
        if (monsterDOT) combatLog.push(monsterDOT);
      }

      // Check death
      if (player.stats.hp <= 0) {
        return handlePlayerDeath(sock, chatId, player, gate, monster, db, saveDatabase, msg);
      }
      if (monster.stats.hp <= 0) {
        return handleMonsterDefeated(sock, chatId, player, gate, monster, db, saveDatabase, msg);
      }

      saveDatabase();

      // Show status
      combatLog.push('');
      combatLog.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      combatLog.push(`📊 BATTLE STATUS`);
      combatLog.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      combatLog.push('');
      combatLog.push(getBattleStatus(player, monster));
      combatLog.push('');
      combatLog.push(`🎯 Progress: ${player.activeGate.monstersDefeated}/${player.activeGate.totalMonsters}`);

      return sock.sendMessage(chatId, { text: combatLog.join('\n') }, { quoted: msg });
    }

    // ============================================
    // Use Skill
    // ============================================
    if (subCommand === 'use') {
      if (!player.activeGate) {
        return sock.sendMessage(chatId, { 
          text: '❌ You\'re not in a gate!' 
        }, { quoted: msg });
      }

      const skillNum = parseInt(args[1]);
      if (isNaN(skillNum) || skillNum < 1 || skillNum > player.skills.length) {
        return sock.sendMessage(chatId, { 
          text: `❌ Invalid skill number!\n\nUse /gate skills to see your skills (1-${player.skills.length})` 
        }, { quoted: msg });
      }

      const skillName = player.skills[skillNum - 1];
      const skillData = SkillDescriptions.skills[skillName];

      if (!skillData) {
        return sock.sendMessage(chatId, { 
          text: '❌ Skill data not found!' 
        }, { quoted: msg });
      }

      // Check mana
      const manaCost = skillData.cost || 0;
      if (player.stats.energy < manaCost) {
        return sock.sendMessage(chatId, { 
          text: `❌ Not enough energy!\n\nNeed: ${manaCost} | Have: ${player.stats.energy}` 
        }, { quoted: msg });
      }

      const monster = player.activeGate.currentMonster;
      player.activeGate.turn++;

      // Use ImprovedCombat for skill execution
      const ImprovedCombat = require('../../rpg/utils/ImprovedCombat');
      
      const className = typeof player.class === 'string' ? player.class : (player.class?.name || 'Warrior');
      const playerEntity = {
        name: player.name,
        stats: player.stats,
        skills: player.skills,
        class: { name: className },
        energyType: player.energyType || 'Energy',
        energyColor: player.energyColor || '💙',
        statusEffects: player.statusEffects || []
      };

      const monsterEntity = {
        name: monster.name,
        stats: monster.stats,
        skills: {},
        abilities: monster.abilities || [],
        statusEffects: monster.statusEffects || []
      };

      const result = ImprovedCombat.executeSkill(playerEntity, monsterEntity, skillName);

      if (!result.success) {
        return sock.sendMessage(chatId, { 
          text: `❌ ${result.message}` 
        }, { quoted: msg });
      }

      // Update stats
      player.stats = playerEntity.stats;
      player.statusEffects = playerEntity.statusEffects;
      monster.stats = monsterEntity.stats;
      monster.statusEffects = monsterEntity.statusEffects;

      let combatLog = [result.message, ''];

      // Check monster death
      if (monster.stats.hp <= 0) {
        return handleMonsterDefeated(sock, chatId, player, GateManager.getGate(player.activeGate.gateId), monster, db, saveDatabase, msg);
      }

      // Monster counter
      combatLog.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      combatLog.push(`🔄 ${monster.name.toUpperCase()}'S TURN`);
      combatLog.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      combatLog.push(executeMonsterAI(monster, player, db));

      // Status effects
      const playerDOT = processStatusEffects(player);
      const monsterDOT = processStatusEffects(monster);

      if (playerDOT || monsterDOT) {
        combatLog.push('');
        combatLog.push(`🌀 STATUS EFFECTS:`);
        if (playerDOT) combatLog.push(playerDOT);
        if (monsterDOT) combatLog.push(monsterDOT);
      }

      // Check death
      if (player.stats.hp <= 0) {
        return handlePlayerDeath(sock, chatId, player, GateManager.getGate(player.activeGate.gateId), monster, db, saveDatabase, msg);
      }
      if (monster.stats.hp <= 0) {
        return handleMonsterDefeated(sock, chatId, player, GateManager.getGate(player.activeGate.gateId), monster, db, saveDatabase, msg);
      }

      saveDatabase();

      combatLog.push('');
      combatLog.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      combatLog.push(getBattleStatus(player, monster));
      combatLog.push(`🎯 Progress: ${player.activeGate.monstersDefeated}/${player.activeGate.totalMonsters}`);

      return sock.sendMessage(chatId, { text: combatLog.join('\n') }, { quoted: msg });
    }

    // ============================================
    // Show Skills
    // ============================================
    if (subCommand === 'skills') {
      if (!player.skills || player.skills.length === 0) {
        return sock.sendMessage(chatId, { 
          text: '❌ You have no skills!' 
        }, { quoted: msg });
      }

      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 YOUR SKILLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      player.skills.forEach((skillName, index) => {
        const skill = SkillDescriptions.skills[skillName];
        if (skill) {
          message += `${index + 1}. ${skillName}\n`;
          message += `   💙 Cost: ${skill.cost || 0} | 💥 ${(skill.damageMultiplier || 1) * 100}%\n`;
          if (skill.effect) {
            message += `   ✨ ${skill.effect.split('\n')[0]}\n`;
          }
          message += `\n`;
        }
      });

      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      message += `\nUse /gate use [number]`;
      message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ============================================
    // Flee
    // ============================================
    if (subCommand === 'flee') {
      if (!player.activeGate) {
        return sock.sendMessage(chatId, { 
          text: '❌ You\'re not in a gate!' 
        }, { quoted: msg });
      }

      const gate = GateManager.getGate(player.activeGate.gateId);
      delete player.activeGate;
      player.statusEffects = [];
      player.buffs = [];
      saveDatabase();

      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏃 YOU FLED FROM THE GATE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💭 You escape back to safety...
💭 All progress lost!

${gate ? `📍 Escaped from: ${gate.id}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // Default help
    return sock.sendMessage(chatId, { 
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌀 GATE SYSTEM 🌀
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gates are SOLO challenges!
No parties. Just you vs the gate.
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 COMMANDS:
/gate list - View active gates
/gate info [ID] - Gate details
/gate enter [ID] - Enter gate (SOLO)
/gate attack - Attack monster
/gate use [#] - Use skill
/gate skills - View skills
/gate flee - Escape gate
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Gates spawn every 30-60 minutes!
⚠️ Death = 50% gold loss!
🏆 Rewards scale with rank!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function executeMonsterAI(monster, player, db) {
  const abilities = monster.abilities || ['Strike'];
  const useSkill = Math.random() > 0.3;

  if (useSkill && abilities.length > 0) {
    const ability = abilities[Math.floor(Math.random() * abilities.length)];
    const skillInfo = SkillDescriptions.getMonsterSkill(ability);
    
    const baseDamage = Math.floor(monster.stats.atk * (skillInfo.damageMultiplier || 1.5));
    const damage = Math.max(10, baseDamage - Math.floor(player.stats.def * 0.4));
    
    player.stats.hp -= damage;
    
    const dialogue = monsterDialogue[monster.name] || ['*attacks*'];
    const line = dialogue[Math.floor(Math.random() * dialogue.length)];
    
    let message = `${monster.emoji} ${monster.name} used ${ability}!\n`;
    message += `💬 "${line}"\n`;
    if (skillInfo.description) message += `${skillInfo.description}\n`;
    message += `💥 You take ${damage} damage!`;
    
    if (skillInfo.effect && skillInfo.effectDuration && Math.random() < 0.6) {
      StatusEffectManager.applyEffect(player, skillInfo.effect, skillInfo.effectDuration);
      const effectData = StatusEffectManager.EFFECTS[skillInfo.effect];
      if (effectData) {
        message += `\n${effectData.emoji} You are now ${effectData.name}!`;
      }
    }
    
    return message;
  } else {
    const damage = Math.max(8, Math.floor(monster.stats.atk * 1.2) - Math.floor(player.stats.def * 0.4));
    player.stats.hp -= damage;
    
    const dialogue = monsterDialogue[monster.name] || ['*attacks*'];
    const line = dialogue[Math.floor(Math.random() * dialogue.length)];
    
    return `${monster.emoji} ${monster.name} attacks!\n💬 "${line}"\n💥 You take ${damage} damage!`;
  }
}

function processStatusEffects(entity) {
  const result = StatusEffectManager.processTurnEffects(entity);
  return result.messages.join('\n');
}

function getBattleStatus(player, monster) {
  const playerHPBar = BarSystem.getHPBar(player.stats.hp, player.stats.maxHp);
  const monsterHPBar = BarSystem.getMonsterHPBar(monster.stats.hp, monster.stats.maxHp);
  
  const playerStatus = player.statusEffects?.map(e => `${e.type.toUpperCase()}(${e.duration})`).join(', ') || 'None';
  const monsterStatus = monster.statusEffects?.map(e => `${e.type.toUpperCase()}(${e.duration})`).join(', ') || 'None';

  return `👤 ${player.name}
❤️ HP: ${player.stats.hp}/${player.stats.maxHp}
${playerHPBar}
💙 Energy: ${player.stats.energy}/${player.stats.maxEnergy}
🌀 Status: ${playerStatus}

${monster.emoji} ${monster.name}
❤️ HP: ${monster.stats.hp}/${monster.stats.maxHp}
${monsterHPBar}
🌀 Status: ${monsterStatus}`;
}

async function handleMonsterDefeated(sock, chatId, player, gate, monster, db, saveDatabase, msg) {
  player.activeGate.monstersDefeated++;

  let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 MONSTER DEFEATED! 🏆
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${monster.emoji} ${monster.name} has fallen!
💭 Victory is yours!
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Check if gate cleared
  if (player.activeGate.monstersDefeated >= player.activeGate.totalMonsters) {
    return handleGateCleared(sock, chatId, player, gate, db, saveDatabase, msg);
  }

  // Load next monster
  player.activeGate.currentMonster = { ...gate.monsters[player.activeGate.monstersDefeated] };
  const nextMonster = player.activeGate.currentMonster;

  // Initialize next monster
  if (!nextMonster.stats) {
    nextMonster.stats = {
      hp: nextMonster.baseHp || 100,
      maxHp: nextMonster.baseHp || 100,
      atk: nextMonster.baseAtk || 20,
      def: nextMonster.baseDef || 10
    };
  }
  nextMonster.statusEffects = [];

  const monsterHPBar = BarSystem.getMonsterHPBar(nextMonster.stats.hp, nextMonster.stats.maxHp);
  const dialogue = monsterDialogue[nextMonster.name] || ['*growls*'];
  const monsterLine = dialogue[Math.floor(Math.random() * dialogue.length)];

  message += `💭 A new enemy appears...\n\n`;
  message += `${nextMonster.emoji} ${nextMonster.name} [Lv.${nextMonster.level}]\n`;
  message += `💬 "${monsterLine}"\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `${monsterHPBar}\n`;
  message += `⚔️ ATK: ${nextMonster.stats.atk}\n`;
  message += `🛡️ DEF: ${nextMonster.stats.def}\n`;
  message += `💥 Abilities: ${nextMonster.abilities?.join(', ') || 'Strike'}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🎯 Progress: ${player.activeGate.monstersDefeated}/${player.activeGate.totalMonsters}`;

  saveDatabase();
  return sock.sendMessage(chatId, { text: message }, { quoted: msg });
}

async function handleGateCleared(sock, chatId, player, gate, db, saveDatabase, msg) {
  gate.cleared = true;
  
  // Calculate rewards
  const xpReward = gate.rewards.xp;
  const goldReward = gate.rewards.gold;
  const crystalsReward = gate.rewards.crystals || 0;

  // Apply rewards
  player.xp += xpReward;
  player.gold = (player.gold || 0) + goldReward;
  player.manaCrystals = (player.manaCrystals || 0) + crystalsReward;

  // Track stats
  if (!player.gatesCleared) player.gatesCleared = 0;
  player.gatesCleared++;

  // Check level up
  const levelUpResult = LevelUpManager.checkLevelUp(player);
  
  let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 GATE CLEARED! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💭 The gate collapses behind you!
💭 You emerge victorious!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 ${gate.id} (${gate.rank}-Rank)
⏱️ Time: ${Math.floor((Date.now() - player.activeGate.startTime) / 1000)}s
👹 Monsters Defeated: ${player.activeGate.totalMonsters}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 REWARDS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💫 +${xpReward} XP
🪙 +${goldReward} Gold`;

  if (crystalsReward > 0) {
    message += `\n💎 +${crystalsReward} Crystals`;
  }

  message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  if (levelUpResult.leveled) {
    message += `\n\n✨✨✨ LEVEL UP! ✨✨✨`;
    message += `\n🎉 Level ${levelUpResult.oldLevel} → ${levelUpResult.newLevel}!`;
    message += `\n💭 Power surges through you!`;
    
    if (levelUpResult.newSkills && levelUpResult.newSkills.length > 0) {
      message += `\n\n📚 New Skills:`;
      levelUpResult.newSkills.forEach(skill => {
        message += `\n   ✨ ${skill}`;
      });
    }
  }

  message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  // Clear player's active gate
  delete player.activeGate;
  player.statusEffects = [];
  player.buffs = [];

  saveDatabase();
  return sock.sendMessage(chatId, { text: message }, { quoted: msg });
}

async function handlePlayerDeath(sock, chatId, player, gate, monster, db, saveDatabase, msg) {
  // Death penalty: lose 50% gold
  const goldLoss = Math.floor((player.gold || 0) * 0.5);
  player.gold = (player.gold || 0) - goldLoss;
  if (player.gold < 0) player.gold = 0;

  const message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💀 DEATH 💀
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${monster.emoji} ${monster.name} has defeated you!
💭 Your vision fades to black...
💭 You have fallen in battle...
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚰️ FINAL BLOW:
${monster.name} delivers the killing strike!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Lost ${goldLoss} gold (50%)
📊 Progress: ${player.activeGate.monstersDefeated}/${player.activeGate.totalMonsters}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use /heal to recover.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  // Clear active gate
  delete player.activeGate;
  player.statusEffects = [];
  player.buffs = [];

  saveDatabase();
  return sock.sendMessage(chatId, { text: message }, { quoted: msg });
}