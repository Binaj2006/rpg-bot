module.exports = {
  name: 'admins',
  description: '👑 List all bot admins',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    // ⚠️ IMPORTANT: Replace with YOUR WhatsApp number!
    const BOT_OWNER = '221951679328499@lid'; // ← CHANGE THIS!
    
    // ✅ Initialize and CLEAN admin list
    if (!db.botAdmins) {
      db.botAdmins = [];
    }
    
    // ✅ Remove duplicates and ensure owner is not in regular admin list
    db.botAdmins = [...new Set(db.botAdmins)].filter(id => id !== BOT_OWNER);
    
    // Build final admin list (owner + active admins)
    const allAdmins = [BOT_OWNER, ...db.botAdmins];
    
    // ✅ Verify all admins still exist in database
    const validAdmins = allAdmins.filter(adminId => {
      // Owner always valid
      if (adminId === BOT_OWNER) return true;
      
      // Check if user exists and is not deleted
      const user = db.users[adminId];
      return user && !user.deleted && !user.demoted;
    });
    
    // Update database to remove invalid admins
    db.botAdmins = validAdmins.filter(id => id !== BOT_OWNER);
    saveDatabase();
    
    let adminList = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 BOT ADMINS 👑
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Active Admins: ${validAdmins.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    for (let i = 0; i < validAdmins.length; i++) {
      const adminId = validAdmins[i];
      const adminUser = db.users[adminId];
      const name = adminUser?.name || adminId.split('@')[0];
      const isOwner = adminId === BOT_OWNER;
      const rank = isOwner ? '👑 Owner' : '⭐ Admin';
      
      // Additional info
      const level = adminUser?.level || '?';
      const rankText = adminUser?.rank || 'Unranked';
      
      adminList += `${i + 1}. ${rank}\n`;
      adminList += `   👤 ${name}\n`;
      adminList += `   📱 @${adminId.split('@')[0]}\n`;
      if (adminUser) {
        adminList += `   📊 Level ${level} | ${rankText}\n`;
      }
      adminList += `\n`;
    }
    
    adminList += `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *ADMIN COMMANDS:*
/promote @user - Make someone admin
/demote @user - Remove admin
/admins - View this list
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    await sock.sendMessage(chatId, {
      text: adminList,
      mentions: validAdmins
    }, { quoted: msg });
  }
};