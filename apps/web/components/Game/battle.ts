// @ts-nocheck
/* ============================================================
   NIVAR — 2D real-time auto-battle arena.
   Your squad units deploy on a snowfield, auto-move, target and attack the
   monster + its minions (ranged shots + melee), with HP bars, deaths, particles,
   pause + x2 speed. The winner is predetermined by the power check (rewards stay
   consistent); unit stats are biased so the sim reliably resolves that way.
   ============================================================ */
import { Audio } from "./audio";

function ab(n) { n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return "" + n; }

export function runBattle(opts) {
  const { container, squad, monster, win, eff, epow, rewards, onDone, onUpgrade } = opts;
  const DPR = Math.min(2, window.devicePixelRatio || 1);

  const wrap = document.createElement("div");
  wrap.className = "battle-arena";
  wrap.innerHTML =
    `<canvas class="ba-cv"></canvas>
     <div class="ba-top">
       <div class="ba-team"><b>YOUR SQUAD</b><span>⚔️ ${ab(eff)}</span></div>
       <div class="ba-vs">Lv ${monster.level} · VS</div>
       <div class="ba-team foe"><b>${monster.name}</b><span>🛡️ ${ab(epow)}</span></div>
     </div>
     <button class="ba-exit" data-a="exit">✕ EXIT</button>
     <div class="ba-ctrl">
       <button class="ba-btn" data-a="pause">⏸</button>
       <button class="ba-btn" data-a="speed">1×</button>
     </div>
     <div class="ba-result"></div>`;
  container.appendChild(wrap);
  const cv = wrap.querySelector(".ba-cv"), ctx = cv.getContext("2d");
  let W = 0, H = 0;
  function fit() { const r = wrap.getBoundingClientRect(); W = r.width; H = r.height;
    cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + "px"; cv.style.height = H + "px"; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  fit();

  const foeGlow = ({ s1: "#ff6b6b", s2: "#e0a060", s3: "#b06bff", s4: "#56e0ff", s5: "#7CFFB0", s6: "#ffce54" })[monster.id] || "#ff6b6b";
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f)), gg = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
    return "#" + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1); }
  function hslHex(h, s, l) { s /= 100; l /= 100; const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
      return Math.round(255 * c).toString(16).padStart(2, "0"); };
    return "#" + f(0) + f(8) + f(4); }
  function hueOf(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) % 360; return h; }
  // Each hero gets its own colour (from its emoji) so no two look the same,
  // while friendly silhouette (helmet + smile) still reads as "your side".
  function heroPal(emoji) { const h = hueOf(emoji);
    return { armor: hslHex(h, 62, 44), armorL: hslHex(h, 88, 66), skin: "#eafff5", stroke: hslHex(h, 60, 12), foe: false, weapon: "staff" }; }

  /* ---------------- build units ---------------- */
  const units = [], shots = [], parts = [], dmgs = [], rings = [];
  const bias = 1.5; // predetermined winner's stat multiplier
  const HPF = 2.6, ATKF = 0.14;
  const heroes = (squad.length ? squad : [{ e: "🫥", power: 40 }]);
  const PAL = {
    crew: { armor: "#1f6048", armorL: "#63d6a0", skin: "#dff3e8", stroke: "#0c2a1e", foe: false, weapon: "sword" },
    minion: { armor: shade(foeGlow, 0.5), armorL: shade(foeGlow, 1.05), skin: shade(foeGlow, 1.18), stroke: "#1a0608", foe: true, weapon: "club" },
    boss: { armor: shade(foeGlow, 0.45), armorL: shade(foeGlow, 1.3), skin: shade(foeGlow, 1.14), stroke: "#140406", foe: true, weapon: "club" },
  };

  function mk(side, emoji, power, x, y, ranged, kind, pal, emblem) {
    const boost = (side === "you") === win ? bias : 1;
    const big = kind === "boss";
    const hp = Math.max(20, power * HPF * boost);
    units.push({ side, e: emoji, r: big ? 34 : ranged ? 22 : 19, hp, maxHp: hp, atk: Math.max(3, power * ATKF * boost),
      range: ranged ? 128 : 34, speed: (ranged ? 30 : 46) + Math.random() * 6, cd: Math.random() * 0.6, cdMax: ranged ? 0.9 : 0.7,
      ranged, x, y, flash: 0, lunge: 0, alive: true, big, kind, pal, emblem, step: Math.random() * 6.28 }); }

  // your side (left) — each hero unique (ranged, 60% power) + a melee crew (40%)
  const yourHeroPow = eff * 0.6 / heroes.length;
  const hSpread = Math.min(0.13, 0.62 / heroes.length);
  heroes.forEach((h, i) => mk("you", h.e, yourHeroPow, W * 0.20, H * (0.5 - (heroes.length - 1) * hSpread / 2 + i * hSpread), true, "hero", heroPal(h.e), h.e));
  const crewN = 3, crewPow = eff * 0.4 / crewN;
  for (let i = 0; i < crewN; i++) mk("you", "🥷", crewPow, W * 0.11, H * (0.34 + i * 0.16), false, "crew", PAL.crew, null);
  // enemy side (right) — boss (50%) + a minion line (50%)
  mk("foe", monster.e, epow * 0.5, W * 0.80, H * 0.46, false, "boss", PAL.boss, null);
  const minN = 5, minPow = epow * 0.5 / minN;
  for (let i = 0; i < minN; i++) mk("foe", "👾", minPow, W * 0.89, H * (0.24 + i * 0.13), Math.random() < 0.35, "minion", PAL.minion, null);

  /* ---------------- sim ---------------- */
  function nearest(u) { let best = null, bd = 1e9;
    for (const o of units) { if (!o.alive || o.side === u.side) continue; const d = (o.x - u.x) ** 2 + (o.y - u.y) ** 2; if (d < bd) { bd = d; best = o; } }
    return best; }
  function hurt(u, dmg) { u.hp -= dmg; u.flash = 1;
    burst(u.x, u.y - u.r * 0.4, 5, u.side === "you" ? "#9fd0ff" : "#ffd0a0");
    rings.push({ x: u.x, y: u.y - u.r * 0.4, life: 1, max: u.r * 1.4 });
    dmgs.push({ x: u.x + (Math.random() * 10 - 5), y: u.y - u.r * 1.1, val: Math.round(dmg), life: 1, foe: u.side === "foe" });
    if (u.hp <= 0 && u.alive) { u.alive = false; burst(u.x, u.y, 14, u.big ? foeGlow : "#dfe9f5"); rings.push({ x: u.x, y: u.y - u.r * 0.4, life: 1, max: u.r * 2.6 }); } }
  function burst(x, y, n, c) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: Math.random() * 3.4 - 1.7, vy: Math.random() * 3.4 - 2, life: 1, r: Math.random() * 2.4 + 1, c }); }

  function step(dt) {
    for (const u of units) { if (!u.alive) continue; u.flash = Math.max(0, u.flash - dt * 4); u.lunge = Math.max(0, u.lunge - dt * 4.5);
      const t = nearest(u); if (!t) continue;
      const dx = t.x - u.x, dy = t.y - u.y, dist = Math.hypot(dx, dy) || 1;
      if (dist > u.range) { u.x += dx / dist * u.speed * dt; u.y += dy / dist * u.speed * dt; }
      else { u.cd -= dt; if (u.cd <= 0) { u.cd = u.cdMax; u.lunge = 1;
        if (u.ranged) { shots.push({ x: u.x, y: u.y - u.r * 0.4, px: u.x, py: u.y - u.r * 0.4, t, dmg: u.atk, col: u.side === "you" ? "#7CFFB0" : foeGlow, side: u.side, sp: 340 }); }
        else { hurt(t, u.atk); }
      } } }
    // separation — units push apart so they form readable lines instead of piling up
    for (let i = 0; i < units.length; i++) { const a = units[i]; if (!a.alive) continue;
      for (let j = i + 1; j < units.length; j++) { const b = units[j]; if (!b.alive) continue;
        let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; const min = (a.r + b.r) * 0.9;
        if (d < min) { const p = (min - d) / d * 0.5; a.x -= dx * p; a.y -= dy * p; b.x += dx * p; b.y += dy * p; } } }
    for (const u of units) { u.x = Math.max(u.r, Math.min(W - u.r, u.x)); u.y = Math.max(u.r + 30, Math.min(H - u.r - 10, u.y)); }
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; if (!s.t.alive) { shots.splice(i, 1); continue; }
      const tx = s.t.x, ty = s.t.y - s.t.r * 0.4, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
      if (d < 12) { hurt(s.t, s.dmg); shots.splice(i, 1); continue; }
      s.px = s.x; s.py = s.y; s.x += dx / d * s.sp * dt; s.y += dy / d * s.sp * dt; }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += dt * 4; p.life -= dt * 1.6; if (p.life <= 0) parts.splice(i, 1); }
    for (let i = dmgs.length - 1; i >= 0; i--) { const d = dmgs[i]; d.y -= dt * 34; d.life -= dt * 1.3; if (d.life <= 0) dmgs.splice(i, 1); }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= dt * 3.2; if (r.life <= 0) rings.splice(i, 1); }
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  // A drawn chibi fighter: legs, torso, arms + weapon, head with a real face
  // (eyes, brows, mouth), horns for monsters, a helmet crest for your troops.
  function drawChar(u) {
    const s = u.r, p = u.pal, f = u.side === "you" ? 1 : -1;
    const bob = Math.sin(u.step + elapsed * 3) * s * 0.05;
    const cx = u.x + f * u.lunge * s * 0.5, cy = u.y; // lunge forward when attacking
    const hy = cy - s * 0.6 + bob, hr = s * 0.72;
    // team ring on the ground (mint = ally, red = foe) + shadow
    ctx.fillStyle = "rgba(12,26,40,.26)"; ctx.beginPath(); ctx.ellipse(u.x, cy + s * 1.02, s * 0.9, s * 0.32, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = u.side === "you" ? "rgba(124,255,176,.85)" : "rgba(255,107,107,.8)";
    ctx.beginPath(); ctx.ellipse(u.x, cy + s * 1.02, s * 0.86, s * 0.3, 0, 0, 7); ctx.stroke();
    ctx.lineWidth = u.big ? 3 : 2; ctx.strokeStyle = p.stroke; ctx.lineJoin = "round"; ctx.lineCap = "round";
    // legs
    ctx.fillStyle = shade(p.armor, 0.78);
    rr(cx - s * 0.46, cy + s * 0.42 + bob, s * 0.38, s * 0.5, s * 0.16); ctx.fill(); ctx.stroke();
    rr(cx + s * 0.08, cy + s * 0.42 + bob, s * 0.38, s * 0.5, s * 0.16); ctx.fill(); ctx.stroke();
    // back arm
    ctx.fillStyle = p.armor;
    rr(cx - f * s * 0.72 - s * 0.13, cy - s * 0.06 + bob, s * 0.26, s * 0.56, s * 0.13); ctx.fill(); ctx.stroke();
    // torso
    const bg = ctx.createLinearGradient(0, cy - s * 0.25 + bob, 0, cy + s * 0.6 + bob); bg.addColorStop(0, p.armorL); bg.addColorStop(1, p.armor);
    rr(cx - s * 0.6, cy - s * 0.2 + bob, s * 1.2, s * 0.92, s * 0.4); ctx.fillStyle = bg; ctx.fill(); ctx.stroke();
    // chest crest — a small diamond emblem in the hero's accent colour (no emoji)
    if (u.emblem) { const ey0 = cy + s * 0.24 + bob, cs = s * 0.2;
      ctx.fillStyle = p.armorL; ctx.beginPath(); ctx.moveTo(cx, ey0 - cs); ctx.lineTo(cx + cs, ey0); ctx.lineTo(cx, ey0 + cs); ctx.lineTo(cx - cs, ey0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.moveTo(cx, ey0 - cs); ctx.lineTo(cx + cs, ey0); ctx.lineTo(cx, ey0); ctx.closePath(); ctx.fill();
    } else { ctx.fillStyle = "rgba(255,255,255,.16)"; ctx.beginPath(); ctx.arc(cx, cy + s * 0.18 + bob, s * 0.15, 0, 7); ctx.fill(); }
    // front arm + weapon (on the side facing the enemy)
    const ax = cx + f * s * 0.6;
    drawWeapon(u, ax, cy + s * 0.12 + bob, f, s, p);
    ctx.fillStyle = shade(p.armor, 1.08);
    rr(cx + f * s * 0.47 - s * 0.13, cy - s * 0.06 + bob, s * 0.26, s * 0.56, s * 0.13); ctx.fill(); ctx.stroke();
    // horns (monsters) behind the head
    if (p.foe) { ctx.fillStyle = shade(p.skin, 0.72);
      ctx.beginPath(); ctx.moveTo(cx - hr * 0.62, hy - hr * 0.55); ctx.lineTo(cx - hr * 1.02, hy - hr * 1.45); ctx.lineTo(cx - hr * 0.12, hy - hr * 0.82); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + hr * 0.62, hy - hr * 0.55); ctx.lineTo(cx + hr * 1.02, hy - hr * 1.45); ctx.lineTo(cx + hr * 0.12, hy - hr * 0.82); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // head
    ctx.beginPath(); ctx.arc(cx, hy, hr, 0, 7); ctx.fillStyle = p.skin; ctx.fill(); ctx.stroke();
    // helmet crest (your troops) — a coloured cap over the top of the head
    if (!p.foe) { ctx.fillStyle = p.armor; ctx.beginPath(); ctx.arc(cx, hy, hr, Math.PI * 1.02, Math.PI * 1.98); ctx.arc(cx, hy - hr * 0.1, hr * 0.9, Math.PI * 1.98, Math.PI * 1.02, true); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, hy - hr * 1.02); ctx.lineTo(cx, hy - hr * 1.5); ctx.stroke(); ctx.fillStyle = p.armorL; ctx.beginPath(); ctx.arc(cx, hy - hr * 1.5, hr * 0.16, 0, 7); ctx.fill(); }
    // face — eyes
    const ex = hr * 0.36, ey = hy + hr * 0.02, er = hr * 0.22;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx - ex, ey, er, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(cx + ex, ey, er, 0, 7); ctx.fill();
    ctx.fillStyle = "#0e1a20"; const pj = f * er * 0.32;
    ctx.beginPath(); ctx.arc(cx - ex + pj, ey + er * 0.1, er * 0.56, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(cx + ex + pj, ey + er * 0.1, er * 0.56, 0, 7); ctx.fill();
    // brows
    ctx.strokeStyle = p.stroke; ctx.lineWidth = Math.max(1.6, s * 0.085);
    if (p.foe) { ctx.beginPath(); ctx.moveTo(cx - ex * 1.5, ey - er * 1.25); ctx.lineTo(cx - ex * 0.35, ey - er * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + ex * 1.5, ey - er * 1.25); ctx.lineTo(cx + ex * 0.35, ey - er * 0.35); ctx.stroke(); }
    // mouth
    ctx.lineWidth = Math.max(1.6, s * 0.075);
    if (p.foe) { ctx.beginPath(); ctx.arc(cx, hy + hr * 0.62, hr * 0.32, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      ctx.fillStyle = "#fff"; // fangs
      ctx.beginPath(); ctx.moveTo(cx - hr * 0.2, hy + hr * 0.4); ctx.lineTo(cx - hr * 0.1, hy + hr * 0.66); ctx.lineTo(cx - hr * 0.3, hy + hr * 0.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + hr * 0.2, hy + hr * 0.4); ctx.lineTo(cx + hr * 0.1, hy + hr * 0.66); ctx.lineTo(cx + hr * 0.3, hy + hr * 0.5); ctx.closePath(); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(cx, hy + hr * 0.34, hr * 0.28, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke(); }
    // hit flash over the whole figure
    if (u.flash > 0) { ctx.globalAlpha = u.flash * 0.7; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, hy, hr, 0, 7); ctx.fill(); rr(cx - s * 0.6, cy - s * 0.2 + bob, s * 1.2, s * 0.92, s * 0.4); ctx.fill(); ctx.globalAlpha = 1; }
    // hp bar
    const barW = s * 1.5, hpp = Math.max(0, u.hp / u.maxHp), byy = cy - s * 1.55 + bob;
    ctx.fillStyle = "rgba(4,10,18,.85)"; rr(cx - barW / 2, byy, barW, 5, 2.5); ctx.fill();
    ctx.fillStyle = u.side === "you" ? "#7CFFB0" : "#ff6b6b"; rr(cx - barW / 2, byy, barW * hpp, 5, 2.5); ctx.fill();
  }
  function drawWeapon(u, x, y, f, s, p) {
    ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.lineWidth = Math.max(2, s * 0.13); ctx.strokeStyle = p.stroke;
    if (p.weapon === "staff") { ctx.strokeStyle = "#caa46a"; ctx.beginPath(); ctx.moveTo(x, y + s * 0.5); ctx.lineTo(x + f * s * 0.05, y - s * 0.55); ctx.stroke();
      ctx.fillStyle = "#7CFFB0"; ctx.beginPath(); ctx.arc(x + f * s * 0.05, y - s * 0.62, s * 0.2, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(x + f * s * 0.05, y - s * 0.62, s * 0.34, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    } else if (p.weapon === "sword") { ctx.strokeStyle = "#cdd8e6"; ctx.beginPath(); ctx.moveTo(x - f * s * 0.1, y + s * 0.45); ctx.lineTo(x + f * s * 0.3, y - s * 0.6); ctx.stroke();
      ctx.strokeStyle = "#8a5a2b"; ctx.lineWidth = Math.max(2, s * 0.16); ctx.beginPath(); ctx.moveTo(x - f * s * 0.28, y + s * 0.28); ctx.lineTo(x + f * s * 0.08, y + s * 0.44); ctx.stroke();
    } else { ctx.strokeStyle = shade(p.skin, 0.6); ctx.beginPath(); ctx.moveTo(x - f * s * 0.05, y + s * 0.45); ctx.lineTo(x + f * s * 0.28, y - s * 0.4); ctx.stroke();
      ctx.fillStyle = shade(p.armor, 0.85); ctx.beginPath(); ctx.arc(x + f * s * 0.3, y - s * 0.46, s * 0.22, 0, 7); ctx.fill(); ctx.stroke();
      for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28; ctx.beginPath(); ctx.moveTo(x + f * s * 0.3, y - s * 0.46); ctx.lineTo(x + f * s * 0.3 + Math.cos(a) * s * 0.34, y - s * 0.46 + Math.sin(a) * s * 0.34); ctx.stroke(); } }
    ctx.restore();
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#bcd6ef"); g.addColorStop(1, "#8fb0d0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .5; for (let i = 0; i < 60; i++) { ctx.fillStyle = "#fff"; ctx.fillRect((i * 137) % W, (i * 89) % H, 2, 2); } ctx.globalAlpha = 1;
    // units sorted by y (painter's order) — rendered as standing characters
    const alive = units.filter((u) => u.alive).sort((a, b) => a.y - b.y);
    for (const u of alive) drawChar(u);
    // projectiles with a motion trail
    for (const s of shots) { ctx.strokeStyle = s.col; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.globalAlpha = .5;
      ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, 7); ctx.fill();
      ctx.globalAlpha = .35; ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    // impact rings
    for (const r of rings) { ctx.globalAlpha = Math.max(0, r.life) * 0.6; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.max * (1 - r.life) + 3, 0, 7); ctx.stroke(); } ctx.globalAlpha = 1;
    for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
    // floating damage numbers
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(4,10,18,.7)";
    for (const d of dmgs) { ctx.globalAlpha = Math.max(0, Math.min(1, d.life * 1.4)); const sz = d.foe ? 17 : 14;
      ctx.font = "800 " + sz + "px Oswald, system-ui"; ctx.fillStyle = d.foe ? "#ffe27a" : "#ff8a8a";
      ctx.strokeText(d.val, d.x, d.y); ctx.fillText(d.val, d.x, d.y); } ctx.globalAlpha = 1;
  }

  /* ---------------- loop + controls ---------------- */
  let raf = 0, last = performance.now(), speed = 1, paused = false, ended = false, elapsed = 0, hitTick = 0;
  function frame(now) { const rdt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!paused && !ended) { const dt = rdt * speed; elapsed += dt; step(dt);
      hitTick += dt; if (hitTick > 0.18) { hitTick = 0; if (shots.length || Math.random() < .4) Audio.sfx("click"); }
      const youAlive = units.some((u) => u.alive && u.side === "you"), foeAlive = units.some((u) => u.alive && u.side === "foe");
      if (!youAlive || !foeAlive || elapsed > 22) finish(); }
    draw(); if (!ended) raf = requestAnimationFrame(frame); }
  raf = requestAnimationFrame(frame);

  const btnP = wrap.querySelector('[data-a="pause"]'), btnS = wrap.querySelector('[data-a="speed"]');
  btnP.addEventListener("click", () => { paused = !paused; btnP.textContent = paused ? "▶" : "⏸"; });
  btnS.addEventListener("click", () => { speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; btnS.textContent = speed + "×"; });
  wrap.querySelector('[data-a="exit"]').addEventListener("click", close);
  const onResize = () => fit(); window.addEventListener("resize", onResize);

  function finish() {
    if (ended) return; ended = true; Audio.sfx(win ? "win" : "lose");
    const rewHtml = win ? Object.keys(rewards).map((k) => `<div class="ri2">${rewards[k].ic} ${ab(rewards[k].amt)}</div>`).join("") : "";
    const res = wrap.querySelector(".ba-result");
    res.innerHTML = `<div class="ba-panel">
      <div class="${win ? "bwin" : "blose"}">${win ? "VICTORY" : "DEFEAT"}</div>
      <div class="bnote">${win ? "Loot secured — the monster levels up next time." : "Squad wiped. Level up your heroes, then try again."}</div>
      ${win ? `<div class="rewbox">${rewHtml}</div>` : ""}
      <button class="bigbtn ${win ? "" : "alt"}" data-a="done">${win ? "COLLECT" : "BACK"}</button>
      ${onUpgrade ? `<button class="bigbtn up" data-a="upgrade" style="margin-top:8px">⬆ UPGRADE HEROES</button>` : ""}</div>`;
    res.classList.add("on");
    res.querySelector('[data-a="done"]').addEventListener("click", close);
    const up = res.querySelector('[data-a="upgrade"]'); if (up) up.addEventListener("click", () => { close(); onUpgrade(); });
  }
  function close() { if (closed) return; closed = true; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); wrap.remove(); if (onDone) onDone(); }
  let closed = false;

  return close;
}
