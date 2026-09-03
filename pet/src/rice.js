'use strict';
/**
 * Rice's face. One SVG group per state, swapped in whole.
 * Coordinates live inside the 120x150 grain viewBox.
 */

const INK = '#2b3a33';

const eye = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`;
const wideEye = (x, y, look = 0) =>
  `<circle cx="${x}" cy="${y}" r="9" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
   <circle cx="${x + look}" cy="${y + 1}" r="4.2" fill="${INK}"/>`;
const happyEye = (x, y, flip = 1) =>
  `<path d="M${x - 7} ${y + 3} q7 ${-9 * flip} 14 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const closedEye = (x, y) =>
  `<path d="M${x - 6} ${y} h12" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
const crossEye = (x, y) =>
  `<path d="M${x - 5} ${y - 5} l10 10 M${x + 5} ${y - 5} l-10 10" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
const angryEye = (x, y, dir) =>
  `${eye(x, y + 1, 4.6)}
   <path d="M${x - 8} ${y - 9} l16 ${5 * dir}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" transform="rotate(${dir > 0 ? 0 : 0} ${x} ${y})"/>`;

const smile = (w = 16, y = 100) =>
  `<path d="M${60 - w / 2} ${y} q${w / 2} ${w * 0.55} ${w} 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const flat = (w = 14, y = 101) =>
  `<path d="M${60 - w / 2} ${y} h${w}" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const frown = (w = 16, y = 105) =>
  `<path d="M${60 - w / 2} ${y} q${w / 2} ${-w * 0.5} ${w} 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const wavy = (y = 102) =>
  `<path d="M51 ${y} q4 -5 8 0 t8 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
const openMouth = (y = 99) =>
  `<path d="M50 ${y} q10 16 20 0 z" fill="${INK}"/>`;
const oMouth = (y = 102) =>
  `<ellipse cx="60" cy="${y}" rx="5" ry="6.5" fill="${INK}"/>`;

const blush = (o = 0.5) =>
  `<ellipse cx="34" cy="94" rx="8" ry="4.5" fill="#e88f8f" opacity="${o}"/>
   <ellipse cx="86" cy="94" rx="8" ry="4.5" fill="#e88f8f" opacity="${o}"/>`;

const mark = (glyph, colour) =>
  `<text x="96" y="34" font-size="30" font-weight="700" fill="${colour}"
     font-family="Segoe UI, Helvetica, Arial, sans-serif">${glyph}</text>`;

const FACES = {
  calm: () => `
    ${eye(44, 74)} ${eye(76, 74)}
    ${smile(18, 96)}
    ${blush(0.42)}`,

  checking: () => `
    ${wideEye(44, 73, 3)} ${wideEye(76, 73, 3)}
    ${flat(12, 100)}
    ${mark('?', '#e0b341')}`,

  suspicious: () => `
    ${wideEye(44, 72, -3)} ${wideEye(76, 72, -3)}
    ${wavy(101)}
    <path d="M32 58 l16 -6 M88 58 l-16 -6" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,

  refused: () => `
    ${angryEye(44, 76, 1)} ${angryEye(76, 76, -1)}
    ${frown(20, 106)}
    ${mark('!', '#e2604a')}`,

  rejecting: () => `
    ${closedEye(44, 74)} ${closedEye(76, 74)}
    ${flat(20, 102)}
    <path d="M30 112 q30 12 60 0" stroke="${INK}" stroke-width="2" fill="none" opacity=".35"/>
    ${mark('×', '#d1487f')}`,

  celebrating: () => `
    ${happyEye(44, 72)} ${happyEye(76, 72)}
    ${openMouth(96)}
    ${blush(0.75)}
    <path d="M18 40 l4 -10 4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 z" fill="#58d68d" opacity=".9"/>
    <path d="M96 118 l3 -7 3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 z" fill="#58d68d" opacity=".75"/>`,

  asking: () => `
    ${eye(44, 74)} ${wideEye(76, 73, 2)}
    ${oMouth(102)}
    ${mark('?', '#5aa9e6')}`,

  offline: () => `
    ${closedEye(44, 76)} ${closedEye(76, 76)}
    ${flat(10, 100)}
    <text x="88" y="40" font-size="15" fill="${INK}" opacity=".45"
      font-family="Segoe UI, Helvetica, Arial, sans-serif">z</text>
    <text x="99" y="28" font-size="11" fill="${INK}" opacity=".3"
      font-family="Segoe UI, Helvetica, Arial, sans-serif">z</text>`,
};

function drawFace(state) {
  const f = FACES[state] || FACES.calm;
  return f();
}

if (typeof window !== 'undefined') window.RiceFaces = { drawFace, FACES };
if (typeof module !== 'undefined') module.exports = { drawFace, FACES };
