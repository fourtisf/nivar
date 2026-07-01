/* ============================================================
   NIVAR — full-body chibi character art for each hero.
   Vector (SVG) so it scales crisply in cards, squad slots and the
   hero sheet. One recognisable character per CT archetype — no more
   bare item emojis (casino / pickaxe / briefcase) standing in for heroes.
   ============================================================ */

// Shared chibi frame: shadow, legs, arms, gradient torso, head. `extra`
// layers the per-hero face + headgear + props on top.
function fig(id: string, bL: string, bD: string, skin: string, extra: string, chest = ""): string {
  return `<svg viewBox="0 0 100 128" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
  <defs><linearGradient id="b_${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bL}"/><stop offset="1" stop-color="${bD}"/></linearGradient></defs>
  <ellipse cx="50" cy="123" rx="29" ry="6" fill="#000" opacity=".22"/>
  <rect x="37" y="94" width="11" height="25" rx="5" fill="${bD}"/>
  <rect x="52" y="94" width="11" height="25" rx="5" fill="${bD}"/>
  <rect x="21" y="60" width="12" height="33" rx="6" fill="${bD}"/>
  <rect x="67" y="60" width="12" height="33" rx="6" fill="${bD}"/>
  <path d="M28 64 Q28 53 50 53 Q72 53 72 64 L72 98 Q72 104 65 104 L35 104 Q28 104 28 98 Z" fill="url(#b_${id})"/>
  ${chest}
  <circle cx="50" cy="36" r="23" fill="${skin}"/>
  ${extra}
</svg>`;
}
const EYES = (c = "#14202a") => `<circle cx="42" cy="36" r="3.4" fill="${c}"/><circle cx="58" cy="36" r="3.4" fill="${c}"/><circle cx="43.2" cy="35" r="1.1" fill="#fff"/><circle cx="59.2" cy="35" r="1.1" fill="#fff"/>`;
const SMILE = `<path d="M43 45 Q50 51 57 45" stroke="#14202a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;

export const HERO_ART: Record<string, string> = {
  // Legendary — blue whale mogul: shades + gold chain + spout
  whale: fig("whale", "#4a8fe0", "#2a5aa8", "#5fa2e6",
    `<path d="M50 14 q-5 -13 3 -13 q8 0 3 13" fill="#bfe4ff" opacity=".85"/>
     <rect x="35" y="32" width="30" height="9" rx="4.5" fill="#0e1a26"/>
     <circle cx="43" cy="36.5" r="5" fill="#101a26" stroke="#ffce54" stroke-width="1.6"/>
     <circle cx="57" cy="36.5" r="5" fill="#101a26" stroke="#ffce54" stroke-width="1.6"/>
     <path d="M43 47 q7 5 14 0" stroke="#0e2033" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    `<path d="M40 60 q10 7 20 0" stroke="#ffce54" stroke-width="2.6" fill="none"/><circle cx="50" cy="67" r="3.4" fill="#ffce54"/>`),

  // Epic — VC in a suit with a briefcase
  vc: fig("vc", "#33415e", "#212a41", "#f0c79a",
    `<path d="M34 20 Q50 6 66 20 Q60 12 50 12 Q40 12 34 20" fill="#2a2f3a"/>
     ${EYES()}
     <path d="M44 46 h12" stroke="#14202a" stroke-width="2.2" stroke-linecap="round"/>`,
    `<path d="M44 54 L50 70 L56 54 Z" fill="#f4f7fb"/><path d="M48 56 L50 74 L52 56 Z" fill="#c23b3b"/>
     <rect x="70" y="82" width="20" height="15" rx="2.5" fill="#7a4a22"/><rect x="70" y="82" width="20" height="4" fill="#5e3818"/><rect x="77" y="80" width="6" height="4" rx="1.5" fill="#5e3818"/>`),

  // Epic — hoodie Dev with cyan glasses + laptop glow
  dev: fig("dev", "#2c3b4c", "#1b2733", "#cf9e6f",
    `<path d="M26 40 Q26 8 50 8 Q74 8 74 40 Q74 20 50 20 Q26 20 26 40" fill="#1b2733"/>
     <rect x="37" y="32" width="12" height="9" rx="2.5" fill="#0e1a26" stroke="#56e0ff" stroke-width="1.4"/>
     <rect x="51" y="32" width="12" height="9" rx="2.5" fill="#0e1a26" stroke="#56e0ff" stroke-width="1.4"/>
     <rect x="49" y="35" width="2" height="2" fill="#56e0ff"/>
     <path d="M44 47 h12" stroke="#14202a" stroke-width="2.2" stroke-linecap="round"/>`,
    `<rect x="34" y="92" width="32" height="5" rx="2" fill="#56e0ff" opacity=".6"/>`),

  // Epic — KOL shouting into a megaphone
  kol: fig("kol", "#ff9b3d", "#dd6f1a", "#f0c79a",
    `<path d="M30 22 Q50 8 70 22 Q64 14 50 14 Q36 14 30 22" fill="#3a2f2a"/>
     ${EYES()}
     <ellipse cx="52" cy="47" rx="5" ry="4" fill="#7a1f2a"/>`,
    `<path d="M64 70 L86 60 L86 88 L64 78 Z" fill="#e9edf2"/><rect x="60" y="70" width="6" height="8" rx="2" fill="#9aa6b2"/><path d="M88 66 h6 M89 74 h7 M88 82 h6" stroke="#ffce54" stroke-width="2" stroke-linecap="round"/>`),

  // Rare — Degen: backwards cap, $ eyes, dice
  degen: fig("degen", "#36c98a", "#22a06a", "#eec69a",
    `<path d="M27 30 Q27 8 50 8 Q73 8 73 30 L73 28 Q73 16 50 16 Q27 16 27 30" fill="#159e63"/>
     <rect x="23" y="24" width="16" height="8" rx="3" fill="#0f7a4c"/>
     <text x="42" y="40" font-size="10" text-anchor="middle" fill="#159e63" font-weight="900" font-family="Arial">$</text>
     <text x="58" y="40" font-size="10" text-anchor="middle" fill="#159e63" font-weight="900" font-family="Arial">$</text>
     <path d="M42 47 q8 6 16 0 q-6 3 -16 0" fill="#14202a"/>`,
    `<rect x="66" y="78" width="17" height="17" rx="4" fill="#fff" transform="rotate(14 74 86)"/><circle cx="71" cy="83" r="1.8" fill="#111"/><circle cx="78" cy="89" r="1.8" fill="#111"/>`),

  // Rare — Maxi: crystal-armoured hodler with a diamond crest
  maxi: fig("maxi", "#a06bff", "#7638d4", "#e6d2ff",
    `<polygon points="50,6 62,16 50,22 38,16" fill="#c79bff"/><polygon points="38,16 50,22 50,22 38,16" fill="#8a4de0"/>
     ${EYES()}
     ${SMILE}`,
    `<polygon points="50,60 58,67 50,80 42,67" fill="#d9c2ff"/><polygon points="50,60 58,67 50,70 42,67" fill="#fff" opacity=".8"/>`),

  // Rare — Quant: robot with a visor and antenna
  quant: fig("quant", "#5d6f83", "#3a4756", "#6a7d92",
    `<rect x="47" y="6" width="6" height="9" rx="3" fill="#7dd3fc"/><circle cx="50" cy="5" r="4" fill="#7CFFB0"/>
     <rect x="34" y="30" width="32" height="14" rx="6" fill="#0b1620"/>
     <circle cx="43" cy="37" r="4" fill="#56e0ff"/><circle cx="57" cy="37" r="4" fill="#56e0ff"/>
     <rect x="44" y="48" width="12" height="3" rx="1.5" fill="#2a3543"/>`,
    `<rect x="42" y="62" width="16" height="6" rx="3" fill="#56e0ff" opacity=".7"/>`),

  // Common — Miner: hard hat with lamp + pickaxe
  miner: fig("miner", "#c8873f", "#a2661f", "#f0c79a",
    `<path d="M28 30 Q28 12 50 12 Q72 12 72 30 Z" fill="#ffce54"/><rect x="26" y="28" width="48" height="7" rx="3" fill="#f0a91a"/>
     <circle cx="50" cy="20" r="5" fill="#fff8d0"/><circle cx="50" cy="20" r="2.6" fill="#fff"/>
     ${EYES()}
     ${SMILE}`,
    `<rect x="72" y="58" width="5" height="40" rx="2.5" fill="#8a5a2b" transform="rotate(16 74 78)"/><path d="M78 60 q13 1 19 11 q-11 -3 -19 -2 z" fill="#b9c4d0" transform="rotate(16 84 66)"/>`),

  // Common — Anon: hooded ninja with glowing eyes
  anon: fig("anon", "#2b3a4a", "#151f2a", "#1d2733",
    `<path d="M25 40 Q25 6 50 6 Q75 6 75 40 Q75 18 50 18 Q25 18 25 40" fill="#101922"/>
     <rect x="34" y="33" width="32" height="9" rx="4" fill="#0a1119"/>
     <path d="M40 37.5 h7 M53 37.5 h7" stroke="#7CFFB0" stroke-width="3" stroke-linecap="round"/>`,
    `<circle cx="72" cy="72" r="7" fill="#0a1119"/><path d="M72 65 v14 M65 72 h14 M67.5 67.5 l9 9 M76.5 67.5 l-9 9" stroke="#9fb6cc" stroke-width="1.6"/>`),

  // Common — Shiller: loud marketer with a phone + rainbow tuft
  shiller: fig("shiller", "#ff5a6e", "#d0304a", "#ffd9b8",
    `<path d="M38 15 q-3 -10 4 -9 M50 12 q0 -11 6 -8 M62 15 q4 -9 8 -4" stroke="#ffce54" stroke-width="3" fill="none" stroke-linecap="round"/>
     ${EYES()}
     <circle cx="38" cy="43" r="3.6" fill="#ff9db0" opacity=".8"/><circle cx="62" cy="43" r="3.6" fill="#ff9db0" opacity=".8"/>
     <path d="M40 45 q10 9 20 0 q-10 4 -20 0" fill="#7a1f2a"/>`,
    `<rect x="66" y="74" width="14" height="22" rx="3" fill="#0e1a26" transform="rotate(-12 73 85)"/><rect x="68" y="77" width="10" height="14" rx="1.5" fill="#56e0ff" opacity=".8" transform="rotate(-12 73 85)"/>`),
};

export function heroArt(id: string, emoji: string): string {
  return HERO_ART[id] || `<span style="font-size:1.6em">${emoji}</span>`;
}
