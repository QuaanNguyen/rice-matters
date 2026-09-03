'use strict';
/**
 * Did a tool result come back broken?
 *
 * Deliberately narrow. A file that merely contains the word "error" is not a
 * failure, and Rice should not glitch every time the agent reads a log file.
 * We only match shapes that mean "this did not run".
 */

const FAILURE_SHAPES = [
  /^\s*error:/i,
  /Traceback \(most recent call last\)/,
  /\bcommand not found\b/i,
  /\bexit (?:code |status )?[1-9]\d*\b/i,
  /\bPermission denied\b/,
  /\bENOENT\b/,
  /\bno such file or directory\b/i,
  /\bSegmentation fault\b/i,
  /\bnpm ERR!/,
];

/**
 * @param {string} content a tool result
 * @returns {string|null} the offending line, or null if it looks fine
 */
function toolFailed(content) {
  const head = String(content || '').slice(0, 600);
  if (!head.trim()) return null;
  for (const re of FAILURE_SHAPES) {
    const m = head.match(re);
    if (m) {
      const line = head.split('\n').find((l) => re.test(l)) || m[0];
      return line.trim();
    }
  }
  return null;
}

module.exports = { toolFailed, FAILURE_SHAPES };
