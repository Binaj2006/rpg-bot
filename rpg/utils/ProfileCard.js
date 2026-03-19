// ProfileCard.js — Canvas-based profile card generator
// Falls back gracefully if canvas is not installed
// Install on server: npm install canvas

let canvas;
try { canvas = require('canvas'); } catch(e) { canvas = null; }

// ─── CLASS THEME COLORS ──────────────────────────────────────
// Each class gets a unique color palette for their card
const CLASS_THEMES = {
  // Common
  Warrior:      { bg: ['#1a0a00','#3d1a00'], accent: '#c0392b', glow: '#e74c3c', badge: '#8B2500' },
  Mage:         { bg: ['#0a0020','#1a0040'], accent: '#8e44ad', glow: '#9b59b6', badge: '#5B0EA6' },
  Archer:       { bg: ['#001a00','#003300'], accent: '#27ae60', glow: '#2ecc71', badge: '#1A6B00' },
  Rogue:        { bg: ['#0a0a0a','#1a1a2e'], accent: '#7f8c8d', glow: '#95a5a6', badge: '#2C3E50' },
  Knight:       { bg: ['#0a0a1a','#1a1a3d'], accent: '#2980b9', glow: '#3498db', badge: '#1A4A8A' },
  Monk:         { bg: ['#1a1000','#3d2800'], accent: '#e67e22', glow: '#f39c12', badge: '#8B5000' },
  Shaman:       { bg: ['#001a1a','#003333'], accent: '#16a085', glow: '#1abc9c', badge: '#0A5C52' },
  Warlord:      { bg: ['#1a0000','#400000'], accent: '#c0392b', glow: '#ff0000', badge: '#800000' },
  // Rare
  Paladin:      { bg: ['#1a1500','#3d3000'], accent: '#f1c40f', glow: '#ffd700', badge: '#8B7300' },
  Necromancer:  { bg: ['#050010','#0d0033'], accent: '#6c3483', glow: '#a569bd', badge: '#3D0066' },
  Assassin:     { bg: ['#050505','#101010'], accent: '#636e72', glow: '#b2bec3', badge: '#1a1a1a' },
  Elementalist: { bg: ['#001020','#002040'], accent: '#0984e3', glow: '#74b9ff', badge: '#004080' },
  Ranger:       { bg: ['#001500','#002800'], accent: '#00b894', glow: '#55efc4', badge: '#006644' },
  BloodKnight:  { bg: ['#1a0005','#3d000f'], accent: '#d63031', glow: '#ff4757', badge: '#800020' },
  SpellBlade:   { bg: ['#100020','#200040'], accent: '#a29bfe', glow: '#c8b8ff', badge: '#5533AA' },
  // Epic
  Berserker:    { bg: ['#1a0000','#500000'], accent: '#ff4500', glow: '#ff6b35', badge: '#8B0000' },
  DragonKnight: { bg: ['#0d0500','#2a1000'], accent: '#e17055', glow: '#fd7272', badge: '#6B2800' },
  Summoner:     { bg: ['#0a001a','#1a0040'], accent: '#fd79a8', glow: '#fdcfe8', badge: '#6B0033' },
  ShadowDancer: { bg: ['#020208','#05050f'], accent: '#6c5ce7', glow: '#a29bfe', badge: '#2D1B8A' },
  // Legendary
  Devourer:     { bg: ['#050000','#150000'], accent: '#d00000', glow: '#ff0000', badge: '#600000' },
  Chronomancer: { bg: ['#000510','#001030'], accent: '#00cec9', glow: '#81ecec', badge: '#006666' },
  Phantom:      { bg: ['#030308','#08081a'], accent: '#dfe6e9', glow: '#ffffff', badge: '#404040' },
  // Divine
  Senku:        { bg: ['#0a0800','#201800'], accent: '#fdcb6e', glow: '#ffeaa7', badge: '#996600' },
};

