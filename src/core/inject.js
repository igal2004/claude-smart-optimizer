/**
 * CCSO Inject
 * Creates token-saving config files for all AI platforms in the current project.
 * - CLAUDE.md        → Claude Code (this session)
 * - .cursorrules     → Cursor
 * - .windsurfrules   → Windsurf
 * - .github/copilot-instructions.md → VS Code Copilot
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCCSOPath } from './storage-paths.js';

const RULES = `# CCSO Smart Rules v3.0
# Generated automatically — do not edit this section manually

## שפה
- ענה בשפה שבה נשאלת — עברית לעברית, אנגלית לאנגלית
- קבל שאלות בעברית ללא בעיה

## תמציתיות (חיסכון בטוקנים)
- אל תכניס הקדמות: ללא "אשמח לעזור", "בהחלט", "כמובן", "בטח"
- אל תסכם בסוף: ללא "לסיכום", "עדכנתי את הקובץ", "הנה מה שעשיתי"
- אל תחזור על מה שהמשתמש כתב
- תשובה קצרה עדיפה — אם ניתן לומר בשורה, אל תכתוב פסקה
- אל תשתמש ב-emoji אלא אם ביקשו במפורש

## קוד — כיווץ (חיסכון משמעותי בטוקנים)
- קוד בלבד — ללא הערות (comments) אלא אם ביקשו
- אל תוסיף הערות JSDoc/docstrings לקוד שלא שינית
- אל תוסיף type annotations לקוד שלא שינית
- אל תוסיף error handling לתרחישים שלא יכולים לקרות
- אל תוסיף console.log לצורך debugging אלא אם ביקשו
- הסר שורות ריקות מיותרות בתוך פונקציות
- השתמש בתבניות הקיימות בקוד — אל תמציא סגנון חדש
- אל תיצור קבצים חדשים אלא אם הכרחי לחלוטין
- אל תוסיף פיצ'רים מעבר למה שנדרש במפורש

## אבטחה
- לעולם אל תכלול API keys אמיתיים, סיסמאות, או טוקנים בתגובות
- אם צריך להדגים key — השתמש ב-YOUR_API_KEY, sk-xxx, או PLACEHOLDER
- אם רואה credentials בקוד שנשלח — הזהר לפני המשך

## Git Context
- כשנשאלים על באג, שגיאה, או שינוי קוד — אם אין git diff בשיחה, בקש: "הדבק את הפלט של \`git diff\`"
- כשנשאלים על commit message — שמור אותו קצר ומדויק (50 תווים לכותרת)
- בקשות refactor — בדוק קודם אם יש שינויים staged ב-git

## תבניות (Templates)
כשמבקשים אחד מאלה, השתמש בפורמט המוגדר:

**באג / Bug:**
קיבלתי שגיאה: [שגיאה]
קוד רלוונטי: [קוד]
מה הבעיה ואיך לתקן? תן קוד מתוקן בלבד.

**Code Review:**
בדוק: נכונות, ביצועים, אבטחה, קריאות.
פורמט: בעיות קריטיות → בינוניות → הצעות. ללא שבחים מיותרים.

**Refactor:**
שפר מבנה בלי לשנות התנהגות. הצג רק את הקוד המשופר.

**Tests:**
כתוב unit tests. כסה: happy path, edge cases, שגיאות. ללא הסברים.

**Optimize:**
מצא צוואר בקבוק ותקן. הצג: לפני/אחרי + הסבר בשורה אחת.

**Security:**
סרוק: injection, XSS, auth, secrets, OWASP Top 10. דווח רק על בעיות אמיתיות.
`;

const MEMORY_HEADER = `\n## זיכרון פרויקט (CCSO)\n`;

/**
 * Read project memory from CCSO memory file
 */
function readProjectMemory(projectDir) {
  try {
    const hash = Buffer.from(projectDir).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
    const memFile = getCCSOPath('memory', `${hash}.md`);
    if (fs.existsSync(memFile)) {
      return fs.readFileSync(memFile, 'utf8').trim();
    }
  } catch {}
  return null;
}

/**
 * Write a file, creating parent directories as needed.
 * If file exists, merge CCSO section without overwriting user content.
 */
function writeFile(filePath, content, sectionMarker = '<!-- CCSO -->') {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    // If CCSO section exists, replace it
    if (existing.includes(sectionMarker)) {
      const before = existing.substring(0, existing.indexOf(sectionMarker));
      const updated = before.trimEnd() + '\n\n' + sectionMarker + '\n' + content;
      fs.writeFileSync(filePath, updated, 'utf8');
      return 'updated';
    }
    // Otherwise append
    fs.writeFileSync(filePath, existing.trimEnd() + '\n\n' + sectionMarker + '\n' + content, 'utf8');
    return 'appended';
  }

  fs.writeFileSync(filePath, sectionMarker + '\n' + content, 'utf8');
  return 'created';
}

/**
 * Main inject function
 */
