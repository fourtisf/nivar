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
  const { container, squad, monster, win, eff, epow, rewards, onDone } = opts;
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

  /* ---------------- build units ---------------- */
  const units = [], shots = [], parts = [];
  const bias = 1.5; // predetermined winner's stat multiplier
  const HPF = 2.6, ATKF = 0.14;
  const heroes = (squad.length ? squad : [{ e: "🫥", power: 40 }]);
  // per-kind body palette (light top → dark bottom, stroke)
  const PAL = {
    hero: { l: "#9bffc6", d: "#2aa870", s: "#7CFFB0" },
    crew: { l: "#72cfa2", d: "#22694d", s: "#57e0a0" },
    boss: { l: shade(foeGlow, 1.28), d: shade(foeGlow, 0.55), s: foeGlow },
    minion: { l: "#ff9d9d", d: "#a83232", s: "#ff6b6b" },
  };

  function mk(side, emoji, power, x, y, ranged, kind) {
    const boost = (side === "you") === win ? bias : 1;
    const big = kind === "boss";
    const hp = Math.max(20, power * HPF * boost);
    units.push({ side, e: emoji, r: big ? 34 : ranged ? 22 : 19, hp, maxHp: hp, atk: Math.max(3, power * ATKF * boost),
      range: ranged ? 128 : 34, speed: (ranged ? 30 : 46) + Math.random() * 6, cd: Math.random() * 0.6, cdMax: ranged ? 0.9 : 0.7,
      ranged, x, y, flash: 0, alive: true, big, kind, pal: PAL[kind], step: Math.random() * 6.28 }); }

  // your side (left) — heroes (ranged, 60% power) form a back line, crew (melee, 40%) up front
  const yourHeroPow = eff * 0.6 / heroes.length;
  const hSpread = Math.min(0.13, 0.62 / heroes.length);
  heroes.forEach((h, i) => mk("you", h.e, yourHeroPow, W * 0.20, H * (0.5 - (heroes.length - 1) * hSpread / 2 + i * hSpread), true, "hero"));
  const crewN = 3, crewPow = eff * 0.4 / crewN;
  for (let i = 0; i < crewN; i++) mk("you", "🥷", crewPow, W * 0.11, H * (0.34 + i * 0.16), false, "crew");
  // enemy side (right) — boss (50%) + a minion line (50%)
  mk("foe", monster.e, epow * 0.5, W * 0.80, H * 0.46, false, "boss");
  const minN = 5, minPow = epow * 0.5 / minN;
  for (let i = 0; i < minN; i++) mk("foe", "👾", minPow, W * 0.89, H * (0.24 + i * 0.13), Math.random() < 0.35, "minion");

  /* ---------------- sim ---------------- */
  function nearest(u) { let best = null, bd = 1e9;
    for (const o of units) { if (!o.alive || o.side === u.side) continue; const d = (o.x - u.x) ** 2 + (o.y - u.y) ** 2; if (d < bd) { bd = d; best = o; } }
    return best; }
  function hurt(u, dmg) { u.hp -= dmg; u.flash = 1; burst(u.x, u.y, 4, u.side === "you" ? "#9fd0ff" : "#ffb0b0");
    if (u.hp <= 0 && u.alive) { u.alive = false; burst(u.x, u.y, 12, u.big ? foeGlow : "#dfe9f5"); } }
  function burst(x, y, n, c) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: Math.random() * 3 - 1.5, vy: Math.random() * 3 - 1.5, life: 1, r: Math.random() * 2 + 1, c }); }

  function step(dt) {
    for (const u of units) { if (!u.alive) continue; u.flash = Math.max(0, u.flash - dt * 4);
      const t = nearest(u); if (!t) continue;
      const dx = t.x - u.x, dy = t.y - u.y, dist = Math.hypot(dx, dy) || 1;
      if (dist > u.range) { u.x += dx / dist * u.speed * dt; u.y += dy / dist * u.speed * dt; }
      else { u.cd -= dt; if (u.cd <= 0) { u.cd = u.cdMax;
        if (u.ranged) { shots.push({ x: u.x, y: u.y, t, dmg: u.atk, col: u.side === "you" ? "#7CFFB0" : foeGlow, side: u.side, sp: 320 }); }
        else { hurt(t, u.atk); u.x -= dx / dist * 5; setTimeout(() => {}, 0); }
      } } }
    // separation — units push apart so they form readable lines instead of piling up
    for (let i = 0; i < units.length; i++) { const a = units[i]; if (!a.alive) continue;
      for (let j = i + 1; j < units.length; j++) { const b = units[j]; if (!b.alive) continue;
        let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; const min = (a.r + b.r) * 0.9;
        if (d < min) { const p = (min - d) / d * 0.5; a.x -= dx * p; a.y -= dy * p; b.x += dx * p; b.y += dy * p; } } }
    for (const u of units) { u.x = Math.max(u.r, Math.min(W - u.r, u.x)); u.y = Math.max(u.r + 30, Math.min(H - u.r - 10, u.y)); }
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; if (!s.t.alive) { shots.splice(i, 1); continue; }
      const dx = s.t.x - s.x, dy = s.t.y - s.y, d = Math.hypot(dx, dy) || 1;
      if (d < 10) { hurt(s.t, s.dmg); shots.splice(i, 1); continue; }
      s.x += dx / d * s.sp * dt; s.y += dy / d * s.sp * dt; }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.life -= dt * 1.6; if (p.life <= 0) parts.splice(i, 1); }
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawChar(u) {
    const s = u.r, hy = u.y - s * 0.5, hr = s * 0.66;
    const bw = s * 1.5, bh = s * 1.45, bx = u.x - bw / 2, by = u.y - s * 0.12;
    // ground shadow
    ctx.fillStyle = "rgba(12,26,40,.26)"; ctx.beginPath(); ctx.ellipse(u.x, u.y + s * 0.95, s * 0.86, s * 0.32, 0, 0, 7); ctx.fill();
    // body capsule
    const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, u.pal.l); g.addColorStop(1, u.pal.d);
    rr(bx, by, bw, bh, s * 0.55); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = u.big ? 3.5 : 2.4; ctx.strokeStyle = u.pal.s; ctx.stroke();
    // head + face
    ctx.beginPath(); ctx.arc(u.x, hy, hr, 0, 7); ctx.fillStyle = "#0d1a28"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = u.pal.s; ctx.stroke();
    ctx.font = (hr * 1.55) + "px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(u.e, u.x, hy + 1);
    // hit flash
    if (u.flash > 0) { ctx.globalAlpha = u.flash * 0.85; ctx.fillStyle = "#fff"; rr(bx, by, bw, bh, s * 0.55); ctx.fill(); ctx.beginPath(); ctx.arc(u.x, hy, hr, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    // hp bar
    const barW = bw, hpp = Math.max(0, u.hp / u.maxHp), byy = u.y - s * 1.3;
    ctx.fillStyle = "rgba(4,10,18,.85)"; rr(u.x - barW / 2, byy, barW, 5, 2.5); ctx.fill();
    ctx.fillStyle = u.side === "you" ? "#7CFFB0" : "#ff6b6b"; rr(u.x - barW / 2, byy, barW * hpp, 5, 2.5); ctx.fill();
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#bcd6ef"); g.addColorStop(1, "#8fb0d0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .5; for (let i = 0; i < 60; i++) { ctx.fillStyle = "#fff"; ctx.fillRect((i * 137) % W, (i * 89) % H, 2, 2); } ctx.globalAlpha = 1;
    // units sorted by y (painter's order) — rendered as standing characters
    const alive = units.filter((u) => u.alive).sort((a, b) => a.y - b.y);
    for (const u of alive) drawChar(u);
    for (const s of shots) { ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 7); ctx.fill();
      ctx.globalAlpha = .4; ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
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
  const onResize = () => fit(); window.addEventListener("resize", onResize);

  function finish() {
    if (ended) return; ended = true; Audio.sfx(win ? "win" : "lose");
    const rewHtml = win ? Object.keys(rewards).map((k) => `<div class="ri2">${rewards[k].ic} ${ab(rewards[k].amt)}</div>`).join("") : "";
    const res = wrap.querySelector(".ba-result");
    res.innerHTML = `<div class="ba-panel">
      <div class="${win ? "bwin" : "blose"}">${win ? "VICTORY" : "DEFEAT"}</div>
      <div class="bnote">${win ? "Loot secured — the monster levels up next time." : "Squad wiped. Summon &amp; level up heroes, then try again."}</div>
      ${win ? `<div class="rewbox">${rewHtml}</div>` : ""}
      <button class="bigbtn ${win ? "" : "alt"}" data-a="done">${win ? "COLLECT" : "BACK"}</button></div>`;
    res.classList.add("on");
    res.querySelector('[data-a="done"]').addEventListener("click", close);
  }
  function close() { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); wrap.remove(); if (onDone) onDone(); }

  return close;
}
