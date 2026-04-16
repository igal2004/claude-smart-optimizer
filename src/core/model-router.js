/**
 * Smart Model Router
 * Automatically selects the most cost-effective Claude model based on query complexity.
 *
 * Routing logic:
 *   Simple question  → claude-haiku-4-5-20251001  (10x cheaper)
 *   Standard task    → claude-sonnet-4-6           (default)
 *   Complex task     → claude-opus-4-6             (most capable)
 */

const SIMPLE_PATTERNS = [
  // Questions
  /^(מה|what|what's|what is|what are)\s.{0,80}\?$/i,
  /^(who|מי)\s.{0,60}\?$/i,
  /^(when|מתי)\s.{0,60}\?$/i,
  /^(where|איפה|היכן)\s.{0,60}\?$/i,
  /^(why|למה|מדוע)\s.{0,60}\?$/i,
  /^(how many|how much|כמה)\s.{0,60}\?$/i,
  /^(is it|does it|האם|האם זה|האם יש)\s.{0,60}\?$/i,
  // Explanations of short things
  /^(הסבר|explain)\s.{0,60}$/i,
  /what does .{0,60} (mean|do)\??/i,
  /what is (the )?(difference|meaning|definition) of/i,
  /what('s| is) .{0,40}\?$/i,
  // Simple fixes
  /fix\s+(typo|spelling|indent|whitespace|grammar|punctuation)/i,
  /correct\s+(typo|spelling|grammar)/i,
  // Listing
  /^(רשום|list|show me|show|פרט|enumerate)\s.{0,60}$/i,
  /^(תן לי רשימה|give me a list)\s/i,
  // Translations
  /^(תרגם|translate)\s/i,
  /^translate .{0,80}$/i,
  // Yes/no
  /^(כן|לא|yes|no)\?/i,
  /^(true or false|yes or no|כן או לא)\b/i,
  // Simple lookups
  /syntax error/i,
  /^(hello|hi|שלום|היי)\b/i,
  /^(thanks|thank you|תודה)\b/i,
  // Rename / short rename
  /^rename\s+\w+\s+to\s+\w+$/i,
  /^שנה שם\s.{0,40}$/i,
  // Show / print value
  /^(print|הדפס|show|הצג)\s+the\s+value/i,
  /^מה הערך של/i,
  // Version checks
  /^(what version|איזו גרסה)/i,
  // Comment out one line
  /^comment out line \d+/i,
];

const COMPLEX_PATTERNS = [
  /refactor.{0,60}(entire|all|complete|whole|מלא|כולו)/i,
  /architect(ure)?/i,
  /design (system|pattern|schema|database)/i,
  /migrate/i,
  /(entire|complete|full)\s+(codebase|project|system)/i,
  /performance (optimization|improvement)/i,
  /security (audit|review)/i,
  /בצע ריפקטור מלא/i,
  /בנה לי (מערכת|ארכיטקטורה)/i,
];

export class ModelRouter {
  constructor(config) {
    this.enabled = config.get('smartRouting') !== false;
  }

  /**
   * Analyze query and return { model, args, label, reason }
   * args = extra CLI flags to pass to claude
   */
  route(query) {
    if (!this.enabled) return { model: 'sonnet', args: [], label: '', reason: null };

    const wordCount  = query.trim().split(/\s+/).length;
    const hasCode    = /```[\s\S]*```|`[^`]+`/.test(query);
    const fileCount  = (query.match(/\b[\w-]+\.(ts|js|tsx|jsx|py|go|rs|java|css|json)\b/g) || []).length;
    const lineCount  = query.split('\n').length;

    // Complexity score: 0-10 (lower = simpler = Haiku)
    let score = 0;
    if (wordCount > 30)  score += 2;
    if (wordCount > 80)  score += 2;
    if (hasCode)         score += 3;
    if (fileCount > 1)   score += 2;
    if (fileCount > 3)   score += 2;
    if (lineCount > 20)  score += 2;
    if (lineCount > 50)  score += 2;
    // Implementation verbs suggest real coding work
    if (/\b(add|create|build|write|implement|make|generate|update|change|modify|delete|remove)\b/i.test(query)) score += 2;

    const simpleMatch  = SIMPLE_PATTERNS.some(p => p.test(query));
    const complexMatch = COMPLEX_PATTERNS.some(p => p.test(query));

    // Never route to Haiku if complex patterns match
    if (!complexMatch) {
      // Route to Haiku: simple pattern match with low score
      if (simpleMatch && score <= 4) {
        return { model: 'haiku', args: ['--model', 'claude-haiku-4-5-20251001'], label: '⚡ Haiku', reason: 'שאלה פשוטה → Haiku (זול יותר)' };
      }
      // Route to Haiku: very short queries with no code, no files, no implementation verbs
      if (!hasCode && wordCount <= 8 && fileCount === 0 && score <= 1) {
        return { model: 'haiku', args: ['--model', 'claude-haiku-4-5-20251001'], label: '⚡ Haiku', reason: 'פרומפט קצר → Haiku (זול יותר)' };
      }
    }

    // Complex: many files, long input, or complexity patterns
    const isComplex = complexMatch ||
                      (fileCount > 3) ||
                      (wordCount > 150 && hasCode) ||
                      lineCount > 80;

    if (isComplex) {
      return { model: 'opus', args: ['--model', 'claude-opus-4-6'], label: '🧠 Opus', reason: 'משימה מורכבת → Opus' };
    }

    // Default
    return { model: 'sonnet', args: [], label: '🎯 Sonnet', reason: null };
  }
}
