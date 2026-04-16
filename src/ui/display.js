/**
 * Display / UI Module
 * Handles all terminal output formatting.
 */

// Simple color helpers without chalk dependency issues
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
};

export function printBanner() {
  console.log('');
  console.log(c.cyan(c.bold('  ╔══════════════════════════════════════╗')));
  console.log(c.cyan(c.bold('  ║   Claude Code Smart Optimizer (CCSO) ║')));
  console.log(c.cyan(c.bold('  ║   v3.0.0  —  חוסך טוקנים בשקט       ║')));
  console.log(c.cyan(c.bold('  ╚══════════════════════════════════════╝')));
  console.log('');
  console.log(c.dim('  פקודות מובנות: /handoff  /status  /exit'));
  console.log('');
}

export function printStatus(monitor) {
  const s = monitor.getStatus();
  const bar = buildBar(s.usedPercent);
  const color = s.usedPercent >= 80 ? c.red : s.usedPercent >= 50 ? c.yellow : c.green;

  console.log('');
  console.log(c.bold('  ── סטטוס סשן ──────────────────────────'));
  console.log(`  💰 עלות:    $${s.cost} / $${s.costThreshold}  ${color(bar)} ${s.usedPercent}%`);
  console.log(`  📨 פקודות:  ${s.commands} / ${s.commandThreshold}`);
  console.log(`  ⏱️  זמן:     ${s.elapsedMinutes} דקות`);
  if (s.usedPercent >= 80) {
    console.log(c.yellow(`  ⚠️  קרוב לסף — Handoff אוטומטי בקרוב`));
  }
  console.log('');
}

function buildBar(percent) {
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}
