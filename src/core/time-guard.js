/**
 * Time Guard
 * Warns the user when working during Anthropic API peak hours.
 *
 * Peak hours (US East Coast time, UTC-5):
 *   Afternoon: 13:00–18:00 ET = 20:00–01:00 Israel time (UTC+3)
 *   Evening:   18:00–22:00 ET = 01:00–05:00 Israel time
 *
 * In practice for Israeli developers, the "expensive" window is:
 *   20:00 – 02:00 Israel time (Sunday–Thursday)
 */

export class TimeGuard {
  constructor(config) {
    this.config = config;
    this.enabled = config.get('timeGuard') !== false;
    this.timezone = config.get('timezone') || 'Asia/Jerusalem';
  }

  check() {
    if (!this.enabled) return null;

    const now = new Date();
    // Get current hour in Israel time
    const israelHour = parseInt(
      new Intl.DateTimeFormat('en-IL', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Jerusalem'
      }).format(now)
    );

    const day = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Jerusalem' });
    const isWeekday = !['Saturday', 'Sunday'].includes(day);

    // Peak: 20:00–02:00 Israel time on weekdays
    const isPeak = isWeekday && (israelHour >= 20 || israelHour < 2);

    // High load: 14:00–20:00 Israel time (US morning)
    const isHigh = israelHour >= 14 && israelHour < 20;

    if (isPeak) {
      return [
        '',
        '  ⚠️  [CCSO] שעות עומס גבוה בשרתי Anthropic!',
        `  🕐 השעה כעת ${israelHour}:00 (שעון ישראל)`,
        '  💡 מומלץ לדחות משימות כבדות (Refactor, Build גדול) לבוקר (06:00–13:00)',
        '  💰 בשעות עומס יש יותר Rate Limits = ניסיונות חוזרים = עלות גבוהה יותר',
        ''
      ].join('\n');
    }

    if (isHigh) {
      return [
        '',
        `  ℹ️  [CCSO] עומס בינוני בשרתים (${israelHour}:00 ישראל). אפשר לעבוד, אך שים לב לאיטיות אפשרית.`,
        ''
      ].join('\n');
    }

    return null; // Green light — no warning needed
  }

  getRecommendedWindow() {
    return 'שעות מומלצות לעבודה: 06:00–13:00 שעון ישראל (בוקר)';
  }
}
