"use client";

import { useEffect, useRef } from "react";
import { initGame } from "./engine";

/**
 * The prototype's exact DOM, injected verbatim. The ported engine (engine.ts)
 * owns everything inside imperatively — canvas, overlays, sheets, modals — just
 * like nivar.html. Using the raw markup guarantees byte-identical structure
 * (no JSX transcription drift). React renders it once and never reconciles it.
 */
const GAME_MARKUP = `
<div id="game">
  <canvas id="world"></canvas>
  <div id="overlay"></div>
  <div class="hintdrag" id="hint">✋ Drag to look around · tap a facility to upgrade</div>

  <!-- TOP HUD -->
  <div class="hud hud-top">
    <div class="row">
      <div class="avatar"><div class="face">🧑‍💻</div><div><div class="lvtxt">Operator · Lv 12</div><div class="xp"><i></i></div></div></div>
      <div class="grow"></div>
      <div class="chip build"><span class="ic">🔧</span><b id="buildTimer">Idle</b></div>
      <div class="chip"><span class="ic">🧑‍🤝‍🧑</span><b id="popVal">8/12</b></div>
      <div class="chip gem"><span class="ic">💎</span><b id="gemVal">1,258</b><i class="plus">＋</i></div>
    </div>
    <div class="row">
      <div class="chip power"><span class="ic">💰</span><b id="powVal">0</b></div>
      <div class="grow"></div>
      <div class="temp"><span class="ic" id="sentEmo">😨</span><b id="sentVal">35</b><span class="sub" id="sentLbl">Fear</span></div>
      <div class="vip"><span class="v">🐳</span>Whale 1</div>
    </div>
    <div class="res-strip">
      <div class="rchip"><span class="ic">⚡</span><b id="r-coal">0</b></div>
      <div class="rchip"><span class="ic">🖥️</span><b id="r-iron">0</b></div>
      <div class="rchip"><span class="ic">📡</span><b id="r-wood">0</b></div>
      <div class="rchip"><span class="ic">🍜</span><b id="r-food">0</b></div>
    </div>
  </div>

  <div class="left-cards">
    <div class="wcard"><span class="wi">🐻</span><div><div class="wt">Bear market ongoing</div><div class="wtime" id="stormTime">04:08</div></div></div>
    <div class="hcard" id="squadMini"></div>
  </div>

  <div class="right-rail">
    <button class="rr" data-ev="Genesis Pack"><div class="ri">🎁</div><div class="rl">Genesis</div></button>
    <button class="rr" data-ev="Daily Airdrop"><div class="ri">🪂</div><div class="rl">Airdrop</div></button>
    <button class="rr" data-nav="raids"><div class="ri">⚔️</div><div class="rl">Raids</div></button>
    <button class="rr help" id="helpRail"><div class="ri">❔</div><div class="rl">Help</div></button>
  </div>

  <div class="task-bar" id="taskBar">
    <div class="ti">🎯<span class="tdot" id="qDot" style="display:none"></span></div>
    <div class="tmid"><div class="tlabel">NEXT GOAL</div><div class="tt" id="taskTitle">—</div><div class="ttrack"><i id="taskProg"></i></div></div>
    <button class="tmail" id="mailBtn">✉️<span class="dot">1</span></button>
  </div>

  <div class="bottom-nav">
    <button class="nav" data-nav="raids"><span class="ni">⚔️</span>Raids</button>
    <button class="nav" data-nav="heroes"><span class="ni">🦸</span>Heroes<span class="ndot" id="heroDot" style="display:none"></span></button>
    <button class="nav" data-nav="research"><span class="ni">🔬</span>Research</button>
    <button class="nav" data-nav="shop"><span class="ni">🛒</span>Shop</button>
    <button class="nav active" data-nav="base"><span class="ni">🗺️</span>Base</button>
  </div>

  <!-- full-screen page -->
  <div id="screen">
    <div class="scr-head">
      <button class="scr-back" id="scrBack">‹</button>
      <div class="scr-title" id="scrTitle">Heroes</div>
      <div class="scr-bal">💎 <span id="scrBal">0</span></div>
    </div>
    <div class="scr-body" id="scrBody"></div>
  </div>
</div>

<div id="bd"></div>
<div id="sheet"><div class="grab"></div><div id="sheetBody"></div></div>
<div id="modal"><div id="modalBody"></div></div>
<div id="coach"><div id="coachDim"></div><div id="spot"></div><div id="finger" class="coach-finger">👆</div><div id="cap" class="coach-cap"></div></div>
<div id="toasts"></div>
<div id="flash"></div>
<div class="levelup" id="levelup"><div class="l1">RIG OVERCLOCK</div><div class="l2" id="luNum">2</div></div>
`;

export default function Game() {
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return; // guard React StrictMode double-invoke
    booted.current = true;
    const dispose = initGame();
    return () => {
      if (dispose) dispose();
      booted.current = false;
    };
  }, []);

  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: GAME_MARKUP }} />;
}
