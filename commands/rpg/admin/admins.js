module.exports = {
  name: 'admins',
  description: '👑 List all bot admins',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    const BOT_OWNER = '221951679328499@lid';
    
    if (!db.botAdmins) db.botAdmins = [BOT_OWNER];
    
    let adminList = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 BOT ADMINS 👑
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Admins: ${db.botAdmins.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    for (let i = 0; i < db.botAdmins.length; i++) {
      const adminId = db.botAdmins[i];
      const adminUser = db.users[adminId];
      const name = adminUser?.name || adminId.split('@')[0];
      const isOwner = adminId === BOT_OWNER;
      const rank = isOwner ? '👑 Owner' : '⭐ Admin';
      
      adminList += `${i + 1}. ${rank} - ${name}\n`;
      adminList += `   @${adminId.split('@')[0]}\n\n`;
    }
    
    adminList += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    await sock.sendMessage(chatId, {
      text: adminList,
      mentions: db.mods
    });
  }
};