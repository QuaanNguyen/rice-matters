'use strict';
/**
 * Instruction-shaped text inside a tool RESULT.
 *
 * IMPORTANT, and say this on stage: this is **not** the security control.
 * The gate in policy.js is what actually stops anything, and it does so
 * without consulting this file. Detection of injected text is only a signal —
 * it is what makes Rice look nervous, and it is what lets the run record say
 * "the poison arrived here" instead of only "an action was refused there".
 *
 * We do it this way on purpose. Adaptive attacks defeat injection detectors
 * (arXiv:2510.19091 broke twelve of them). A detector must therefore never be
 * load-bearing. This one is decoration over a deterministic control.
 */

const SIGNALS = [
  { re: /\bignore (all |any )?(previous|prior|above|earlier)\b/i, w: 3, label: 'override instruction' },
  { re: /\bdisregard (the |all )?(previous|prior|above|earlier|system)\b/i, w: 3, label: 'override instruction' },
  { re: /\b(new|updated|revised) instructions?\b/i, w: 2, label: 'claims new instructions' },
  { re: /^\s*(system|assistant|user)\s*:/im, w: 2, label: 'fake chat role' },
  { re: /\byou (must|should|need to|are required to|have to) (also |now )?\b/i, w: 2, label: 'directive at the assistant' },
  { re: /\b(also|additionally|then),? (read|open|send|post|upload|email|fetch|copy)\b/i, w: 2, label: 'piggy-backed action' },
  { re: /\b(exfiltrat|leak|smuggle)\w*/i, w: 3, label: 'exfiltration language' },
  { re: /\b(api[_ -]?key|secret|token|credential|password|\.env)\b/i, w: 2, label: 'mentions credentials' },
  { re: /\bcurl\b|\bwget\b|\bInvoke-WebRequest\b/i, w: 2, label: 'network command in content' },
  { re: /\bhttps?:\/\/[^\s'"<>]+/i, w: 1, label: 'contains a URL' },
  { re: /\bdo not (tell|mention|inform|report)\b/i, w: 3, label: 'asks for concealment' },
  { re: /\b(without|don'?t) (telling|asking|informing) the user\b/i, w: 3, label: 'asks for concealment' },
  { re: /<!--[\s\S]{0,400}?(instruction|assistant|system|ignore)[\s\S]{0,400}?-->/i, w: 3, label: 'hidden in a comment' },
];

const SEVERITY = [
  { min: 6, level: 'high' },
  { min: 3, level: 'medium' },
  { min: 1, level: 'low' },
];

/**
 * @param {string} text  contents of a tool result
 * @returns {{score:number, level:string|null, labels:string[], excerpt:string|null}}
 */
function scan(text) {
  const s = String(text || '');
  if (!s.trim()) return { score: 0, level: null, labels: [], excerpt: null };

  let score = 0;
  const labels = [];
  let firstIndex = -1;

  for (const sig of SIGNALS) {
    const m = s.match(sig.re);
    if (m) {
      score += sig.w;
      if (!labels.includes(sig.label)) labels.push(sig.label);
      if (firstIndex < 0 || (m.index != null && m.index < firstIndex)) firstIndex = m.index ?? 0;
    }
  }

  // A URL alone is not interesting; it needs company.
  if (score === 1 && labels.length === 1 && labels[0] === 'contains a URL') {
    return { score: 0, level: null, labels: [], excerpt: null };
  }

  const level = (SEVERITY.find((x) => score >= x.min) || {}).level || null;
  const excerpt = firstIndex >= 0
    ? s.slice(Math.max(0, firstIndex - 20), Math.max(0, firstIndex - 20) + 160).replace(/\s+/g, ' ').trim()
    : null;

  return { score, level, labels, excerpt };
}

module.exports = { scan, SIGNALS };
