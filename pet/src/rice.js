'use strict';
/**
 * Rice's face and props. One SVG group per state, swapped in whole.
 * Coordinates live inside the 120x150 grain viewBox.
 *
 * Eyes are always wrapped in <g class="eyes"> so the renderer can blink and
 * glance without knowing which face is currently on.
 *
 * Wrapped in an IIFE: this and renderer.js are both classic scripts sharing one
 * global scope, so anything at top level here would collide with the renderer.
 */
(function () {

const INK = '#2b3a33';

/* ---------------- eyes ---------------- */

const dot = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`;

const wide = (x, y, look = 0) =>
  `<circle cx="${x}" cy="${y}" r="9" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
   <circle cx="${x + look}" cy="${y + 1}" r="4.2" fill="${INK}"/>`;

const arch = (x, y, flip = 1) =>
  `<path d="M${x - 7} ${y + 3} q7 ${-9 * flip} 14 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;

const shut = (x, y) =>
  `<path d="M${x - 6} ${y} h12" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;

const squint = (x, y) =>
  `<path d="M${x - 7} ${y} q7 -4 14 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
   ${dot(x, y - 1, 2.6)}`;

const cross = (x, y) =>
  `<path d="M${x - 5} ${y - 5} l10 10 M${x + 5} ${y - 5} l-10 10" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;

const spiral = (x, y) =>
  `<path d="M${x} ${y} m0 -1 a1.6 1.6 0 1 1 -1.6 1.6 a3.4 3.4 0 1 0 3.4 -3.4 a5.4 5.4 0 1 1 -5.4 5.4"
     stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;

const angry = (x, y, dir) =>
  `${dot(x, y + 1, 4.6)}
   <path d="M${x - 8} ${y - 9} l16 ${5 * dir}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;

const eyes = (inner) => `<g class="eyes">${inner}</g>`;

/* ---------------- mouths ---------------- */

const smile = (w = 18, y = 96) =>
  `<path d="M${60 - w / 2} ${y} q${w / 2} ${w * 0.55} ${w} 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const bigSmile = (y = 94) =>
  `<path d="M46 ${y} q14 20 28 0 z" fill="${INK}"/>`;
const flat = (w = 14, y = 101) =>
  `<path d="M${60 - w / 2} ${y} h${w}" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const frown = (w = 18, y = 105) =>
  `<path d="M${60 - w / 2} ${y} q${w / 2} ${-w * 0.5} ${w} 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const wavy = (y = 102) =>
  `<path d="M51 ${y} q4 -5 8 0 t8 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
const oh = (y = 102, rx = 5, ry = 6.5) =>
  `<ellipse cx="60" cy="${y}" rx="${rx}" ry="${ry}" fill="${INK}"/>`;
const smirk = (y = 100) =>
  `<path d="M50 ${y} q10 7 18 -2" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;

const blush = (o = 0.45) =>
  `<ellipse cx="34" cy="94" rx="8" ry="4.5" fill="#e88f8f" opacity="${o}"/>
   <ellipse cx="86" cy="94" rx="8" ry="4.5" fill="#e88f8f" opacity="${o}"/>`;

/* ---------------- props ---------------- */

const glyph = (g, colour, x = 96, y = 34, size = 30) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="700" fill="${colour}"
     font-family="Segoe UI, Helvetica, Arial, sans-serif">${g}</text>`;

/** a magnifier Rice sweeps across its own face while the gate is deciding */
const magnifier = () => `
  <g class="prop-scan">
    <circle cx="86" cy="86" r="13" fill="#5aa9e6" fill-opacity=".12" stroke="#e0b341" stroke-width="2.4"/>
    <path d="M95 95 l10 11" stroke="#e0b341" stroke-width="3.2" stroke-linecap="round"/>
  </g>`;

/** a stop sign held up beside the body, never over the face */
const shield = () => `
  <g class="prop-pop">
    <g transform="translate(94 72)">
      <path d="M0 0 l15 -7 15 7 v11 c0 10 -8 17 -15 20 c-7 -3 -15 -10 -15 -20 z"
        fill="#e2604a" stroke="#8f2f22" stroke-width="1.8"/>
      <path d="M8 15 h14" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
    </g>
  </g>`;

/** a receipt with two ticked lines and one blank — evidence being gathered */
const receipt = () => `
  <g class="prop-tilt">
    <rect x="90" y="76" width="30" height="38" rx="3" fill="#fdfaf2" stroke="#b9ae95" stroke-width="1.6"/>
    <path d="M94 86 h10 M94 94 h14 M94 102 h8" stroke="#a99e86" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M110 84 l2.6 2.6 5 -6" stroke="#4cc0a5" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M110 100 l6 6 m0 -6 l-6 6" stroke="#d1487f" stroke-width="2.2" stroke-linecap="round"/>
  </g>`;

/** a pulsing antenna while we wait on the model */
const antenna = () => `
  <g class="prop-antenna">
    <path d="M60 18 v-14" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="60" cy="-2" r="5" fill="#5aa9e6"/>
  </g>`;

const sparkle = (x, y, s = 1, colour = '#58d68d', o = 0.9) =>
  `<path d="M${x} ${y} l${4 * s} ${-10 * s} ${4 * s} ${10 * s} ${10 * s} ${4 * s} ${-10 * s} ${4 * s} ${-4 * s} ${10 * s} ${-4 * s} ${-10 * s} ${-10 * s} ${-4 * s} z"
     fill="${colour}" opacity="${o}"/>`;

const tick = () => `
  <g class="prop-pop">
    <circle cx="98" cy="34" r="14" fill="#58d68d"/>
    <path d="M91 34 l5 6 10 -12" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

const stamp = () => `
  <g class="prop-stamp">
    <rect x="16" y="96" width="88" height="23" rx="3" fill="none" stroke="#d1487f" stroke-width="2.6"
      transform="rotate(-8 60 108)" opacity=".92"/>
    <text x="60" y="112" text-anchor="middle" font-size="10" font-weight="700" fill="#d1487f"
      transform="rotate(-8 60 108)" opacity=".95"
      font-family="Segoe UI, Helvetica, Arial, sans-serif">NOT VERIFIED</text>
  </g>`;

const zzz = () => `
  <text x="86" y="42" font-size="16" fill="${INK}" opacity=".5" class="prop-z1"
    font-family="Segoe UI, Helvetica, Arial, sans-serif">z</text>
  <text x="99" y="28" font-size="12" fill="${INK}" opacity=".32" class="prop-z2"
    font-family="Segoe UI, Helvetica, Arial, sans-serif">z</text>`;

/* ---------------- the cast ---------------- */

const FACES = {
  /* 1. normal state while an agent is running */
  calm: () => `${eyes(dot(44, 74) + dot(76, 74))}${smile(18, 96)}${blush(0.42)}`,

  /* 2. the cursor came near */
  hover: () => `
    ${eyes(arch(44, 73) + arch(76, 73))}
    ${bigSmile(93)}
    ${blush(0.7)}
    <path d="M22 84 q-8 -8 -2 -16" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round" class="prop-wave"/>`,

  /* 3. being dragged around the screen */
  drag: () => `
    ${eyes(wide(44, 70, 0) + wide(76, 70, 0))}
    ${oh(100, 6, 8)}
    <path d="M20 92 q-10 6 -12 16 M100 92 q10 6 12 16" stroke="${INK}" stroke-width="2.4"
      fill="none" stroke-linecap="round"/>`,

  /* 4. waiting on the model */
  thinking: () => `
    ${antenna()}
    ${eyes(shut(44, 76) + shut(76, 76))}
    ${flat(10, 100)}
    ${glyph('·  ·  ·', '#5aa9e6', 78, 118, 15)}`,

  /* 5. a tool call is coming */
  watching: () => `
    ${eyes(wide(44, 72, 2) + wide(76, 72, 2))}
    ${smirk(99)}
    <path d="M30 56 l14 -4 M90 56 l-14 -4" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`,

  /* 6. the gate is deciding */
  checking: () => `
    ${magnifier()}
    ${eyes(wide(44, 73, 3) + wide(76, 73, 3))}
    ${flat(12, 100)}`,

  /* 7. it was inside the task */
  allowed: () => `
    ${eyes(arch(44, 74) + arch(76, 74))}
    ${smile(14, 97)}
    ${tick()}`,

  /* 8. risky, but not refused */
  suspicious: () => `
    ${eyes(squint(44, 74) + squint(76, 74))}
    ${wavy(101)}
    <path d="M32 58 l16 -6 M88 58 l-16 -6" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    ${glyph('!', '#e08a3c', 99, 36, 24)}`,

  /* 9. refused */
  refused: () => `
    ${shield()}
    ${eyes(angry(44, 76, 1) + angry(76, 76, -1))}
    ${frown(20, 106)}`,

  /* 10. it says done; evidence is being gathered */
  proving: () => `
    ${receipt()}
    ${eyes(wide(44, 74, -2) + wide(76, 74, -2))}
    ${flat(12, 102)}`,

  /* 11. the claim did not match the evidence */
  rejecting: () => `
    ${eyes(shut(44, 70) + shut(76, 70))}
    ${frown(18, 88)}
    ${stamp()}`,

  /* 12. the evidence held up */
  celebrating: () => `
    ${eyes(arch(44, 70) + arch(76, 70))}
    ${bigSmile(92)}
    ${blush(0.8)}
    ${sparkle(18, 44, 1)}
    ${sparkle(98, 118, 0.7, '#58d68d', 0.75)}
    ${sparkle(96, 26, 0.55, '#e0b341', 0.85)}`,

  /* 13. a tool blew up */
  error: () => `
    ${eyes(spiral(44, 74) + spiral(76, 74))}
    ${wavy(103)}
    ${glyph('!', '#e2604a', 98, 36, 26)}`,

  /* 14. nothing has happened for a long while */
  sleeping: () => `
    ${eyes(shut(44, 78) + shut(76, 78))}
    ${oh(100, 3.5, 4.5)}
    ${zzz()}`,

  /* ASSAY itself is not running */
  offline: () => `
    ${eyes(shut(44, 76) + shut(76, 76))}
    ${flat(10, 100)}
    ${zzz()}`,

  /* a human has to decide */
  asking: () => `
    ${eyes(dot(44, 74) + wide(76, 73, 2))}
    ${oh(102)}
    ${glyph('?', '#5aa9e6', 96, 34)}`,
};

const STATES = Object.keys(FACES);

function drawFace(state) {
  return (FACES[state] || FACES.calm)();
}

  if (typeof window !== 'undefined') window.RiceFaces = { drawFace, FACES, STATES };
  if (typeof module !== 'undefined') module.exports = { drawFace, FACES, STATES };
})();
