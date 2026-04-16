/**
 * Prompt Templates
 * Ready-made prompts for common development tasks.
 * Use in REPL: /template <name>
 * Or from CLI: ccso template [name]
 */

export const TEMPLATES = {
  bug: {
    name: 'דיווח באג',
    emoji: '🐛',
    description: 'לתיאור ותיקון שגיאה',
    text: `קיבלתי את השגיאה הבאה:
\`\`\`
[הדבק כאן את השגיאה]
\`\`\`

הקוד הרלוונטי:
\`\`\`
[הדבק כאן את הקוד]
\`\`\`

מה הבעיה ואיך לתקן? הסבר בקצרה ותן את הקוד המתוקן.`,
  },

  review: {
    name: 'Code Review',
    emoji: '🔍',
    description: 'בקשת ביקורת קוד',
    text: `עשה code review על הקוד הבא:
\`\`\`
[הדבק כאן את הקוד]
\`\`\`

בדוק:
1. באגים פוטנציאליים
2. בעיות ביצועים
3. אבטחה
4. קריאות ותחזוקה
5. הצע שיפורים ספציפיים.`,
  },

  explain: {
    name: 'הסבר קוד',
    emoji: '📖',
    description: 'הסבר של קוד קיים',
    text: `הסבר לי את הקוד הבא:
\`\`\`
[הדבק כאן את הקוד]
\`\`\`

הסבר:
1. מה הקוד עושה בגדול
2. איך הוא עובד שלב-שלב
3. חלקים לא ברורים`,
  },

  refactor: {
    name: 'Refactor',
    emoji: '♻️',
    description: 'שיפור מבנה קוד קיים',
    text: `בצע refactor לקוד הבא. שמור על אותה פונקציונליות:
\`\`\`
[הדבק כאן את הקוד]
\`\`\`

יעדים: קריאות, ביצועים, עקרונות DRY/SOLID. הסבר את השינויים.`,
  },

  tests: {
    name: 'כתיבת טסטים',
    emoji: '✅',
    description: 'כתיבת unit tests',
    text: `כתוב unit tests לקוד הבא:
\`\`\`
[הדבק כאן את הקוד]
\`\`\`

כלול: happy path, edge cases, error cases. השתמש ב-Jest (או ציין Framework אחר).`,
  },

  docs: {
    name: 'תיעוד',
    emoji: '📝',
    description: 'כתיבת JSDoc / docstrings',
    text: `כתוב תיעוד מלא לקוד הבא:
\`\`\`
[הדבק כאן את הקוד]
\`\`\`

כלול JSDoc לכל פונקציה: תיאור, @param, @returns, @example.`,
  },

  optimize: {
    name: 'אופטימיזציה',
    emoji: '⚡',
    description: 'שיפור ביצועים',
    text: `מצא ותקן בעיות ביצועים בקוד הבא:
\`\`\`
[הדבק כאן את הקוד]
\`\`\`

בדוק: לולאות מיותרות, re-renders, קריאות API כפולות, זיכרון. תן קוד מותאם עם הסבר.`,
  },

  security: {
    name: 'בדיקת אבטחה',
    emoji: '🔒',
    description: 'סריקת בעיות אבטחה',
    text: `סרוק את הקוד הבא לבעיות אבטחה:
\`\`\`
[הדבק כאן את הקוד]
\`\`\`

בדוק: SQL injection, XSS, חשיפת מידע רגיש, הרשאות, אימות. ציין כל בעיה וכיצד לתקן.`,
  },
};

const c = {
  cyan:  s => `\x1b[36m${s}\x1b[0m`,
  bold:  s => `\x1b[1m${s}\x1b[0m`,
  dim:   s => `\x1b[2m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
};

export function printTemplateList() {
  console.log('');
  console.log(c.bold(c.cyan('  תבניות זמינות:')));
  console.log('');
  for (const [key, t] of Object.entries(TEMPLATES)) {
    console.log(`  ${c.green(`/template ${key}`)}  ${t.emoji}  ${t.name}  ${c.dim('— ' + t.description)}`);
  }
  console.log('');
  console.log(c.dim('  שימוש: /template <שם>  לדוגמה:  /template bug'));
  console.log('');
}

export function getTemplate(name) {
  return TEMPLATES[name] || null;
}

/** Handle /template REPL command. Returns { handled, message, prompt } */
export function handleTemplateCommand(input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/template')) return { handled: false };

  const name = trimmed.replace('/template', '').trim();

  if (!name) {
    let msg = '\n' + c.bold(c.cyan('  תבניות זמינות:')) + '\n\n';
    for (const [key, t] of Object.entries(TEMPLATES)) {
      msg += `  ${c.green(key.padEnd(10))}  ${t.emoji} ${t.name}  ${c.dim('— ' + t.description)}\n`;
    }
    msg += '\n' + c.dim('  שימוש: /template <שם>  לדוגמה: /template bug') + '\n';
    return { handled: true, message: msg, prompt: null };
  }

  const template = TEMPLATES[name];
  if (!template) {
    return { handled: true, message: `\n  ❌ תבנית "${name}" לא נמצאה. הקלד /template לרשימה.\n`, prompt: null };
  }

  return {
    handled: true,
    message: `\n  ${template.emoji} תבנית: ${template.name}\n  ── העתק את הטקסט הבא, מלא את הסוגריים ושלח:\n`,
    prompt: template.text,
  };
}