const RARITY_COLORS = {
  Common:    '#95a5a6',
  Rare:      '#3498db',
  Epic:      '#9b59b6',
  Legendary: '#f39c12',
  Divine:    '#ffd700',
};

const PVP_RANKS = [
  { name: 'Bronze',   min: 0,    color: '#cd7f32' },
  { name: 'Silver',   min: 1100, color: '#c0c0c0' },
  { name: 'Gold',     min: 1300, color: '#ffd700' },
  { name: 'Platinum', min: 1500, color: '#00d2ff' },
  { name: 'Diamond',  min: 1700, color: '#b9f2ff' },
  { name: 'Master',   min: 1900, color: '#ff6b6b' },
  { name: 'Legend',   min: 2100, color: '#f39c12' },
];
function getPvpRank(elo) {
  const e = elo || 1000;
  for (let i = PVP_RANKS.length - 1; i >= 0; i--) {
    if (e >= PVP_RANKS[i].min) return PVP_RANKS[i];
  }
  return PVP_RANKS[0];
}

// ─── DRAW HELPERS ─────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBar(ctx, x, y, w, h, pct, fillColor, bgColor) {
  // Background
  ctx.fillStyle = bgColor || 'rgba(0,0,0,0.5)';
  roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  // Fill
  const fillW = Math.max(0, Math.min(w, Math.floor(w * pct)));
  if (fillW > 0) {
    ctx.fillStyle = fillColor;
    roundRect(ctx, x, y, fillW, h, h / 2); ctx.fill();
  }
}

function glowText(ctx, text, x, y, color, blur = 12) {
  ctx.shadowColor  = color;
  ctx.shadowBlur   = blur;
  ctx.fillStyle    = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur   = 0;
  ctx.shadowColor  = 'transparent';
}