export async function injectAll(projectDir = process.cwd()) {
  const results = [];
  const memory = readProjectMemory(projectDir);
  const memSection = memory ? MEMORY_HEADER + memory + '\n' : '';

  const fullRules = RULES + memSection;

  // 1. CLAUDE.md — Claude Code reads this automatically
  const claudeMd = path.join(projectDir, 'CLAUDE.md');
  const r1 = writeFile(claudeMd, fullRules, '<!-- CCSO-RULES -->');
  results.push({ file: 'CLAUDE.md', status: r1, note: 'Claude Code קורא אוטומטית' });

  // 2. .cursorrules — Cursor reads this automatically
  const cursorRules = path.join(projectDir, '.cursorrules');
  const r2 = writeFile(cursorRules, fullRules, '# CCSO-RULES');
  results.push({ file: '.cursorrules', status: r2, note: 'Cursor קורא אוטומטית' });

  // 3. .windsurfrules — Windsurf
  const windsurfRules = path.join(projectDir, '.windsurfrules');
  const r3 = writeFile(windsurfRules, fullRules, '# CCSO-RULES');
  results.push({ file: '.windsurfrules', status: r3, note: 'Windsurf קורא אוטומטית' });

  // 4. .github/copilot-instructions.md — VS Code Copilot
  const copilotFile = path.join(projectDir, '.github', 'copilot-instructions.md');
  const r4 = writeFile(copilotFile, fullRules, '<!-- CCSO-RULES -->');
  results.push({ file: '.github/copilot-instructions.md', status: r4, note: 'VS Code Copilot קורא אוטומטית' });

  // 5. .ccso_instruction — Gemini Code Assist / Firebase Studio
  // Paste into Gemini's "Code Customization > System Instructions" in VS Code settings
  const geminiInstruction = buildGeminiInstruction(memory);
  const geminiFile = path.join(projectDir, '.ccso_instruction');
  const r5 = writeFile(geminiFile, geminiInstruction, '# CCSO-GEMINI');
  results.push({ file: '.ccso_instruction', status: r5, note: 'הדבק ב-Gemini Code Customization' });

  // 6. .idx/dev.nix stub — Firebase Studio (Project IDX)
  const idxDir = path.join(projectDir, '.idx');
  const idxFile = path.join(idxDir, 'dev.nix');
  if (!fs.existsSync(idxDir)) fs.mkdirSync(idxDir, { recursive: true });
  if (!fs.existsSync(idxFile)) {
    fs.writeFileSync(idxFile, buildIdxDevNix(), 'utf8');
    results.push({ file: '.idx/dev.nix', status: 'created', note: 'Firebase Studio environment config' });
  } else {
    results.push({ file: '.idx/dev.nix', status: 'exists', note: 'Firebase Studio (לא שונה)' });
  }

  return results;
}

/**
 * Build Gemini Code Assist system instruction
 */
function buildGeminiInstruction(memory) {
  const memSection = memory ? `\n## Project Context\n${memory}\n` : '';
  return `# CCSO System Instruction for Gemini Code Assist
# Paste this into: VS Code → Settings → Gemini Code Assist → Code Customization → System Instructions

You are an expert coding assistant. Follow these rules strictly to minimize token usage and maximize precision:

## Response Style
- Answer in the same language the question was asked (Hebrew → Hebrew, English → English)
- Be concise — no preamble ("Sure!", "Of course!", "Happy to help!")
- No trailing summaries ("In summary...", "I've updated the file...")
- One sentence beats one paragraph when both convey the same information

## Code Output
- Produce code only — omit comments unless explicitly requested
- Do not add JSDoc, docstrings, or type annotations to code you didn't change
- Do not add error handling for impossible cases
- Remove unnecessary blank lines inside functions
- Follow existing code patterns — do not introduce new styles
- Do not create new files unless absolutely necessary
- Do not add features beyond what was explicitly requested

## Security
- Never include real API keys, passwords, or tokens in responses
- Use placeholders: YOUR_API_KEY, sk-xxx, TOKEN_HERE
- Warn if credentials appear in submitted code

## Git Awareness
- When asked about bugs or changes without a git diff, ask: "Please paste the output of \`git diff\`"
- Keep commit messages under 50 characters for the subject line
${memSection}`;
}

/**
 * Build Firebase Studio .idx/dev.nix config
 */
function buildIdxDevNix() {
  return `# Firebase Studio (Project IDX) environment config
# Generated by CCSO — https://github.com/igal2004/ccso
{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [ pkgs.nodejs_20 ];
  idx = {
    extensions = [
      "google.geminicodeassist"
    ];
    previews = {
      enable = true;
      previews = {
        web = {
          command = [ "npm" "run" "dev" ];
          manager = "web";
        };
      };
    };
  };
}
`;
}

/**
 * Remove CCSO sections from all injected files
 */
export function ejectAll(projectDir = process.cwd()) {
  const files = [
    path.join(projectDir, 'CLAUDE.md'),
    path.join(projectDir, '.cursorrules'),
    path.join(projectDir, '.windsurfrules'),
    path.join(projectDir, '.github', 'copilot-instructions.md'),
  ];

  const results = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f, 'utf8');
    const markers = ['<!-- CCSO-RULES -->', '# CCSO-RULES'];
    let changed = false;
    let updated = content;
    for (const m of markers) {
      if (updated.includes(m)) {
        updated = updated.substring(0, updated.indexOf(m)).trimEnd();
        changed = true;
      }
    }
    if (changed) {
      if (updated.trim()) {
        fs.writeFileSync(f, updated + '\n', 'utf8');
      } else {
        fs.unlinkSync(f);
      }
      results.push(path.basename(f));
    }
  }
  return results;
}
