// @ts-nocheck
/* ============================================================
   NIVAR — survive the winter. Iso base + GameFi layers.

   This is the prototype's <script> ported verbatim. The renderer, HUD,
   sheets, modals, coach and all UI builders are byte-identical to
   nivar.html — only the gameplay DATA tables and balance FORMULAS are
   sourced from @nivar/config (the single source of truth), so the client
   and the server compute the exact same numbers. Behavior is unchanged.

   Milestone 1: state still lives in-memory (the `S` object). Milestones 2+
   replace the literal initial values + mutations with server-authoritative
   calls; the renderer below does not change.
   ============================================================ */
import * as CFG from "@nivar/config";
import { Audio } from "./audio";
import { runBattle } from "./battle";
import { heroArt } from "./heroArt";

export function initGame(): () => void {
  "use strict";
  const $ = (id: string) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  function ab(n) {
    n = Math.floor(n);
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return "" + n;
  }
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* theme: internal keys kept, display reskinned */
  const RICON = CFG.RICON;
  const RNAME = CFG.RNAME;
  const RCOL = CFG.RCOL;

  /* ---------------- ISO CONFIG ---------------- */
  const HW = 36, HH = 18, OX = 430, OY = 180, OW = 860, OH = 640, GRID = 11;
  function isoOff(gx, gy) { return { x: OX + (gx - gy) * HW, y: OY + (gx + gy) * HH }; }

  /* ---------------- STATE ---------------- */
  const S = {
    food: CFG.INITIAL_BASE.food, wood: CFG.INITIAL_BASE.wood, coal: CFG.INITIAL_BASE.coal,
    iron: CFG.INITIAL_BASE.iron, crystal: CFG.INITIAL_BASE.crystal,
    warmth: CFG.INITIAL_BASE.warmth, furnace: CFG.INITIAL_BASE.furnace,
    pop: CFG.INITIAL_BASE.pop, popCap: CFG.INITIAL_BASE.popCap,
    heroes: {}, squad: [], research: {}, clears: {},
  };
  // Mutable local copies (the engine bumps b.lv on upgrade — never mutate config).
  const BUILDINGS = CFG.BUILDINGS.map((b) => ({ ...b }));
  const FURNACE = { ...CFG.FURNACE };
  const TREES = CFG.TREES;

  /* ---------------- HEROES (CT archetypes) ---------------- */
  const HEROES_POOL = CFG.HEROES_POOL;
  const HERO = CFG.HERO;

  /* ---------------- RAIDS / STAGES ---------------- */
  const STAGES = CFG.STAGES;

  /* ---------------- RESEARCH ---------------- */
  const TECHS = CFG.TECHS;

  let job = null, selected = null, upgradedFlag = false, summonedFlag = false, raidWonFlag = false, power = 0;
  let genesisClaimed = false, airdropAt = 0;
  let coachOn = false, coachStep = 0;
  const disp = { food: S.food, wood: S.wood, coal: S.coal, iron: S.iron, crystal: S.crystal, warmth: S.warmth, power: 0 };

  // dispose handles
  let _raf = 0;
  let _onResize = null;
  const _intervals = [];
  const _timeouts = [];

  /* ---------------- DERIVED (delegated to @nivar/config) ---------------- */
  const byId = (id) => (id === "furnace" ? FURNACE : BUILDINGS.find((b) => b.id === id));
  const blMap = () => { const m = {}; for (const b of BUILDINGS) m[b.id] = b.lv; return m; };
  function bonuses() { return CFG.bonuses(S.research, S.squad); }
  function warmthMult() { return CFG.warmthMult(S.warmth); }
  function shelterPopCap() { return CFG.shelterPopCap({ buildingLevels: blMap(), furnace: S.furnace, crewBonus: bonuses().crew }); }
  function heroPower(id) { const o = S.heroes[id]; return o ? CFG.heroPower(id, o.level) : 0; }
  function squadPower() { return S.squad.reduce((a, id) => a + heroPower(id), 0); }
  function squadLevel() { const lv = S.squad.map((id) => (S.heroes[id] ? S.heroes[id].level : 1)); return lv.length ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) : 1; }
  function calcPower() { return CFG.calcPower({ furnace: S.furnace, buildingLevels: blMap(), pop: S.pop, squadPower: squadPower(), research: S.research }); }
  function prodPerSec(b) { return CFG.prodPerSec(b, b.lv, S.warmth, bonuses()); }
  function tempLabel() { return CFG.tempLabel(S.warmth); }
  function upCost(b) { return CFG.upCost(b.res, b.lv); }
  function furnaceCost() { return CFG.furnaceCost(S.furnace); }
  function canPay(c) { return CFG.canPay(S, c); }
  function pay(c) { for (const k in c) S[k] -= c[k]; }
  function buildSecs(t) { return CFG.buildSecsUpgrade(t, bonuses().build); }
  function maxBLevel() { return CFG.maxBLevel(S.furnace); }

  /* ============================================================
     CANVAS — isometric renderer
     ============================================================ */
  const cv = $("world"), ctx = cv.getContext("2d");
  const scene = document.createElement("canvas"); const sx = scene.getContext("2d");
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let VW = 0, VH = 0, cam = { x: 0, y: 0 }, panMin = { x: 0, y: 0 }, panMax = { x: 0, y: 0 };
  function fit() {
    const r = $("game").getBoundingClientRect(); VW = r.width; VH = r.height;
    cv.width = VW * DPR; cv.height = VH * DPR; cv.style.width = VW + "px"; cv.style.height = VH + "px"; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    scene.width = OW * DPR; scene.height = OH * DPR; sx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const f = isoOff(FURNACE.gx, FURNACE.gy);
    const dcx = VW / 2 - f.x, dcy = VH * 0.50 - f.y; cam.x = dcx; cam.y = dcy;
    const MX = Math.max(60, (OW - VW) / 2 + 110), MY = Math.max(60, (OH - VH) / 2 + 150);
    panMin.x = dcx - MX; panMax.x = dcx + MX; panMin.y = dcy - MY; panMax.y = dcy + MY;
    renderScene(); positionOverlays();
  }
  function w2s(gx, gy) { const o = isoOff(gx, gy); return { x: o.x + cam.x, y: o.y + cam.y }; }
  function poly(g, pts, fill, stroke, lw) { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); } }
  function tileDiamond(cx, cy, w) { const hw = w, hh = w / 2; return [{ x: cx, y: cy - hh }, { x: cx + hw, y: cy }, { x: cx, y: cy + hh }, { x: cx - hw, y: cy }]; }
  function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgb(${clamp(r + amt, 0, 255)},${clamp(g + amt, 0, 255)},${clamp(b + amt, 0, 255)})`; }
  function drawTerrain(g) {
    for (let s = 0; s <= 2 * (GRID - 1); s++) { for (let gx = 0; gx < GRID; gx++) { const gy = s - gx; if (gy < 0 || gy >= GRID) continue;
      const o = isoOff(gx, gy); const plaza = Math.abs(gx - 5) <= 1 && Math.abs(gy - 5) <= 1; const tint = ((gx * 7 + gy * 11) % 5) * 3;
      const top = plaza ? `rgb(${206 - tint},${190 - tint},${166 - tint})` : `rgb(${214 - tint},${228 - tint},${244 - tint})`;
      poly(g, tileDiamond(o.x, o.y, HW), top, "rgba(150,176,205,.35)", 1); } }
    g.globalAlpha = .5; for (let i = 0; i < 420; i++) { const x = Math.random() * OW, y = Math.random() * OH; g.fillStyle = Math.random() < .5 ? "#fff" : "#c6d6e8"; g.fillRect(x, y, 1.4, 1.4); } g.globalAlpha = 1;
  }
  function drawTree(g, cx, cy, sc) { sc = sc || 1; g.save();
    g.fillStyle = "rgba(40,60,80,.25)"; g.beginPath(); g.ellipse(cx, cy + 2, 16 * sc, 7 * sc, 0, 0, 7); g.fill();
    g.fillStyle = "#6b4a30"; g.fillRect(cx - 3 * sc, cy - 18 * sc, 6 * sc, 20 * sc);
    const layer = (yb, w, h, col) => { poly(g, [{ x: cx, y: yb - h }, { x: cx + w, y: yb }, { x: cx - w, y: yb }], col); poly(g, [{ x: cx, y: yb - h }, { x: cx + w * .55, y: yb - h * .35 }, { x: cx - w * .55, y: yb - h * .35 }], "#eef6ff"); };
    layer(cy - 12 * sc, 17 * sc, 24 * sc, "#2f6b4a"); layer(cy - 26 * sc, 14 * sc, 22 * sc, "#367a55"); layer(cy - 40 * sc, 11 * sc, 20 * sc, "#3e885f"); g.restore(); }
  const PAL = {
    hunters: { l: "#7a3f2e", r: "#9a5740", roof: "#7c2f2c" }, cookhouse: { l: "#7a3f2e", r: "#9a5740", roof: "#8a3a2c" },
    sawmill: { l: "#33424f", r: "#46586a", roof: "#2a3742" }, mine: { l: "#3a4650", r: "#525f6b", roof: "#2c343d" },
    shelter: { l: "#4a5663", r: "#65707d", roof: "#3a4450" }, clinic: { l: "#b9ac93", r: "#ddd1bc", roof: "#b5544c" },
    explorers: { l: "#2f4a44", r: "#456b62", roof: "#264e44" },
  };
  function wallPt(a, edge, up, t, h) { return { x: a.x + edge.x * t + up.x * h, y: a.y + edge.y * t + up.y * h }; }
  function drawBuilding(g, b, cx, cy) {
    const sc = 1 + (b.lv - 1) * 0.06, hw = HW * 0.96 * sc, hh = hw / 2, wallH = 30 * sc, roofH = 18 * sc, pal = PAL[b.type] || PAL.hunters, glow = b.glow || "#ffcf6e";
    const N = { x: cx, y: cy - hh }, E = { x: cx + hw, y: cy }, Sp = { x: cx, y: cy + hh }, Wp = { x: cx - hw, y: cy };
    g.fillStyle = "rgba(40,60,80,.3)"; g.beginPath(); g.ellipse(cx, cy + 3, hw * 1.05, hh * 0.9, 0, 0, 7); g.fill();
    const N2 = { x: N.x, y: N.y - wallH }, E2 = { x: E.x, y: E.y - wallH }, S2 = { x: Sp.x, y: Sp.y - wallH }, W2 = { x: Wp.x, y: Wp.y - wallH };
    poly(g, [Wp, Sp, S2, W2], pal.l, "rgba(0,0,0,.25)", 1); poly(g, [Sp, E, E2, S2], pal.r, "rgba(0,0,0,.18)", 1);
    const edgeL = { x: Sp.x - Wp.x, y: Sp.y - Wp.y }, up = { x: 0, y: -wallH }, edgeR = { x: E.x - Sp.x, y: E.y - Sp.y };
    function win(a, edge, t, h, wsz, hsz, col) { const c = wallPt(a, edge, up, t, h), e = { x: edge.x * wsz, y: edge.y * wsz }, u = { x: 0, y: -wallH * hsz };
      poly(g, [{ x: c.x, y: c.y }, { x: c.x + e.x, y: c.y + e.y }, { x: c.x + e.x, y: c.y + e.y + u.y }, { x: c.x, y: c.y + u.y }], col, "rgba(0,0,0,.3)", 1); }
    if (b.type === "mine") { win(Sp, edgeR, .5, .55, .42, .55, "#0c1117"); const oc = b.oreCol || "#888";
      g.fillStyle = oc; g.beginPath(); g.ellipse(Sp.x + 10 * sc, Sp.y + 3, 9 * sc, 5 * sc, 0, 0, 7); g.fill();
      g.fillStyle = shade(oc, 40); g.beginPath(); g.ellipse(Sp.x + 6 * sc, Sp.y, 4 * sc, 3 * sc, 0, 0, 7); g.fill();
    } else { win(Wp, edgeL, .32, .5, .2, .4, glow); win(Wp, edgeL, .62, .5, .2, .4, glow); win(Sp, edgeR, .5, .18, .22, .55, "#3a2a1a");
      if (b.type === "shelter") { win(Sp, edgeR, .72, .55, .18, .35, glow); } }
    const apex = { x: cx, y: cy - wallH - roofH };
    poly(g, [W2, S2, apex], pal.roof, "rgba(0,0,0,.2)", 1); poly(g, [S2, E2, apex], shade(pal.roof, 18), "rgba(0,0,0,.15)", 1);
    poly(g, [N2, W2, apex], shade(pal.roof, -12)); poly(g, [N2, E2, apex], shade(pal.roof, -4));
    poly(g, [apex, lerp(apex, W2, .5), lerp(apex, S2, .5)], "#eef6ff"); poly(g, [apex, lerp(apex, S2, .5), lerp(apex, E2, .5)], "#f4faff");
    g.strokeStyle = "#eef6ff"; g.lineWidth = 2.5 * sc; g.beginPath(); g.moveTo(W2.x, W2.y); g.lineTo(S2.x, S2.y); g.lineTo(E2.x, E2.y); g.stroke();
    if (b.type === "cookhouse" || b.type === "hunters" || b.type === "shelter") { const ch = lerp(N2, E2, .35);
      g.fillStyle = shade(pal.l, -10); g.fillRect(ch.x - 3 * sc, ch.y - 14 * sc, 6 * sc, 14 * sc); g.fillStyle = "#eef6ff"; g.fillRect(ch.x - 4 * sc, ch.y - 16 * sc, 8 * sc, 3 * sc);
      g.globalAlpha = .5; g.fillStyle = "#cdd8e4"; g.beginPath(); g.arc(ch.x, ch.y - 20 * sc, 4 * sc, 0, 7); g.arc(ch.x + 3 * sc, ch.y - 26 * sc, 5 * sc, 0, 7); g.fill(); g.globalAlpha = 1; }
    if (b.type === "sawmill") { g.fillStyle = shade(glow, -120); for (let i = 0; i < 3; i++) { g.fillStyle = "rgba(86,224,255,.25)"; g.fillRect(Wp.x - 13 * sc, Wp.y + 2 + i * 5, 16 * sc, 3 * sc); } }
    if (b.type === "clinic") { const c = wallPt(Sp, edgeR, up, .5, .62); g.fillStyle = "#ff6b6b"; g.fillRect(c.x - 2.5 * sc, c.y - 9 * sc, 5 * sc, 16 * sc); g.fillRect(c.x - 7 * sc, c.y - 4 * sc, 14 * sc, 5 * sc); }
    if (b.type === "explorers") { g.strokeStyle = "#c9d4e0"; g.lineWidth = 2; g.beginPath(); g.moveTo(apex.x, apex.y); g.lineTo(apex.x, apex.y - 16 * sc); g.stroke();
      g.strokeStyle = glow; g.lineWidth = 1.5; for (let rr = 4; rr <= 10; rr += 3) { g.beginPath(); g.arc(apex.x, apex.y - 16 * sc, rr * sc, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); } }
  }
  function drawFurnaceBody(g, cx, cy) {
    const sc = 1 + (S.furnace - 1) * 0.05, hw = HW * 1.35 * sc, hh = hw / 2, wallH = 46 * sc;
    const N = { x: cx, y: cy - hh }, E = { x: cx + hw, y: cy }, Sp = { x: cx, y: cy + hh }, Wp = { x: cx - hw, y: cy };
    const N2 = { x: N.x, y: N.y - wallH }, E2 = { x: E.x, y: E.y - wallH }, S2 = { x: Sp.x, y: Sp.y - wallH }, W2 = { x: Wp.x, y: Wp.y - wallH };
    g.fillStyle = "rgba(30,45,65,.35)"; g.beginPath(); g.ellipse(cx, cy + 4, hw * 1.1, hh, 0, 0, 7); g.fill();
    poly(g, [Wp, Sp, S2, W2], "#3a4450", "rgba(0,0,0,.3)", 1); poly(g, [Sp, E, E2, S2], "#4c5763", "rgba(0,0,0,.2)", 1);
    g.strokeStyle = "rgba(124,255,176,.25)"; g.lineWidth = 1;
    for (let i = 1; i < 3; i++) { const yy = Sp.y - wallH * i / 3; g.beginPath(); g.moveTo(Wp.x, Wp.y - wallH * i / 3); g.lineTo(Sp.x, yy); g.lineTo(E.x, E.y - wallH * i / 3); g.stroke(); }
    g.strokeStyle = "#5a3f28"; g.lineWidth = 4 * sc; [[Wp, W2], [E, E2], [Sp, S2]].forEach(([a, b2]) => { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b2.x, b2.y - 6 * sc); g.stroke(); });
    poly(g, [N2, E2, S2, W2], "#222a33");
    poly(g, [lerp(N2, { x: cx, y: cy - wallH }, .4), lerp(E2, { x: cx, y: cy - wallH }, .4), lerp(S2, { x: cx, y: cy - wallH }, .4), lerp(W2, { x: cx, y: cy - wallH }, .4)], "#140a05");
    g.strokeStyle = "#eef6ff"; g.lineWidth = 2.5 * sc; g.beginPath(); g.moveTo(W2.x, W2.y); g.lineTo(S2.x, S2.y); g.lineTo(E2.x, E2.y); g.stroke();
    FURNACE._top = { x: cx, y: cy - wallH - 2 * sc, sc };
  }
  function renderScene() {
    sx.clearRect(0, 0, OW, OH); drawTerrain(sx);
    const objs = []; for (const t of TREES) objs.push({ k: "tree", gx: t[0], gy: t[1] });
    for (const b of BUILDINGS) objs.push({ k: "b", gx: b.gx, gy: b.gy, b }); objs.push({ k: "f", gx: FURNACE.gx, gy: FURNACE.gy });
    objs.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy) || a.gx - b.gx);
    for (const o of objs) { const p = isoOff(o.gx, o.gy);
      if (o.k === "tree") drawTree(sx, p.x, p.y, 0.85 + ((o.gx * 3 + o.gy) % 3) * 0.08);
      else if (o.k === "b") drawBuilding(sx, o.b, p.x, p.y); else drawFurnaceBody(sx, p.x, p.y); }
  }
  let flakes = [], embers = []; const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function initFlakes() { const n = reduce ? 40 : 110; flakes = Array.from({ length: n }, () => ({ x: Math.random() * VW, y: Math.random() * VH, r: Math.random() * 2.2 + .6, s: Math.random() * .7 + .3, d: Math.random() * 7, o: Math.random() * .5 + .3 })); }
  function drawLive(t) {
    const ft = (function () { const base = w2s(FURNACE.gx, FURNACE.gy); const off = (FURNACE._top ? (isoOff(FURNACE.gx, FURNACE.gy).y - FURNACE._top.y) : 90); return { x: base.x, y: base.y - off, sc: (FURNACE._top ? FURNACE._top.sc : 1) }; })();
    const gr = ctx.createRadialGradient(ft.x, ft.y + 12, 4, ft.x, ft.y + 12, 90 + S.warmth * 1.3 + S.furnace * 16); const a = clamp(S.warmth / 120, 0, 1);
    gr.addColorStop(0, `rgba(255,170,70,${0.5 * a})`); gr.addColorStop(.4, `rgba(255,120,40,${0.18 * a})`); gr.addColorStop(1, "rgba(255,120,40,0)");
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(ft.x, ft.y + 12, 90 + S.warmth * 1.3 + S.furnace * 16, 0, 7); ctx.fill(); ctx.restore();
    const fl = (Math.sin(t / 90) + 1) / 2; ctx.save(); ctx.translate(ft.x, ft.y);
    const flame = (w, h, col, ox) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ox, 0); ctx.quadraticCurveTo(ox - w, -h * .5, ox, -h * (1 + fl * .2)); ctx.quadraticCurveTo(ox + w, -h * .5, ox, 0); ctx.fill(); };
    ctx.shadowColor = "rgba(255,120,30,.9)"; ctx.shadowBlur = 20; flame(13 * ft.sc, 30 * ft.sc, "#ff5a1a", 0); flame(9 * ft.sc, 24 * ft.sc, "#ff9b3d", -2); flame(6 * ft.sc, 18 * ft.sc, "#ffd66a", 2); ctx.shadowBlur = 0; ctx.restore();
    if (!reduce && Math.random() < .7) embers.push({ x: ft.x + (Math.random() * 14 - 7), y: ft.y, vx: Math.random() * .8 - .4, vy: -(Math.random() * 1.1 + .6), life: 1, r: Math.random() * 1.8 + .8 });
    for (let i = embers.length - 1; i >= 0; i--) { const p = embers[i]; p.x += p.vx; p.y += p.vy; p.vy += .012; p.life -= .012; if (p.life <= 0) { embers.splice(i, 1); continue; }
      ctx.globalAlpha = p.life; ctx.fillStyle = p.c || (p.life > .5 ? "#ffb259" : "#ff5a1a"); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life + .4, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
    if (selected) { const b = byId(selected); const p = w2s(b.gx, b.gy); const hw = b.id === "furnace" ? HW * 1.4 : HW; const d = tileDiamond(p.x, p.y, hw);
      ctx.strokeStyle = `rgba(124,255,176,${0.5 + 0.4 * Math.sin(t / 180)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(d[0].x, d[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(d[i].x, d[i].y); ctx.closePath(); ctx.stroke(); }
    const wind = Math.sin(t / 4000) * .6;
    for (const f of flakes) { f.y += f.s * 1.5; f.x += Math.sin(f.d) * .4 + wind; f.d += .01; if (f.y > VH + 4) { f.y = -4; f.x = Math.random() * VW; } if (f.x > VW + 4) f.x = -4; if (f.x < -4) f.x = VW + 4;
      ctx.globalAlpha = f.o; ctx.fillStyle = "#eaf4ff"; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
  }

  /* ============================================================
     OVERLAY labels
     ============================================================ */
  const overlay = $("overlay"); const spots = {};
  function buildOverlay() { overlay.innerHTML = ""; const make = (b) => { const el = document.createElement("div"); el.className = "bspot";
    el.innerHTML = `<span class="hammer" style="display:none">🔨</span><span class="nm">${b.name}</span><span class="lv"><span>▲</span><span class="lvn"></span></span><span class="pbar"><i></i></span>`;
    el.addEventListener("click", (e) => { e.stopPropagation(); openBuilding(b.id); }); overlay.appendChild(el); spots[b.id] = el; };
    make(FURNACE); for (const b of BUILDINGS) make(b); }
  function positionOverlays() { const place = (b, el, lift) => { const p = w2s(b.gx, b.gy); el.style.left = p.x + "px"; el.style.top = (p.y - lift) + "px"; };
    place(FURNACE, spots["furnace"], 86 + S.furnace * 2); for (const b of BUILDINGS) place(b, spots[b.id], 58 + b.lv * 2); }
  function refreshOverlay() { const set = (b, el) => { const lvl = b.id === "furnace" ? S.furnace : b.lv; el.querySelector(".lvn").textContent = lvl; const busy = job && job.target === b.id; el.classList.toggle("busy", busy);
    el.querySelector(".hammer").style.display = busy ? "block" : "none"; if (busy) { const pct = clamp((1 - (job.endsAt - Date.now()) / job.total) * 100, 0, 100); el.querySelector(".pbar i").style.width = pct + "%"; el.querySelector(".lvn").textContent = "→" + (lvl + 1); } };
    set(FURNACE, spots["furnace"]); for (const b of BUILDINGS) set(b, spots[b.id]); }

  /* ============================================================
     HUD
     ============================================================ */
  function renderHUD() {
    $("r-food").textContent = ab(disp.food); $("r-wood").textContent = ab(disp.wood); $("r-coal").textContent = ab(disp.coal); $("r-iron").textContent = ab(disp.iron);
    $("gemVal").textContent = Math.floor(disp.crystal).toLocaleString("en-US"); $("powVal").textContent = Math.floor(disp.power).toLocaleString("en-US");
    $("popVal").textContent = Math.floor(S.pop) + "/" + S.popCap;
    const tl = tempLabel(); $("sentEmo").textContent = tl[0]; $("sentVal").textContent = tl[1]; $("sentLbl").textContent = tl[2];
    if (job) { const r = Math.max(0, job.endsAt - Date.now()); const m = Math.floor(r / 60000), s = Math.floor((r % 60000) / 1000); $("buildTimer").textContent = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s; } else $("buildTimer").textContent = "Idle";
    // squad mini
    const sm = $("squadMini"); const html = S.squad.slice(0, 3).map((id) => { const h = HERO(id); return `<div class="ha" style="border-color:${RCOL[h.rarity]}">${heroArt(h.id, h.e)}</div>`; }).join("") || `<div class="ha" style="border-color:#445">➕</div>`;
    if (sm._h !== html) { sm.innerHTML = html; sm._h = html; }
    $("heroDot").style.display = (S.crystal >= 100 && S.squad.length < 5) ? "block" : "none";
  }

  /* ============================================================
     QUESTS — campaign / daily / milestones (manual CLAIM)
     ============================================================ */
  const stats = { summons: 0, raidWins: 0, upgrades: 0 };
  const dStats = { summons: 0, raidWins: 0, upgrades: 0, airdrop: false };
  const claimed = new Set();        // "cat:id"
  const chestClaimed = new Set();   // daily chest index
  function researchLv() { return Object.values(S.research).reduce((a, b) => a + b, 0); }
  function clearedCount() { return Object.values(S.clears).filter((c) => c.cleared).length; }
  function hasLegendary() { return Object.keys(S.heroes).some((id) => HERO(id).rarity === "legendary"); }
  function stageDone(id) { return S.clears[id] && S.clears[id].cleared ? 1 : 0; }

  // Quest defs come from config (targets/rewards/text — single source); the
  // runtime progress closures (`cur`) bind to local counters by metric.
  function questCur(q) {
    switch (q.metric) {
      case "upgrades": return () => stats.upgrades;
      case "summons": return () => stats.summons;
      case "raidWins": return () => stats.raidWins;
      case "squad": return () => S.squad.length;
      case "furnace": return () => S.furnace;
      case "power": return () => power;
      case "researchLv": return () => researchLv();
      case "stageDone": return () => stageDone(q.param);
      case "airdrop": return () => (dStats.airdrop ? 1 : 0);
      case "dailyUpgrades": return () => dStats.upgrades;
      case "dailySummons": return () => dStats.summons;
      case "dailyRaidWins": return () => dStats.raidWins;
      case "legendary": return () => (hasLegendary() ? 1 : 0);
      case "cleared": return () => clearedCount();
      default: return () => 0;
    }
  }
  const QUESTS = {
    main: CFG.QUESTS.main.map((q) => ({ ...q, cur: questCur(q) })),
    daily: CFG.QUESTS.daily.map((q) => ({ ...q, cur: questCur(q) })),
    miles: CFG.QUESTS.miles.map((q) => ({ ...q, cur: questCur(q) })),
  };
  const CHESTS = CFG.CHESTS;
  function qDone(q) { return q.cur() >= q.tgt; }
  function qClaimable(cat, q) { return qDone(q) && !claimed.has(cat + ":" + q.id); }
  function dailyPoints() { return QUESTS.daily.reduce((a, q) => a + (qDone(q) ? q.pts : 0), 0); }
  function claimableCount() { let n = 0;
    for (const cat of ["main", "daily", "miles"]) for (const q of QUESTS[cat]) if (qClaimable(cat, q)) n++;
    for (let i = 0; i < CHESTS.length; i++) if (dailyPoints() >= CHESTS[i].p && !chestClaimed.has(i)) n++; return n; }
  function grant(rew) { for (const k in rew) { if (k === "crystalBig") S.crystal += CFG.CRYSTAL_BIG_AMOUNT; else S[k] += rew[k]; } }
  function rewText(rew) { return Object.keys(rew).map((k) => (k === "crystalBig" ? "💎" + CFG.CRYSTAL_BIG_AMOUNT.toLocaleString("en-US") : RICON[k] + " " + ab(rew[k]))).join("  "); }
  function claimQuest(cat, id) { const q = QUESTS[cat].find((x) => x.id === id); if (!q || !qClaimable(cat, q)) return;
    claimed.add(cat + ":" + q.id); grant(q.rew); Audio.sfx("reward"); toast("Reward claimed · " + rewText(q.rew), "gold"); juiceClaim(); refresh(); renderQuests(); }
  function claimChest(i) { if (dailyPoints() < CHESTS[i].p || chestClaimed.has(i)) return; chestClaimed.add(i); S.crystal += CHESTS[i].rew;
    toast("Daily chest · +" + CHESTS[i].rew + " 💎", "gold"); juiceClaim(); refresh(); renderQuests(); }
  function juiceClaim() { const fl = $("flash"); fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go"); }
  function nextMain() { for (const q of QUESTS.main) { if (!claimed.has("main:" + q.id)) return q; } return null; }
  let _tbCache = "";
  function updateTaskBar() {
    const cc = claimableCount(), dot = $("qDot"), tb = $("taskBar");
    if (cc > 0) { dot.style.display = "grid"; dot.textContent = cc; tb.classList.add("taskpulse"); } else { dot.style.display = "none"; tb.classList.remove("taskpulse"); }
    let html, pct;
    if (cc > 0) { html = '🎁 <span class="rw">Reward ready</span> — tap to claim'; pct = 100; }
    else { const q = nextMain(); if (q) { html = `${q.t} <span class="rw">+${ab(q.rew.crystal)} 💎</span>`; pct = clamp(q.cur() / q.tgt, 0, 1) * 100; }
      else { html = "All quests done — survive & dominate"; pct = 100; } }
    if (html !== _tbCache) { $("taskTitle").innerHTML = html; _tbCache = html; }
    $("taskProg").style.width = pct + "%";
  }
  let questTab = "main";
  function renderQuests() {
    const tabDot = (cat) => { for (const q of QUESTS[cat]) if (qClaimable(cat, q)) return true;
      if (cat === "daily") for (let i = 0; i < CHESTS.length; i++) if (dailyPoints() >= CHESTS[i].p && !chestClaimed.has(i)) return true; return false; };
    const tabs = [["main", "Campaign"], ["daily", "Daily"], ["miles", "Goals"]].map(([k, lbl]) =>
      `<button class="qtab ${questTab === k ? "on" : ""}" data-qt="${k}">${lbl}${tabDot(k) ? '<span class="qdot"></span>' : ""}</button>`).join("");
    let body = "";
    if (questTab === "daily") {
      const dp = dailyPoints(), pct = clamp(dp / 100, 0, 1) * 100;
      const marks = CHESTS.map((c, i) => { const ready = dp >= c.p && !chestClaimed.has(i), got = chestClaimed.has(i);
        return `<div class="qcmark"><div class="cb2 ${ready ? "ready" : ""} ${got ? "got" : ""}" data-chest="${i}">${got ? "✓" : "🎁"}</div>${c.p}</div>`; }).join("");
      body += `<div class="qchest"><div class="qcbar"><div style="font-family:Oswald;font-weight:700;font-size:12px;margin-bottom:6px">Daily activity · ${dp}/100</div>
        <div class="qctrack"><i style="width:${pct}%"></i></div><div class="qcmarks">${marks}</div></div></div>
        <div class="scr-sub" style="margin-top:-4px">Finish daily tasks to fill the bar and pop chests. Resets every day.</div>`;
    } else body += `<div class="scr-sub">${questTab === "main" ? "Your campaign — follow it top-to-bottom to grow and unlock the game." : "Long-term flex goals with big payouts."}</div>`;
    body += QUESTS[questTab].map((q) => { const cat = questTab, cur = Math.min(q.cur(), q.tgt), pct = clamp(q.cur() / q.tgt, 0, 1) * 100;
      const cl = qClaimable(cat, q), done = claimed.has(cat + ":" + q.id);
      const btn = done ? '<button class="qbtn ok" disabled>✓</button>' : cl ? `<button class="qbtn" data-claim="${cat}:${q.id}">CLAIM</button>` : '<button class="qbtn wait" disabled>···</button>';
      return `<div class="quest ${cl ? "claimable" : ""} ${done ? "claimed" : ""}"><div class="qe">${q.e}</div>
        <div class="qmid"><div class="qn">${q.t}</div><div class="qtrack"><i style="width:${pct}%"></i></div>
        <div class="qp">${ab(cur)} / ${ab(q.tgt)} · 🎁 ${rewText(q.rew)}${q.pts ? " · +" + q.pts + "pts" : ""}</div></div>${btn}</div>`; }).join("");
    $("scrBody").innerHTML = `<div class="qtabs">${tabs}</div>${body}`;
    $("scrBody").querySelectorAll("[data-qt]").forEach((el) => el.addEventListener("click", () => { questTab = el.dataset.qt; renderQuests(); }));
    $("scrBody").querySelectorAll("[data-claim]").forEach((el) => el.addEventListener("click", () => { const p = el.dataset.claim.split(":"); claimQuest(p[0], p[1]); }));
    $("scrBody").querySelectorAll("[data-chest]").forEach((el) => el.addEventListener("click", () => claimChest(+el.dataset.chest)));
  }

  /* ============================================================
     SHEETS (building / rig / hero)
     ============================================================ */
  const bd = $("bd"), sheet = $("sheet"), sbody = $("sheetBody");
  function openSheet() { sheet.classList.add("on"); bd.classList.add("on"); }
  function closeSheet() { sheet.classList.remove("on"); closeModal(); if (!modalOpen) bd.classList.remove("on"); selected = null; }
  bd.addEventListener("click", () => { closeSheet(); closeModal(); });
  function costHTML(c) { return `<div class="costlist">${Object.keys(c).map((k) => { const lack = S[k] < c[k]; return `<span class="citem ${lack ? "lack" : ""}">${RICON[k]} ${ab(c[k])}</span>`; }).join("")}</div>`; }

  function openBuilding(id) { selected = id; if (id === "furnace") return openFurnace(); const b = byId(id); if (job && job.target === id) return openJob(id);
    const atCap = b.lv >= maxBLevel(); const c = upCost(b); const cur = prodPerSec(b), nxt = b.base * (b.lv + 1) * warmthMult() * bonuses().prodAll * (bonuses()[b.res] || 1);
    const unit = b.res && b.res !== "pop" ? RNAME[b.res] + "/s" : (b.type === "shelter" ? "crew cap" : "support");
    const icon = { hunters: "🍜", cookhouse: "🍲", sawmill: "🖧", mine: b.oreCol === "#7CFFB0" ? "🖥️" : "⚡", shelter: "🛏️", clinic: "🩹", explorers: "🛰️" }[b.type] || "🏠";
    const effRow = b.res && b.res !== "pop"
      ? `<div class="stat"><div class="k">OUTPUT</div><div class="v">${cur.toFixed(1)} <span class="ar">→</span> <span class="up">${nxt.toFixed(1)}</span></div><div class="sh-s">${unit}</div></div>`
      : `<div class="stat"><div class="k">EFFECT</div><div class="v">${b.type === "shelter" ? "+" + (b.lv * 4) + " cap" : b.type === "clinic" ? "crew morale" : "scouts alpha"}</div></div>`;
    sbody.innerHTML = `<div class="sh-head"><div class="sh-ic">${icon}</div><div><div class="sh-t">${b.name}</div><div class="sh-s">Level ${b.lv} · ${b.res && b.res !== "pop" ? "produces " + RNAME[b.res] : "support facility"}</div></div></div>
      <div class="statrow">${effRow}<div class="stat"><div class="k">LEVEL</div><div class="v">${b.lv} <span class="ar">→</span> <span class="up">${b.lv + 1}</span></div></div></div>
      <div class="costbox"><div class="ct">UPGRADE COST</div>${costHTML(c)}</div>
      ${atCap ? `<button class="bigbtn up" disabled>MAX FOR RIG LV ${S.furnace}</button><div class="note">Facilities can't exceed the <b>Rig level</b>. Overclock the Rig to unlock Lv ${S.furnace + 1}.</div>`
        : `<button class="bigbtn up" id="up" ${(!canPay(c) || job) ? "disabled" : ""}>UPGRADE TO LEVEL ${b.lv + 1}</button>${job ? '<div class="note">Builder busy with another job.</div>' : (!canPay(c) ? '<div class="note">Not enough resources yet — keep producing.</div>' : "")}`}`;
    const up = $("up"); if (up) up.addEventListener("click", () => startUpgrade(id)); openSheet(); coachFire("buildingOpened"); }
  function openFurnace() { if (job && job.target === "furnace") return openJob("furnace"); const c = furnaceCost(); const burn = CFG.energyBurnPerSec(S.furnace).toFixed(1);
    sbody.innerHTML = `<div class="sh-head"><div class="sh-ic" style="background:linear-gradient(180deg,#ff9b3d,#ff5a1a)">⛏️</div><div><div class="sh-t">The Rig</div><div class="sh-s">Level ${S.furnace} · your mining operation</div></div></div>
      <div class="statrow"><div class="stat"><div class="k">MAX FAC LV</div><div class="v">${S.furnace} <span class="ar">→</span> <span class="up">${S.furnace + 1}</span></div></div>
        <div class="stat"><div class="k">ENERGY BURN</div><div class="v">${burn}/s</div></div><div class="stat"><div class="k">UPTIME</div><div class="v">${Math.round(S.warmth)}%</div></div></div>
      <div class="costbox"><div class="ct">OVERCLOCK COST</div>${costHTML(c)}</div>
      <button class="bigbtn up" id="fup" ${(!canPay(c) || job) ? "disabled" : ""}>OVERCLOCK RIG TO LV ${S.furnace + 1}</button>
      <div class="note">Burns Energy to stay online through the bear. Overclocking unlocks <b>facility Lv ${S.furnace + 1}</b>, drops <b>+${CFG.overclockReward(S.furnace + 1)} $NIVAR</b>, and raises Net Worth.${job ? "<br>Builder busy." : ""}</div>`;
    const fup = $("fup"); if (fup) fup.addEventListener("click", startFurnace); openSheet(); coachFire("buildingOpened"); }
  function openJob(id) { const b = byId(id); const rem = Math.max(0, job.endsAt - Date.now()); const price = CFG.speedupPrice(rem);
    sbody.innerHTML = `<div class="sh-head"><div class="sh-ic">⏳</div><div><div class="sh-t">${b.name}</div><div class="sh-s">${id === "furnace" ? "Overclocking" : "Upgrading"} · ${Math.ceil(rem / 1000)}s left</div></div></div>
      <button class="bigbtn" id="su" ${S.crystal < price ? "disabled" : ""}>⚡ FINISH NOW · ${price} 💎</button><div class="note">One builder at a time — a <b>2nd builder</b> is a classic upgrade. 😉</div>`;
    const su = $("su"); if (su) su.addEventListener("click", speedUp); openSheet(); }
  function startUpgrade(id) { const b = byId(id); if (job) { toast("Builder busy", "gold"); return; } if (b.lv >= maxBLevel()) { toast("Overclock the Rig first", "gold"); return; }
    const c = upCost(b); if (!canPay(c)) { toast("Not enough resources", "gold"); return; } pay(c); const sec = buildSecs(b.lv + 1) * 1000; job = { target: id, kind: "upgrade", endsAt: Date.now() + sec, total: sec }; closeSheet(); refresh(); coachFire("upgradeStarted"); }
  function startFurnace() { if (job) { toast("Builder busy", "gold"); return; } const c = furnaceCost(); if (!canPay(c)) { toast("Not enough resources", "gold"); return; }
    pay(c); const sec = CFG.buildSecsFurnace(S.furnace, bonuses().build) * 1000; job = { target: "furnace", kind: "furnace", endsAt: Date.now() + sec, total: sec }; closeSheet(); refresh(); coachFire("upgradeStarted"); }
  function speedUp() { if (!job) return; const rem = Math.max(0, job.endsAt - Date.now()); const price = CFG.speedupPrice(rem); if (S.crystal < price) { toast("Not enough $NIVAR", "gold"); return; } S.crystal -= price; job.endsAt = Date.now(); refresh(); }
  function finishJob() { const id = job.target; if (id === "furnace") { S.furnace++; furnaceLevelUp(); } else { const b = byId(id); b.lv++; upgradedFlag = true; stats.upgrades++; dStats.upgrades++; Audio.sfx("build"); toast(b.name + " → Lv " + b.lv, "good"); floatAt(b, "LEVEL UP!"); renderScene(); }
    job = null; S.popCap = shelterPopCap(); refresh(); }
  function furnaceLevelUp() { Audio.sfx("level"); S.crystal += CFG.overclockReward(S.furnace); S.popCap = shelterPopCap(); $("luNum").textContent = S.furnace;
    const lu = $("levelup"); lu.classList.remove("go"); void lu.offsetWidth; lu.classList.add("go"); const fl = $("flash"); fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go");
    const base = w2s(FURNACE.gx, FURNACE.gy); const off = (FURNACE._top ? (isoOff(FURNACE.gx, FURNACE.gy).y - FURNACE._top.y) : 90);
    for (let k = 0; k < 46; k++) embers.push({ x: base.x, y: base.y - off, vx: Math.random() * 4 - 2, vy: -(Math.random() * 3 + .5), life: 1, r: Math.random() * 2 + 1 });
    renderScene(); toast("RIG OVERCLOCKED → LV " + S.furnace + "  ·  +" + CFG.overclockReward(S.furnace) + " 💎", "gold"); }
  function floatAt(b, text) { const p = w2s(b.gx, b.gy); const el = document.createElement("div"); el.textContent = text;
    el.style.cssText = `position:absolute;z-index:7;left:${p.x}px;top:${p.y - 70}px;transform:translate(-50%,-50%);font-family:Oswald;font-weight:700;font-size:15px;color:#ffd089;text-shadow:0 2px 6px #000;pointer-events:none;transition:all 1s ease;`;
    overlay.appendChild(el); requestAnimationFrame(() => { el.style.top = (p.y - 130) + "px"; el.style.opacity = "0"; }); setTimeout(() => el.remove(), 1000); }
  function toast(msg, cls) { const t = document.createElement("div"); t.className = "toast " + (cls || ""); t.textContent = msg; $("toasts").appendChild(t); setTimeout(() => t.remove(), 2900); }

  /* ============================================================
     SCREENS (heroes / raids / research / shop)
     ============================================================ */
  const screen = $("screen"); let curScreen = "base";
  function setNav(name) { document.querySelectorAll(".nav").forEach((n) => n.classList.toggle("active", n.dataset.nav === name)); }
  function openScreen(name) {
    Audio.sfx("click");
    if (name === "base") { curScreen = "base"; setNav("base"); screen.classList.remove("on"); return; }
    curScreen = name; setNav(name); $("scrBal").textContent = Math.floor(S.crystal).toLocaleString("en-US");
    const T = { heroes: "Heroes", raids: "Raids", research: "Research", shop: "Shop", quests: "Quests" }[name]; $("scrTitle").textContent = T;
    ({ heroes: renderHeroes, raids: renderRaids, research: renderResearch, shop: renderShop, quests: renderQuests })[name]();
    screen.classList.add("on"); coachFire("screen:" + name);
  }
  $("scrBack").addEventListener("click", () => openScreen("base"));

  function renderHeroes() {
    const owned = Object.keys(S.heroes);
    const slots = [];
    for (let i = 0; i < 5; i++) { const id = S.squad[i]; if (id) { const h = HERO(id); slots.push(`<div class="slot full" style="border-color:${RCOL[h.rarity]}"><div class="slot-art">${heroArt(h.id, h.e)}</div><span class="sl-lv">L${S.heroes[id].level}</span></div>`); }
      else slots.push(`<div class="slot">＋</div>`); }
    const cards = HEROES_POOL.map((h) => { const o = S.heroes[h.id]; const eq = S.squad.includes(h.id);
      if (!o) return `<div class="hcardx locked" style="border-color:${RCOL[h.rarity]}"><div class="he">${heroArt(h.id, h.e)}</div><div class="hn">???</div><div class="hr" style="color:${RCOL[h.rarity]}">${h.rarity}</div></div>`;
      const gemCost = CFG.heroLevelUpCrystalCost(o.level); const canUp = S.crystal >= gemCost;
      return `<div class="hcardx" style="border-color:${RCOL[h.rarity]};box-shadow:0 0 16px ${RCOL[h.rarity]}22" data-hero="${h.id}">
        <div class="hlv">Lv ${o.level}</div>${eq ? '<div class="heq">✅</div>' : ""}
        <div class="he">${heroArt(h.id, h.e)}</div><div class="hn">${h.name}</div><div class="hr" style="color:${RCOL[h.rarity]}">${h.rarity}</div>
        <div class="hpow">⚔️ ${ab(heroPower(h.id))}</div>${o.shards > 0 ? `<div class="shardtag">🧩${o.shards}</div>` : ""}
        <button class="hup ${canUp ? "" : "off"}" data-up="${h.id}">⬆ LEVEL UP · 💎${ab(gemCost)}</button></div>`; }).join("");
    $("scrBody").innerHTML = `
      <div class="squadbar"><div class="sp"><div class="k">SQUAD POWER</div><div class="v">⚔️ ${ab(squadPower())}</div></div><div class="slots">${slots.join("")}</div></div>
      <div class="btn-row"><button class="sumbtn" id="sum1">SUMMON ×1<small>💎 100</small></button><button class="sumbtn ten" id="sum10">SUMMON ×10<small>💎 900</small></button></div>
      <div class="scr-sub">Pull CT legends, then <b style="color:var(--token)">⬆ LEVEL UP</b> to raise their power. Equip up to 5 — their buffs boost your economy &amp; raids.</div>
      <div class="hgrid">${cards}</div>`;
    $("sum1").addEventListener("click", () => pull(1)); $("sum10").addEventListener("click", () => pull(10));
    $("scrBody").querySelectorAll("[data-up]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); quickLevel(el.dataset.up); }));
    $("scrBody").querySelectorAll("[data-hero]").forEach((el) => el.addEventListener("click", () => openHero(el.dataset.hero)));
  }
  function quickLevel(id) { const o = S.heroes[id]; if (!o) return; const h = HERO(id); const cost = CFG.heroLevelUpCrystalCost(o.level);
    if (S.crystal < cost) { toast("Need 💎 " + ab(cost) + " to level up", "gold"); return; }
    S.crystal -= cost; o.level++; Audio.sfx("level"); toast(h.name + " → Lv " + o.level + " ⚔️", "good"); refresh(); if (curScreen === "heroes") renderHeroes(); }
  function openHero(id) { const h = HERO(id), o = S.heroes[id]; const eq = S.squad.includes(id);
    const shardCost = CFG.heroLevelUpShardCost(o.level), gemCost = CFG.heroLevelUpCrystalCost(o.level);
    const curPow = heroPower(id), nextPow = CFG.heroPower(id, o.level + 1); const gain = nextPow - curPow;
    sbody.innerHTML = `<div class="sh-head"><div class="sh-ic sh-art" style="border-color:${RCOL[h.rarity]}">${heroArt(h.id, h.e)}</div>
      <div><div class="sh-t">${h.name}</div><div class="sh-s" style="color:${RCOL[h.rarity]}">${h.rarity.toUpperCase()} · ${h.role}</div></div></div>
      <div class="statrow"><div class="stat"><div class="k">LEVEL</div><div class="v">${o.level}</div></div>
        <div class="stat"><div class="k">POWER</div><div class="v">⚔️ ${ab(curPow)}</div></div>
        <div class="stat"><div class="k">SHARDS</div><div class="v">🧩 ${o.shards}</div></div></div>
      <div class="lvprev">Next level: ⚔️ ${ab(curPow)} <b style="color:var(--token)">→ ${ab(nextPow)}</b> <span style="color:var(--token)">(+${ab(gain)})</span></div>
      <div class="costbox"><div class="ct">PASSIVE BUFF (WHEN EQUIPPED)</div><div style="font-size:13px;color:#cfe6ff">${h.blurb}</div></div>
      <button class="bigbtn up" id="lvGem" ${S.crystal < gemCost ? "disabled" : ""}>⬆ LEVEL UP · 💎 ${ab(gemCost)}</button>
      <div class="tworow" style="margin-top:8px">
        <button class="bigbtn ${eq ? "alt" : "purple"}" id="eqBtn">${eq ? "UNEQUIP" : "EQUIP"}</button>
        <button class="bigbtn alt" id="lvShard" ${o.shards < shardCost ? "disabled" : ""}>🧩 ${shardCost}</button>
      </div>
      <div class="note">${eq ? "Equipped in your squad." : (S.squad.length >= 5 ? "Squad full (5/5) — unequip someone first." : "Equip to activate the buff and add power.")} Level up with 💎 anytime, or spend 🧩 shards from duplicate summons.</div>`;
    $("eqBtn").addEventListener("click", () => { if (eq) { S.squad = S.squad.filter((x) => x !== id); } else { if (S.squad.length >= 5) { toast("Squad full (5/5)", "gold"); return; } S.squad.push(id); }
      closeSheet(); refresh(); openScreen("heroes"); });
    function levelUp() { o.level++; Audio.sfx("level"); toast(h.name + " → Lv " + o.level, "good"); closeSheet(); refresh(); openScreen("heroes"); }
    $("lvGem").addEventListener("click", () => { if (S.crystal < gemCost) { toast("Not enough 💎", "gold"); return; } S.crystal -= gemCost; levelUp(); });
    $("lvShard").addEventListener("click", () => { if (o.shards < shardCost) { toast("Not enough shards", "gold"); return; } o.shards -= shardCost; levelUp(); });
    openSheet(); }

  /* gacha */
  function rollHero() { const rarity = CFG.rarityFromRoll(Math.random() * 100);
    const pool = HEROES_POOL.filter((h) => h.rarity === rarity); const h = rand(pool); const owned = S.heroes[h.id]; let isNew = false;
    if (!owned) { S.heroes[h.id] = { level: 1, shards: 0 }; isNew = true; if (S.squad.length < 5) S.squad.push(h.id); } else owned.shards += 1; return { h, isNew }; }
  function pull(n) { const cost = CFG.summonCost(n); if (S.crystal < cost) { toast("Not enough $NIVAR", "gold"); return; } S.crystal -= cost; summonedFlag = true; stats.summons += n; dStats.summons += n;
    const res = []; for (let i = 0; i < n; i++) res.push(rollHero()); showSummon(res); refresh(); if (curScreen === "heroes") renderHeroes(); coachFire("pulled"); }
  function showSummon(res) { Audio.sfx("summon"); const one = res.length === 1;
    const cards = res.map((x, i) => `<div class="pcard ${one ? "one" : ""}" style="border-color:${RCOL[x.h.rarity]};box-shadow:0 0 18px ${RCOL[x.h.rarity]}55;animation-delay:${i * 0.06}s">
      <div class="pe">${x.h.e}</div><div class="pn" style="color:${RCOL[x.h.rarity]}">${x.h.name}</div>${x.isNew ? '<div class="pnew">NEW!</div>' : '<div class="pdupe">+1 🧩</div>'}</div>`).join("");
    $("modalBody").innerHTML = `<div class="mcard"><div class="mtitle">SUMMON</div>
      <div class="pullgrid ${one ? "one" : ""}">${cards}</div>
      <button class="bigbtn purple" id="sumOk">TAP TO CONTINUE</button></div>`;
    $("sumOk").addEventListener("click", () => { closeModal(); if (curScreen === "heroes") renderHeroes(); });
    openModal(); }

  function renderRaids() {
    const sp = squadPower(); const eff = Math.round(sp * bonuses().raid); const now = Date.now();
    let prevCleared = true;
    const rows = STAGES.map((st, i) => { const cl = S.clears[st.id] || {}; const locked = !prevCleared; const onCd = cl.cd && now < cl.cd;
      const mlevel = cl.mlevel || 1; const epow = CFG.monsterPower(st.power, mlevel);
      const rewObj = CFG.monsterReward(st.rew, mlevel, !cl.cleared);
      const rew = Object.keys(rewObj).map((k) => `${RICON[k]}${ab(rewObj[k])}`).join("  ");
      const beatable = eff >= epow;
      let btn; if (locked) btn = `<button class="rbtn" disabled>🔒</button>`;
        else if (onCd) btn = `<button class="rbtn cd" disabled>${Math.ceil((cl.cd - now) / 1000)}s</button>`;
        else btn = `<button class="rbtn ${cl.cleared ? "cleared" : ""}" data-raid="${st.id}">${beatable ? "FIGHT" : "TRY"}</button>`;
      const html = `<div class="raid ${locked ? "locked" : ""}"><div class="re">${st.e}</div>
        <div class="rmid"><div class="rn">${st.name} <span style="color:var(--token);font-size:11px">Lv ${mlevel}</span></div>
          <div class="rsub">Power ${ab(epow)}${cl.cleared ? " · ⚔️ ×" + (mlevel - 1) + " defeated" : ""}</div><div class="rrew">${rew}</div></div>${btn}</div>`;
      prevCleared = !!cl.cleared; return html; }).join("");
    $("scrBody").innerHTML = `<div class="squadbar"><div class="sp"><div class="k">YOUR RAID POWER</div><div class="v">⚔️ ${ab(eff)}</div></div>
      <div style="font-size:11px;color:var(--muted);text-align:right;max-width:150px">Summon &amp; level heroes in <b style="color:var(--token)">Heroes</b> to beat tougher monsters</div></div>
      <div class="scr-sub">Send your squad to fight bear-market monsters. Beat one and it <b style="color:#eaf4ff">levels up</b> — stronger, but drops more $NIVAR &amp; loot. Defeat the boss to unlock the next.</div>${rows}`;
    $("scrBody").querySelectorAll("[data-raid]").forEach((el) => el.addEventListener("click", () => raid(STAGES.find((s) => s.id === el.dataset.raid))));
  }
  function raid(st) { const now = Date.now(); const cl = S.clears[st.id] || {}; if (cl.cd && now < cl.cd) { toast("On cooldown", "gold"); return; }
    const mlevel = cl.mlevel || 1; const epow = CFG.monsterPower(st.power, mlevel);
    const eff = Math.round(squadPower() * bonuses().raid); const win = eff >= epow;
    let rewards = {}, first = false;
    if (win) { first = !cl.cleared; rewards = CFG.monsterReward(st.rew, mlevel, first);
      for (const k in rewards) S[k] += rewards[k];
      S.clears[st.id] = { cleared: true, cd: now + CFG.ECON.RAID_COOLDOWN_MS, mlevel: mlevel + 1 };
      raidWonFlag = true; stats.raidWins++; dStats.raidWins++; }
    // Real-time 2D auto-battler arena (outcome is the power check above; the sim is flavor).
    const squadUnits = S.squad.map((id) => ({ e: HERO(id).e, power: heroPower(id) })).filter((u) => u.power > 0);
    const rewView = {}; for (const k in rewards) rewView[k] = { ic: RICON[k], amt: rewards[k] };
    runBattle({
      container: $("game"),
      squad: squadUnits,
      monster: { e: st.e, name: st.name, level: mlevel, power: epow, id: st.id },
      win, eff, epow, rewards: rewView,
      onDone: () => { refresh(); renderRaids(); },
      onUpgrade: () => openScreen("heroes"),
    });
    refresh(); renderRaids(); }

  // Animated squad-vs-monster battle (the outcome is the power check; this is flavor).
  function battlePop(rightSide, text, color) {
    const card = $("modalBody").querySelector(".mcard"); if (!card) return;
    const el = document.createElement("div"); el.textContent = text;
    el.style.cssText = `position:absolute;z-index:5;top:118px;${rightSide ? "right:22%" : "left:22%"};font-family:Oswald;font-weight:700;font-size:21px;color:${color};text-shadow:0 2px 8px #000;pointer-events:none;transition:all .7s ease;`;
    card.appendChild(el); requestAnimationFrame(() => { el.style.top = "68px"; el.style.opacity = "0"; }); setTimeout(() => el.remove(), 700);
  }
  function showBattle(st, win, eff, epow, first, mlevel, rewards) {
    const heroes = S.squad.map((id) => HERO(id)).filter(Boolean);
    const heroRow = (heroes.length ? heroes : [{ e: "🫥" }]).map((h) => `<div class="bhero">${h.e}</div>`).join("");
    const glow = ({ s1: "#ff6b6b", s2: "#e0a060", s3: "#b06bff", s4: "#56e0ff", s5: "#7CFFB0", s6: "#ffce54" })[st.id] || "#ff6b6b";
    $("modalBody").innerHTML = `<div class="mcard">
      <div class="mtitle">⚔️ BATTLE</div>
      <div class="bfield">
        <div class="bside"><div class="brow" id="brow">${heroRow}</div><div class="blabel">YOUR SQUAD · Lv ${squadLevel()}</div>
          <div class="bpow">⚔️ ${ab(eff)}</div><div class="bbar"><i id="hpYou" class="you"></i></div></div>
        <div class="bvsx">VS</div>
        <div class="bside"><div class="bmon" id="bmon" style="filter:drop-shadow(0 6px 16px ${glow}cc)">${st.e}</div><div class="blabel">${st.name} · Lv ${mlevel}</div>
          <div class="bpow" style="color:var(--bad)">🛡️ ${ab(epow)}</div><div class="bbar"><i id="hpFoe" class="foe"></i></div></div>
      </div>
      <div id="bresult" class="bresult"></div></div>`;
    openModal();
    if (!$("hpYou")) return;
    $("hpYou").style.width = "100%"; $("hpFoe").style.width = "100%";
    const youEnd = win ? Math.max(15, Math.round((eff - epow) / Math.max(1, eff) * 100)) : 0;
    const foeEnd = win ? 0 : Math.max(15, Math.round((epow - eff) / Math.max(1, epow) * 100));
    const rounds = 5; let round = 0;
    const iv = setInterval(() => {
      if (!modalOpen || !$("hpYou")) { clearInterval(iv); return; }
      round++;
      $("hpYou").style.width = Math.max(0, 100 - (100 - youEnd) * round / rounds) + "%";
      $("hpFoe").style.width = Math.max(0, 100 - (100 - foeEnd) * round / rounds) + "%";
      const heroAtk = round % 2 === 1; const brow = $("brow"), bmon = $("bmon");
      const atkEl = heroAtk ? brow : bmon, hitEl = heroAtk ? bmon : brow;
      if (atkEl) { atkEl.classList.remove("atk"); void atkEl.offsetWidth; atkEl.classList.add("atk"); }
      if (hitEl) { hitEl.classList.remove("hit"); void hitEl.offsetWidth; hitEl.classList.add("hit"); }
      battlePop(heroAtk, "-" + (Math.floor(Math.random() * 40) + 20), heroAtk ? "#ffd66a" : "#ff6b6b");
      Audio.sfx("click");
      if (round >= rounds) { clearInterval(iv); endBattle(); }
    }, 380);
    function endBattle() {
      const r = $("bresult"); if (!r) return; Audio.sfx(win ? "win" : "lose"); shake();
      if (win) { const rew = Object.keys(rewards).map((k) => `<div class="ri2">${RICON[k]} ${ab(rewards[k])}</div>`).join("");
        r.innerHTML = `<div class="bwin">VICTORY</div>
          <div class="bnote">${first ? "First-clear bonus ×1.5! · " : ""}${st.e} leveled up to <b>Lv ${mlevel + 1}</b> — tougher &amp; richer next time.</div>
          <div class="rewbox">${rew}</div><button class="bigbtn" id="bOk" style="margin-top:10px">COLLECT</button>`;
      } else { r.innerHTML = `<div class="blose">DEFEAT</div>
          <div class="bnote">Squad too weak (⚔️${ab(eff)} vs 🛡️${ab(epow)}). Summon &amp; level up heroes, then try again.</div>
          <button class="bigbtn alt" id="bOk" style="margin-top:10px">BACK</button>`; }
      $("bOk").addEventListener("click", closeModal);
    }
  }

  function renderResearch() {
    const rows = TECHS.map((t) => { const lv = S.research[t.id] || 0; const max = lv >= t.max; const c = scaleCost(t.cost, lv);
      const cur = `+${Math.round(t.v * lv * 100)}%`, nxt = `+${Math.round(t.v * (lv + 1) * 100)}%`;
      const cost = Object.keys(c).map((k) => `<span style="${S[k] < c[k] ? "color:var(--bad)" : ""}">${RICON[k]}${ab(c[k])}</span>`).join(" ");
      let btn = max ? `<button class="tbtn max" disabled>MAX</button>` : `<button class="tbtn" data-tech="${t.id}" ${!canPay(c) ? "disabled" : ""}>LV ${lv + 1}</button>`;
      return `<div class="tech"><div class="te">${t.e}</div><div class="tmid"><div class="tn">${t.name}</div>
        <div class="tef">${t.k === "build" ? "-" : "+"}${Math.round(t.v * 100)}% ${techLabel(t.k)} · now ${cur}${max ? "" : " → " + nxt}</div>
        <div class="tco">${max ? "Maxed out" : cost}</div></div>${btn}</div>`; }).join("");
    $("scrBody").innerHTML = `<div class="scr-sub">Permanent upgrades that boost your whole operation. Stacks with hero buffs.</div>${rows}`;
    $("scrBody").querySelectorAll("[data-tech]").forEach((el) => el.addEventListener("click", () => research(el.dataset.tech)));
  }
  function techLabel(k) { return CFG.techLabel(k); }
  function scaleCost(base, lv) { return CFG.scaleCost(base, lv); }
  function research(id) { const t = TECHS.find((x) => x.id === id); const lv = S.research[id] || 0; if (lv >= t.max) return; const c = scaleCost(t.cost, lv);
    if (!canPay(c)) { toast("Not enough resources", "gold"); return; } pay(c); S.research[id] = lv + 1; toast(t.name + " → Lv " + (lv + 1), "good"); refresh(); renderResearch(); }

  function renderShop() {
    const now = Date.now(); const airdropReady = now >= airdropAt;
    $("scrBody").innerHTML = `<div class="scr-sub">Boost your run. (On-chain $NIVAR purchases connect to your wallet in the production build.)</div>
      <div class="shopcard"><div class="se">🎁</div><div class="smid"><div class="sn">Genesis Pack</div><div class="sd">One-time: 1,000 💎 + a guaranteed Epic hero. For early survivors.</div></div>
        <button class="sbtn" id="genBtn" ${genesisClaimed ? "disabled" : ""}>${genesisClaimed ? "CLAIMED" : "CLAIM"}</button></div>
      <div class="shopcard" style="border-color:rgba(124,255,176,.35)"><div class="se">🪂</div><div class="smid"><div class="sn">Daily Airdrop</div><div class="sd">Free 250 💎 every few minutes. Just for showing up.</div></div>
        <button class="sbtn" id="airBtn" ${airdropReady ? "" : "disabled"} style="${airdropReady ? "background:linear-gradient(180deg,#7CFFB0,#36c98a)" : ""}">${airdropReady ? "CLAIM" : "SOON"}</button></div>
      <div class="shopcard"><div class="se">💎</div><div class="smid"><div class="sn">$NIVAR · 6,000</div><div class="sd">Top up your treasury to summon & speed up builds.</div></div>
        <button class="sbtn" id="buyBtn">$4.99</button></div>
      <div class="shopcard"><div class="se">🐳</div><div class="smid"><div class="sn">Whale Bundle</div><div class="sd">25,000 💎 + 10× summon + 3-day x2 mining boost.</div></div>
        <button class="sbtn" id="buyBtn2">$19.99</button></div>`;
    const gen = $("genBtn"); if (gen) gen.addEventListener("click", () => { if (genesisClaimed) return; genesisClaimed = true; S.crystal += CFG.ECON.GENESIS_CRYSTAL;
      // guaranteed epic
      const epics = HEROES_POOL.filter((h) => h.rarity === "epic" && !S.heroes[h.id]); const h = epics.length ? rand(epics) : rand(HEROES_POOL.filter((x) => x.rarity === "epic"));
      if (!S.heroes[h.id]) { S.heroes[h.id] = { level: 1, shards: 0 }; if (S.squad.length < 5) S.squad.push(h.id); } else S.heroes[h.id].shards += 3;
      toast("Genesis Pack claimed · +1,000 💎 + " + h.name, "gold"); refresh(); renderShop(); });
    const air = $("airBtn"); if (air) air.addEventListener("click", () => { if (Date.now() < airdropAt) return; S.crystal += CFG.ECON.AIRDROP_AMOUNT; dStats.airdrop = true; airdropAt = Date.now() + CFG.ECON.AIRDROP_COOLDOWN_MS; toast("Airdrop claimed · +250 💎", "good"); refresh(); renderShop(); });
    $("buyBtn").addEventListener("click", () => toast("Connect wallet — coming in production", "gold"));
    $("buyBtn2").addEventListener("click", () => toast("Connect wallet — coming in production", "gold"));
  }

  /* centered modal */
  const modal = $("modal"); let modalOpen = false;
  function openModal() { modal.classList.add("on"); bd.classList.add("on"); modalOpen = true; }
  function closeModal() { modal.classList.remove("on"); modalOpen = false; if (!sheet.classList.contains("on")) bd.classList.remove("on"); if (coachOn) coachLayout(); }

  /* ============================================================
     SIM
     ============================================================ */
  let storm = 248;
  function tick(dt) {
    storm -= dt; if (storm <= 0) storm = 200 + Math.random() * 120;
    const target = CFG.warmthTarget(S.coal); S.warmth += (target - S.warmth) * Math.min(1, dt * CFG.ECON.WARMTH_TWEEN_RATE);
    if (S.coal > 0) S.coal = Math.max(0, S.coal - CFG.energyBurnPerSec(S.furnace) * dt);
    const m = warmthMult(); const B = bonuses(); const boost = prodBoost();
    for (const b of BUILDINGS) { if (b.res && b.res !== "pop") S[b.res] += CFG.prodPerSec(b, b.lv, S.warmth, B) * dt * boost; }
    S.crystal += CFG.ECON.CRYSTAL_TRICKLE_PER_LAB * byId("explorers").lv * dt * B.token * boost;
    S.popCap = shelterPopCap(); if (S.pop < S.popCap) S.pop = Math.min(S.popCap, S.pop + dt * CFG.ECON.POP_GROWTH_RATE);
    if (job && Date.now() >= job.endsAt) finishJob();
    power = calcPower(); updateTaskBar();
  }
  function refresh() { power = calcPower(); renderHUD(); refreshOverlay(); updateTaskBar(); if (screen.classList.contains("on")) $("scrBal").textContent = Math.floor(S.crystal).toLocaleString("en-US"); }
  let last = performance.now(), acc = 0;
  function frame(now) { const rdt = Math.min(.25, (now - last) / 1000); last = now; acc += rdt; while (acc >= 0.1) { tick(0.1); acc -= 0.1; }
    for (const r of ["food", "wood", "coal", "iron", "crystal"]) disp[r] += (S[r] - disp[r]) * 0.2; disp.power += (power - disp.power) * 0.12; disp.warmth += (S.warmth - disp.warmth) * 0.15;
    $("stormTime").textContent = fmtT(storm); renderHUD(); refreshOverlay(); updateTaskBar();
    ctx.clearRect(0, 0, VW, VH); ctx.drawImage(scene, 0, 0, scene.width, scene.height, cam.x, cam.y, OW, OH); drawLive(now);
    _raf = requestAnimationFrame(frame); }
  function fmtT(s) { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60), ss = s % 60; return (m < 10 ? "0" : "") + m + ":" + (ss < 10 ? "0" : "") + ss; }

  /* ============================================================
     PAN + WIRING
     ============================================================ */
  let drag = null; const game = $("game");
  game.addEventListener("pointerdown", (e) => { if (e.target.closest(".hud,.bspot,.left-cards,.right-rail,.task-bar,.bottom-nav,#sheet,#screen,#modal,.hintdrag,.collectible,.boost-fab,.battle-arena")) return;
    drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; game.setPointerCapture(e.pointerId); $("hint").style.opacity = "0"; });
  game.addEventListener("pointermove", (e) => { if (!drag) return; cam.x = clamp(drag.cx + (e.clientX - drag.x), panMin.x, panMax.x); cam.y = clamp(drag.cy + (e.clientY - drag.y), panMin.y, panMax.y); positionOverlays(); });
  game.addEventListener("pointerup", () => (drag = null)); game.addEventListener("pointercancel", () => (drag = null));

  document.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => openScreen(b.dataset.nav)));
  document.querySelectorAll(".rr[data-ev]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.ev === "Genesis Pack" || b.dataset.ev === "Daily Airdrop") openScreen("shop"); else toast(b.dataset.ev + " — soon", "gold"); }));
  $("mailBtn").addEventListener("click", () => toast("gm. No new mail, ser", "good"));
  $("taskBar").addEventListener("click", (e) => { if (e.target.closest("#mailBtn")) return; openScreen("quests"); });
  _onResize = () => { fit(); initFlakes(); if (coachOn) coachLayout(); };
  window.addEventListener("resize", _onResize);
  // start procedural music on the first user gesture (autoplay policy); idempotent
  document.addEventListener("pointerdown", () => Audio.start());

  /* ---- coach / onboarding ---- */
  function navEl(n) { return document.querySelector('.nav[data-nav="' + n + '"]'); }
  const COACH = [
    { type: "modal", title: "Welcome to NIVAR ❄️",
      body: "It's crypto winter. Your facilities mine resources <b>automatically</b> — spend them to upgrade, summon heroes, and raid the bear market to stack $NIVAR. Survive until the bull returns.",
      cta: "LET'S GO →" },
    { type: "spot", target: () => $("taskBar"), title: "Your goal, always here",
      body: "This shows your next objective. Tap it anytime to open all <b>Quests</b> and claim 💎 rewards.", advance: "next" },
    { type: "spot", target: () => spots["cookhouse"], title: "1 · Upgrade a facility",
      body: "Tap the Mess Hall (or any building) to open it.", advance: "buildingOpened" },
    { type: "spot", target: () => $("up") || $("fup"), title: "Spend & level up",
      body: "Hit upgrade. Higher level = more production.", advance: "upgradeStarted" },
    { type: "spot", target: () => navEl("heroes"), title: "2 · Summon heroes",
      body: "Now tap Heroes to recruit your first CT legend.", advance: "screen:heroes" },
    { type: "spot", target: () => $("sum1"), title: "Pull a hero",
      body: "Summon ×1. Equip up to 5 — their buffs power your economy and raids.", advance: "pulled" },
    { type: "spot", target: () => navEl("raids"), title: "3 · Raid the bear",
      body: "Tap Raids and deploy your squad against bear-market events for loot.", advance: "screen:raids" },
    { type: "modal", title: "You're ready 🐻",
      body: "The loop: <b>Upgrade → Summon → Raid → grow Net Worth.</b> Tap the goal bar for your full <b>Quests</b> list and claim rewards. Keep your Rig fueled so Sentiment doesn't crash. GLHF, ser.",
      cta: "START PLAYING" },
  ];
  function coachStart() { coachStep = 0; coachRender(); }
  function coachRender() {
    const s = COACH[coachStep]; if (!s) return coachEnd();
    coachOn = true; $("coach").classList.add("on");
    const dim = $("coachDim"), spot = $("spot"), finger = $("finger"), cap = $("cap"); cap.style.display = "block";
    if (s.type === "modal") {
      dim.style.display = "block"; spot.style.display = "none"; finger.style.display = "none"; cap.classList.add("center");
      cap.innerHTML = '<div class="ct">' + s.title + '</div><div class="cb">' + s.body + "</div>" +
        '<div class="cnext"><span class="cskip" id="capSkip">Skip</span><button class="cbtn" id="capCta">' + (s.cta || "NEXT") + "</button></div>";
      cap.style.width = Math.min(310, window.innerWidth - 32) + "px"; cap.style.left = "50%"; cap.style.top = "50%"; cap.style.bottom = "auto"; cap.style.transform = "translate(-50%,-50%)";
    } else {
      dim.style.display = "none"; cap.classList.remove("center"); cap.style.transform = "none";
      const hint = s.advance === "next" ? '<button class="cbtn" id="capCta">NEXT</button>' : '<span style="font-size:11px;color:var(--token);font-weight:700">👆 do it to continue</span>';
      cap.innerHTML = '<div class="ct">' + s.title + '</div><div class="cb">' + s.body + "</div>" +
        '<div class="cnext"><span class="cskip" id="capSkip">Skip tutorial</span>' + hint + "</div>";
      coachLayout();
    }
    const cta = $("capCta"); if (cta) cta.addEventListener("click", coachNext);
    const sk = $("capSkip"); if (sk) sk.addEventListener("click", coachEnd);
  }
  function coachLayout() {
    if (!coachOn) return; const s = COACH[coachStep]; if (!s || s.type !== "spot") return;
    const spot = $("spot"), finger = $("finger"), cap = $("cap");
    if (modalOpen) { spot.style.display = "none"; finger.style.display = "none"; cap.style.display = "none"; return; }
    cap.style.display = "block";
    let el = null; try { el = s.target && s.target(); } catch (e) {}
    if (!el || !el.getBoundingClientRect) { spot.style.display = "none"; finger.style.display = "none";
      cap.style.left = "50%"; cap.style.transform = "translateX(-50%)"; cap.style.top = "auto"; cap.style.bottom = "100px"; cap.style.width = Math.min(280, window.innerWidth - 24) + "px"; return; }
    const r = el.getBoundingClientRect(), pad = 7;
    spot.style.display = "block"; spot.style.left = (r.left - pad) + "px"; spot.style.top = (r.top - pad) + "px"; spot.style.width = (r.width + pad * 2) + "px"; spot.style.height = (r.height + pad * 2) + "px";
    const capW = Math.min(260, window.innerWidth - 24); cap.style.width = capW + "px"; cap.style.transform = "none";
    cap.style.left = clamp(r.left + r.width / 2 - capW / 2, 12, window.innerWidth - capW - 12) + "px";
    finger.style.display = "block"; finger.style.left = (r.left + r.width / 2 - 15) + "px";
    if (r.bottom + 150 < window.innerHeight) { cap.style.top = (r.bottom + 50) + "px"; cap.style.bottom = "auto"; finger.style.top = (r.bottom + 4) + "px"; finger.textContent = "👆"; }
    else { cap.style.top = "auto"; cap.style.bottom = (window.innerHeight - r.top + 48) + "px"; finger.style.top = (r.top - 38) + "px"; finger.textContent = "👇"; }
  }
  function coachNext() { coachStep++; if (coachStep >= COACH.length) return coachEnd(); coachRender(); }
  function coachFire(tr) { if (!coachOn) return; const s = COACH[coachStep]; if (s && s.advance === tr) coachNext(); }
  function coachEnd() { coachOn = false; $("coach").classList.remove("on"); ["coachDim", "spot", "finger", "cap"].forEach((id) => ($(id).style.display = "none")); }
  _intervals.push(setInterval(() => { if (coachOn) coachLayout(); }, 250));
  $("helpRail").addEventListener("click", coachStart);

  /* tap-to-learn on resource chips */
  const REXP = { "r-coal": "Energy ⚡ fuels your Rig to stay online. Made by the Power Plant.",
    "r-iron": "Compute 🖥️ is your mining hashpower. Made by the GPU Foundry.",
    "r-wood": "Bandwidth 📡 is your infra. Made by the Server Farm.",
    "r-food": "Ramen 🍜 feeds your crew. Made by the Ramen Shop & Mess Hall." };
  document.querySelectorAll(".rchip").forEach((ch) => { const b = ch.querySelector("b"); if (b) ch.addEventListener("click", () => toast(REXP[b.id] || "")); });
  const gemChip = $("gemVal").closest(".chip"); if (gemChip) gemChip.addEventListener("click", () => toast("$NIVAR 💎 — premium currency. Summon heroes & speed up builds.", "gold"));
  const powChip = $("powVal").closest(".chip"); if (powChip) powChip.addEventListener("click", () => toast("Net Worth 💰 — your overall power. Grows with upgrades, heroes & research.", "gold"));
  const tempChip = document.querySelector(".temp"); if (tempChip) tempChip.addEventListener("click", () => { const t = tempLabel(); toast("Sentiment " + t[0] + " (" + t[2] + ") — keep your Rig fueled to avoid Extreme Fear.", "gold"); });

  /* ============================================================
     ENGAGEMENT — active boost, tappable loot, offline earnings, juice
     ============================================================ */
  let boostUntil = 0, boostCdUntil = 0;
  function boostActive() { return Date.now() < boostUntil; }
  function prodBoost() { return boostActive() ? CFG.ECON.BOOST_MULT : 1; }

  function shake() { game.classList.remove("shakefx"); void game.offsetWidth; game.classList.add("shakefx"); setTimeout(() => game.classList.remove("shakefx"), 380); }
  function popAt(x, y, text, color) { const el = document.createElement("div"); el.textContent = text;
    el.style.cssText = `position:absolute;z-index:8;left:${x}px;top:${y}px;transform:translate(-50%,-50%);font-family:Oswald;font-weight:700;font-size:19px;color:${color || "#ffd089"};text-shadow:0 2px 8px #000;pointer-events:none;transition:all 1s ease;`;
    overlay.appendChild(el); requestAnimationFrame(() => { el.style.top = (y - 62) + "px"; el.style.opacity = "0"; }); setTimeout(() => el.remove(), 1000); }
  function burst(x, y, n, col) { for (let k = 0; k < (n || 14); k++) embers.push({ x, y, vx: Math.random() * 4 - 2, vy: -(Math.random() * 3 + .5), life: 1, r: Math.random() * 2 + 1, c: col }); }

  // Boost FAB — tap for 2× production (duration + cooldown from config)
  const boostFab = document.createElement("button");
  boostFab.className = "boost-fab"; boostFab.innerHTML = `<span class="bi">⚡</span><span class="bl">BOOST</span>`;
  boostFab.addEventListener("click", (e) => { e.stopPropagation(); const now = Date.now();
    if (now < boostCdUntil) { toast("Boost recharging…", "gold"); return; }
    boostUntil = now + CFG.ECON.BOOST_DURATION_MS; boostCdUntil = boostUntil + CFG.ECON.BOOST_COOLDOWN_MS;
    shake(); juiceClaim(); Audio.sfx("boost"); const ft = w2s(FURNACE.gx, FURNACE.gy); burst(ft.x, ft.y - 40, 34, "#ffd66a");
    toast("⚡ OVERDRIVE — 2× production!", "gold"); });
  game.appendChild(boostFab);
  function updateBoostFab() { const now = Date.now();
    if (now < boostUntil) { boostFab.className = "boost-fab on"; boostFab.querySelector(".bl").textContent = Math.ceil((boostUntil - now) / 1000) + "s"; }
    else if (now < boostCdUntil) { boostFab.className = "boost-fab cd"; boostFab.querySelector(".bl").textContent = Math.ceil((boostCdUntil - now) / 1000) + "s"; }
    else { boostFab.className = "boost-fab"; boostFab.querySelector(".bl").textContent = "BOOST"; } }

  // Tappable loot that drops on the base
  const COLL = [
    { ic: "💎", res: "crystal", min: 12, max: 34, col: "#7CFFB0" },
    { ic: "⚡", res: "coal", min: 500, max: 1500, col: "#ffd24d" },
    { ic: "🖥️", res: "iron", min: 300, max: 1000, col: "#7CFFB0" },
    { ic: "📡", res: "wood", min: 600, max: 1700, col: "#56e0ff" },
    { ic: "🍜", res: "food", min: 600, max: 1700, col: "#ff8a3d" },
  ];
  let collCount = 0;
  function spawnCollectible() {
    if (document.hidden || collCount >= 3 || screen.classList.contains("on") || modalOpen) return;
    const c = rand(COLL); const amt = c.min + Math.floor(Math.random() * (c.max - c.min));
    const cx = VW * 0.5 + (Math.random() * 220 - 110), cy = VH * 0.44 + (Math.random() * 170 - 85);
    const el = document.createElement("button"); el.className = "collectible"; el.textContent = c.ic;
    el.style.left = cx + "px"; el.style.top = cy + "px"; collCount++;
    let taken = false;
    const take = () => { if (taken) return; taken = true; S[c.res] += amt; Audio.sfx("coin");
      popAt(cx, cy, "+" + ab(amt) + " " + c.ic, c.col); burst(cx, cy, 16, c.col);
      if (c.res === "crystal") juiceClaim(); el.remove(); collCount--; refresh(); };
    el.addEventListener("click", (e) => { e.stopPropagation(); take(); });
    overlay.appendChild(el);
    setTimeout(() => { if (!taken) { el.remove(); collCount--; } }, 8000);
  }

  // Offline earnings ("welcome back")
  const LAST_KEY = "nivar_lastVisit";
  function saveVisit() { try { localStorage.setItem(LAST_KEY, "" + Date.now()); } catch (e) {} }
  function offlineEarnings() {
    let last = 0; try { last = parseInt(localStorage.getItem(LAST_KEY) || "0"); } catch (e) {}
    const now = Date.now(); if (!last || now - last < 60000) return;
    const dt = Math.min((now - last) / 1000, CFG.ECON.OFFLINE_CAP_MS / 1000); const B = bonuses();
    const earned = { food: 0, wood: 0, coal: 0, iron: 0, crystal: 0 };
    for (const b of BUILDINGS) { if (b.res && b.res !== "pop") earned[b.res] += CFG.prodPerSec(b, b.lv, S.warmth, B) * dt; }
    earned.crystal += CFG.ECON.CRYSTAL_TRICKLE_PER_LAB * byId("explorers").lv * dt * B.token;
    for (const k in earned) { earned[k] = Math.floor(earned[k]); S[k] += earned[k]; }
    const h = Math.floor(dt / 3600), mm = Math.floor((dt % 3600) / 60); const away = (h ? h + "h " : "") + mm + "m";
    const rows = Object.keys(earned).filter((k) => earned[k] > 0).map((k) => `<div class="ri2">${RICON[k]} ${ab(earned[k])}</div>`).join("");
    $("modalBody").innerHTML = `<div class="mcard"><div class="mtitle" style="color:var(--token)">WELCOME BACK</div>
      <div style="text-align:center;font-size:12.5px;color:var(--muted);margin:6px 0 2px">Your rigs kept mining for <b style="color:#eaf4ff">${away}</b> while you were away</div>
      <div class="rewbox">${rows || '<div class="ri2">—</div>'}</div>
      <button class="bigbtn" id="obOk" style="margin-top:12px">COLLECT</button></div>`;
    $("obOk").addEventListener("click", () => { closeModal(); shake(); }); openModal(); refresh();
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveVisit(); });

  /* boot */
  for (const id in CFG.INITIAL_HEROES) S.heroes[id] = { ...CFG.INITIAL_HEROES[id] };
  S.squad = [...CFG.INITIAL_SQUAD];
  buildOverlay(); fit(); initFlakes(); S.popCap = shelterPopCap(); power = calcPower(); refresh(); updateTaskBar(); _raf = requestAnimationFrame(frame);
  _timeouts.push(setTimeout(() => { $("hint").style.opacity = "0"; }, 6000));
  let _firstVisit = true; try { _firstVisit = !localStorage.getItem(LAST_KEY); } catch (e) {}
  if (_firstVisit) {
    _timeouts.push(setTimeout(coachStart, 450));
    _timeouts.push(setTimeout(() => toast("gm Operator. Survive the winter, stack $NIVAR.", "gold"), 500));
  } else {
    _timeouts.push(setTimeout(offlineEarnings, 500));
    _timeouts.push(setTimeout(() => toast("Welcome back, Operator.", "good"), 800));
  }
  saveVisit();
  _intervals.push(setInterval(saveVisit, 5000));
  _intervals.push(setInterval(updateBoostFab, 250));
  _intervals.push(setInterval(spawnCollectible, 13000));
  _timeouts.push(setTimeout(spawnCollectible, 3500));
  _intervals.push(setInterval(() => { if (curScreen === "raids") { const now = Date.now(); if (Object.values(S.clears).some((c) => c.cd && now < c.cd)) renderRaids(); } }, 1000));

  /* cleanup for React unmount / fast-refresh */
  return function dispose() {
    cancelAnimationFrame(_raf);
    for (const i of _intervals) clearInterval(i);
    for (const t of _timeouts) clearTimeout(t);
    if (_onResize) window.removeEventListener("resize", _onResize);
  };
}