// ─── MAIN GENERATOR ──────────────────────────────────────────
async function generateProfileCard(player) {
  if (!canvas) return null;

  const { createCanvas } = canvas;

  const W = 520, H = 720;
  const c   = createCanvas(W, H);
  const ctx = c.getContext('2d');

  const className = typeof player.class === 'string' ? player.class : (player.class?.name || 'Warrior');
  const rarity    = typeof player.class === 'object' ? (player.class.rarity || 'Common') : 'Common';
  const theme     = CLASS_THEMES[className] || CLASS_THEMES.Warrior;
  const rarityCol = RARITY_COLORS[rarity] || RARITY_COLORS.Common;

  // ── BACKGROUND GRADIENT ──────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, theme.bg[0]);
  bgGrad.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── SUBTLE GRID PATTERN ──────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth   = 1;
  for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // ── TOP ACCENT BAR ───────────────────────────────────────
  const topGrad = ctx.createLinearGradient(0, 0, W, 0);
  topGrad.addColorStop(0, 'transparent');
  topGrad.addColorStop(0.5, theme.accent);
  topGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, 3);

  // ── CARD BORDER ──────────────────────────────────────────
  ctx.strokeStyle = theme.accent + '44';
  ctx.lineWidth   = 1.5;
  roundRect(ctx, 8, 8, W - 16, H - 16, 12);
  ctx.stroke();

  // ── CLASS EMOJI (large, top right) ───────────────────────
  const classEmojis = {
    Warrior:'⚔️', Mage:'🔮', Archer:'🏹', Rogue:'🗡️', Knight:'🛡️',
    Monk:'👊', Shaman:'🌿', Warlord:'🪖', Paladin:'✨', Necromancer:'💀',
    Assassin:'🌑', Elementalist:'⚡', Ranger:'🌲', BloodKnight:'🩸',
    SpellBlade:'🌀', Berserker:'🔥', DragonKnight:'🐉', Summoner:'🔯',
    ShadowDancer:'💃', Devourer:'🕳️', Chronomancer:'⏳', Phantom:'👻', Senku:'👑'
  };
  const emoji = classEmojis[className] || '⚔️';
  ctx.font      = '72px serif';
  ctx.globalAlpha = 0.15;
  ctx.fillText(emoji, W - 110, 100);
  ctx.globalAlpha = 1;

  // ── HEADER SECTION ───────────────────────────────────────
  // Name
  ctx.font      = 'bold 32px sans-serif';
  glowText(ctx, player.name || 'Unknown', 28, 55, '#ffffff', 8);

  // Class + rarity badge
  const badgeW = 160, badgeH = 26;
  ctx.fillStyle = theme.badge + 'cc';
  roundRect(ctx, 28, 68, badgeW, badgeH, 6); ctx.fill();
  ctx.strokeStyle = rarityCol + '88';
  ctx.lineWidth   = 1;
  roundRect(ctx, 28, 68, badgeW, badgeH, 6); ctx.stroke();

  ctx.font      = 'bold 13px sans-serif';
  ctx.fillStyle = rarityCol;
  ctx.fillText(`${emoji} ${className}`, 38, 86);

  ctx.font      = '11px sans-serif';
  ctx.fillStyle = rarityCol + 'cc';
  ctx.fillText(rarity.toUpperCase(), 28 + badgeW + 10, 86);

  // Level badge
  const lvl     = player.level || 1;
  const lvlTxt  = `LV. ${lvl}`;
  ctx.font      = 'bold 20px sans-serif';
  const lvlW    = ctx.measureText(lvlTxt).width + 20;
  ctx.fillStyle = theme.accent + 'cc';
  roundRect(ctx, W - lvlW - 20, 20, lvlW, 30, 6); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(lvlTxt, W - lvlW - 10, 41);

  // ── DIVIDER ──────────────────────────────────────────────
  const divGrad = ctx.createLinearGradient(0, 0, W, 0);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.3, theme.accent);
  divGrad.addColorStop(0.7, theme.accent);
  divGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = divGrad;
  ctx.fillRect(28, 108, W - 56, 1);

  // ── HP & ENERGY BARS ─────────────────────────────────────
  const hp     = player.stats?.hp    || 0;
  const maxHp  = player.stats?.maxHp || 1;
  const en     = player.stats?.energy    || 0;
  const maxEn  = player.stats?.maxEnergy || 1;
  const hpPct  = hp / maxHp;
  const enPct  = en / maxEn;

  // HP bar
  ctx.font      = 'bold 13px sans-serif';
  ctx.fillStyle = '#ff6b6b';
  glowText(ctx, '❤️ HP', 28, 138, '#ff6b6b', 6);
  ctx.fillStyle = '#aaa';
  ctx.font      = '12px sans-serif';
  ctx.fillText(`${hp.toLocaleString()} / ${maxHp.toLocaleString()}`, W - 28 - ctx.measureText(`${hp.toLocaleString()} / ${maxHp.toLocaleString()}`).width, 138);
  drawBar(ctx, 28, 144, W - 56, 14, hpPct, '#e74c3c', 'rgba(255,0,0,0.15)');

  // HP glow effect on bar
  if (hpPct > 0) {
    const hpFill = ctx.createLinearGradient(28, 0, 28 + (W-56) * hpPct, 0);
    hpFill.addColorStop(0, '#c0392b');
    hpFill.addColorStop(1, '#ff6b6b');
    ctx.fillStyle = hpFill;
    roundRect(ctx, 28, 144, Math.max(0, (W-56) * hpPct), 14, 7); ctx.fill();
  }

  // Energy bar
  const enColor = player.energyColor === '🔥' ? '#e17055' : player.energyColor === '💚' ? '#00b894' : '#3498db';
  const enLabel = player.energyType || 'Energy';
  ctx.font      = 'bold 13px sans-serif';
  glowText(ctx, `⚡ ${enLabel}`, 28, 178, enColor, 6);
  ctx.fillStyle = '#aaa';
  ctx.font      = '12px sans-serif';
  ctx.fillText(`${en} / ${maxEn}`, W - 28 - ctx.measureText(`${en} / ${maxEn}`).width, 178);
  drawBar(ctx, 28, 184, W - 56, 14, enPct, enColor, 'rgba(52,152,219,0.15)');

  if (enPct > 0) {
    const enFill = ctx.createLinearGradient(28, 0, 28 + (W-56) * enPct, 0);
    enFill.addColorStop(0, enColor + 'aa');
    enFill.addColorStop(1, enColor);
    ctx.fillStyle = enFill;
    roundRect(ctx, 28, 184, Math.max(0, (W-56) * enPct), 14, 7); ctx.fill();
  }

  // ── STATS GRID ───────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  roundRect(ctx, 28, 212, W - 56, 120, 8); ctx.fill();
  ctx.strokeStyle = theme.accent + '33';
  ctx.lineWidth   = 1;
  roundRect(ctx, 28, 212, W - 56, 120, 8); ctx.stroke();

  ctx.font      = 'bold 12px sans-serif';
  ctx.fillStyle = theme.accent;
  ctx.fillText('COMBAT STATS', 44, 232);

  const stats = [
    { label: '⚔️ ATK',  val: player.stats?.atk  || 0, col: '#e74c3c' },
    { label: '🛡️ DEF',  val: player.stats?.def  || 0, col: '#3498db' },
    { label: '💨 SPD',  val: player.stats?.speed || 0, col: '#2ecc71' },
    { label: '❤️ MaxHP',val: maxHp,                    col: '#e74c3c' },
    { label: '⚡ MaxEN', val: maxEn,                    col: enColor   },
    { label: '💫 XP',   val: (player.xp || 0).toLocaleString(), col: '#f39c12' },
  ];

  stats.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x   = 44 + col * 156;
    const y   = 255 + row * 50;

    ctx.font      = '11px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText(s.label, x, y);
    ctx.font      = 'bold 18px sans-serif';
    ctx.fillStyle = s.col;
    ctx.fillText(typeof s.val === 'number' ? s.val.toLocaleString() : s.val, x, y + 20);
  });

  // ── PVP RANK ─────────────────────────────────────────────
  const elo      = player.pvpElo || 1000;
  const pvpRank  = getPvpRank(elo);
  const wins     = player.pvpWins   || 0;
  const losses   = player.pvpLosses || 0;
  const total    = wins + losses;
  const winRate  = total > 0 ? Math.floor((wins / total) * 100) : 0;

  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  roundRect(ctx, 28, 346, W - 56, 80, 8); ctx.fill();
  ctx.strokeStyle = pvpRank.color + '44';
  roundRect(ctx, 28, 346, W - 56, 80, 8); ctx.stroke();

  ctx.font      = 'bold 12px sans-serif';
  ctx.fillStyle = pvpRank.color;
  glowText(ctx, `⚔️ PVP — ${pvpRank.name.toUpperCase()}`, 44, 368, pvpRank.color, 8);

  ctx.font      = '13px sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText(`ELO: ${elo}`, 44, 390);
  ctx.fillText(`W: ${wins}  L: ${losses}  (${winRate}% WR)`, 160, 390);

  // ELO bar (progress to next rank)
  const ranks    = PVP_RANKS;
  const rankIdx  = ranks.findIndex(r => r.name === pvpRank.name);
  const nextRank = ranks[rankIdx + 1];
  if (nextRank) {
    const prog = (elo - pvpRank.min) / (nextRank.min - pvpRank.min);
    drawBar(ctx, 44, 400, W - 88, 8, prog, pvpRank.color, 'rgba(255,255,255,0.1)');
    ctx.font      = '10px sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(`→ ${nextRank.name} (${nextRank.min} ELO)`, W - 200, 418);
  }

  // ── GOLD & CRYSTALS ──────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  roundRect(ctx, 28, 440, (W - 64) / 2, 60, 8); ctx.fill();
  roundRect(ctx, 28 + (W - 64) / 2 + 8, 440, (W - 64) / 2, 60, 8); ctx.fill();

  ctx.font      = '11px sans-serif'; ctx.fillStyle = '#888';
  ctx.fillText('🪙 GOLD', 44, 460);
  ctx.font      = 'bold 20px sans-serif';
  glowText(ctx, (player.gold || 0).toLocaleString(), 44, 486, '#f39c12', 6);

  const cx2 = 28 + (W - 64) / 2 + 24;
  ctx.font      = '11px sans-serif'; ctx.fillStyle = '#888';
  ctx.fillText('💎 CRYSTALS', cx2, 460);
  ctx.font      = 'bold 20px sans-serif';
  glowText(ctx, (player.manaCrystals || 0).toLocaleString(), cx2, 486, '#00d2ff', 6);

  // ── DUNGEON / BOSS STATS ─────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  roundRect(ctx, 28, 514, W - 56, 60, 8); ctx.fill();

  ctx.font = '11px sans-serif'; ctx.fillStyle = '#888';
  ctx.fillText('🏰 DUNGEONS', 44, 534);
  ctx.fillText('👹 BOSS KILLS', 200, 534);
  ctx.fillText('🏅 ACHIEVEMENTS', 356, 534);

  ctx.font = 'bold 18px sans-serif';
  glowText(ctx, String(player.dungeonsCleared || 0), 44, 558, theme.accent, 4);
  glowText(ctx, String(player.bossKills || 0), 200, 558, '#e74c3c', 4);
  const achCount = player.achievements?.unlocked?.length || 0;
  glowText(ctx, String(achCount), 356, 558, '#f39c12', 4);

  // ── XP BAR ───────────────────────────────────────────────
  const xpNeeded  = Math.floor(100 * Math.pow(1.15, (player.level || 1)));
  const xpPct     = Math.min(1, (player.xp || 0) / xpNeeded);
  ctx.fillStyle   = '#888';
  ctx.font        = '11px sans-serif';
  ctx.fillText(`XP to Level ${(player.level || 1) + 1}`, 28, 596);
  ctx.fillText(`${Math.floor(xpPct * 100)}%`, W - 56, 596);
  drawBar(ctx, 28, 602, W - 56, 10, xpPct, '#f39c12', 'rgba(243,156,18,0.15)');
  if (xpPct > 0) {
    const xpFill = ctx.createLinearGradient(28, 0, 28 + (W-56)*xpPct, 0);
    xpFill.addColorStop(0, '#e67e22'); xpFill.addColorStop(1, '#f39c12');
    ctx.fillStyle = xpFill;
    roundRect(ctx, 28, 602, Math.max(0, (W-56)*xpPct), 10, 5); ctx.fill();
  }

  // ── FOOTER ───────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(28, 628, W - 56, 1);

  ctx.font      = '11px sans-serif';
  ctx.fillStyle = '#444';
  const regDate = player.createdAt ? new Date(player.createdAt).toLocaleDateString() : 'Unknown';
  ctx.fillText(`Registered: ${regDate}`, 28, 650);

  // Upgrade points
  if (player.upgradePoints > 0) {
    ctx.fillStyle = theme.accent;
    ctx.fillText(`⬆️ ${player.upgradePoints} Upgrade Points available`, W - 220, 650);
  }

  // Bottom accent
  const botGrad = ctx.createLinearGradient(0, 0, W, 0);
  botGrad.addColorStop(0, 'transparent');
  botGrad.addColorStop(0.5, theme.accent);
  botGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, H - 3, W, 3);

  return c.toBuffer('image/jpeg', { quality: 0.92 });
}

module.exports = { generateProfileCard, CLASS_THEMES, RARITY_COLORS };
