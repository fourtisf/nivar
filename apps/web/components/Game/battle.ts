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

  /* ---------------- build units ---------------- */
  const units = [], shots = [], parts = [];
  const bias = 1.45; // predetermined winner's stat multiplier
  const HPF = 2.6, ATKF = 0.14;
  const heroes = (squad.length ? squad : [{ e: "🫥", power: 40 }]);

  function mk(side, emoji, power, x, y, ranged, big) {
    const boost = (side === "you") === win ? bias : 1;
    const hp = Math.max(20, power * HPF * boost);
    units.push({ side, e: emoji, r: big ? 26 : 17, hp, maxHp: hp, atk: Math.max(3, power * ATKF * boost),
      range: ranged ? 118 : 30, speed: (ranged ? 34 : 48) + Math.random() * 8, cd: Math.random() * 0.6, cdMax: 0.85,
      ranged, x, y, flash: 0, alive: true, big }); }

  // your side (left) — heroes 70% power + a small crew swarm 30%
  const yourHeroPow = eff * 0.7 / heroes.length;
  heroes.forEach((h, i) => mk("you", h.e, yourHeroPow, W * 0.16 + (i % 2) * 26, H * (0.30 + i * 0.11), true, false));
  const crewN = 6, crewPow = eff * 0.3 / crewN;
  for (let i = 0; i < crewN; i++) mk("you", "🥷", crewPow, W * 0.09 + Math.random() * 40, H * (0.28 + Math.random() * 0.5), false, false);
  // enemy side (right) — boss 55% + minions 45%
  mk("foe", monster.e, epow * 0.55, W * 0.82, H * 0.44, false, true);
  const minN = 7, minPow = epow * 0.45 / minN;
  for (let i = 0; i < minN; i++) mk("foe", "👾", minPow, W * 0.86 + Math.random() * 40, H * (0.24 + Math.random() * 0.5), Math.random() < 0.4, false);

  const foeGlow = ({ s1: "#ff6b6b", s2: "#e0a060", s3: "#b06bff", s4: "#56e0ff", s5: "#7CFFB0", s6: "#ffce54" })[monster.id] || "#ff6b6b";

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
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; if (!s.t.alive) { shots.splice(i, 1); continue; }
      const dx = s.t.x - s.x, dy = s.t.y - s.y, d = Math.hypot(dx, dy) || 1;
      if (d < 10) { hurt(s.t, s.dmg); shots.splice(i, 1); continue; }
      s.x += dx / d * s.sp * dt; s.y += dy / d * s.sp * dt; }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.life -= dt * 1.6; if (p.life <= 0) parts.splice(i, 1); }
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#bcd6ef"); g.addColorStop(1, "#8fb0d0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .5; for (let i = 0; i < 60; i++) { ctx.fillStyle = "#fff"; ctx.fillRect((i * 137) % W, (i * 89) % H, 2, 2); } ctx.globalAlpha = 1;
    // units sorted by y
    const alive = units.filter((u) => u.alive).sort((a, b) => a.y - b.y);
    for (const u of alive) {
      ctx.fillStyle = "rgba(20,40,60,.25)"; ctx.beginPath(); ctx.ellipse(u.x, u.y + u.r * 0.7, u.r * 0.9, u.r * 0.4, 0, 0, 7); ctx.fill();
      const col = u.side === "you" ? "#7CFFB0" : foeGlow;
      ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, 7); ctx.fillStyle = "rgba(8,18,30,.55)"; ctx.fill();
      ctx.lineWidth = u.big ? 4 : 2.5; ctx.strokeStyle = col; ctx.stroke();
      if (u.flash > 0) { ctx.globalAlpha = u.flash; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.font = (u.big ? 34 : 22) + "px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(u.e, u.x, u.y + 1);
      // hp bar
      const bw = u.r * 2, hpp = Math.max(0, u.hp / u.maxHp); ctx.fillStyle = "rgba(4,10,18,.8)"; ctx.fillRect(u.x - bw / 2, u.y - u.r - 8, bw, 4);
      ctx.fillStyle = u.side === "you" ? "#7CFFB0" : "#ff6b6b"; ctx.fillRect(u.x - bw / 2, u.y - u.r - 8, bw * hpp, 4);
    }
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
