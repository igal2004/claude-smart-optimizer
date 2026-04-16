# Claude Code Smart Optimizer (CCSO) v3.0.0

> **A smart middleware layer between you and your AI tools — silently saves tokens, routes to cheaper models, and works across every platform.**

CCSO sits between you and Claude Code / Cursor / VS Code / Firebase Studio / Gemini and more.  
Instead of typing `claude`, type `ccso` — and all the savings happen automatically in the background.

**[עברית למטה ↓](#hebrew)**

---

## What it does

| Feature | Description | Estimated Saving |
|---|---|---|
| **Smart model routing** | Simple questions → Haiku (10× cheaper), complex → Opus | up to 90% on simple queries |
| **Response cache** | Same prompt → cached response, no API call | 100% on repeated prompts |
| **Code compression** | Strips comments, console.log, blank lines from code blocks | 15–35% per code block |
| **Log trimming** | Long logs → last 50 lines only | up to 90% on logs |
| **Large file truncation** | Files >300 lines → smart head+tail | up to 60% |
| **Deduplication** | Repeated lines removed from prompt | up to 20% |
| **Politeness stripping** | Removes "please", "thank you", "could you" | ~5% per prompt |
| **Response length hints** | Short questions get a brevity instruction | saves output tokens |
| **Auto Git context** | Injects `git status` + diff when debugging | fewer back-and-forth |
| **Secret scanner** | Warns before you leak API keys | security |
| **Path resolver** | "fix auth.ts" → `/src/pages/auth.ts` | saves search |
| **Auto Handoff** | When session cost hits threshold — summarizes, resets | 30–50% per session |
| **inject command** | Applies savings rules to Cursor, VS Code, Gemini, Firebase | savings on every tool |
| **Browser dashboard** | Live stats, charts, platform detection, chat | full visibility |

## Quick start

```bash
git clone https://github.com/igal2004/claude-smart-optimizer.git
cd claude-smart-optimizer
node bin/install.js
```

Then open a new terminal and run:

```bash
ccso
```

## Platform support

Works with: **Claude Code · Cursor · Windsurf · VS Code + Copilot · Gemini Code Assist · Firebase Studio · Android Studio · Codex CLI**

Use `ccso inject` inside any project to apply savings rules to all platforms at once.

## Dashboard

```bash
node src/dashboard/server.js
# open http://localhost:3847
```

## Run tests

```bash
node tests/test.js
```

---

<a name="hebrew"></a>

> **מכונת מלחמה לחיסכון בעלויות AI — עובד עם Claude Code, Cursor, VS Code, Firebase Studio, Gemini, Android Studio ועוד.**

CCSO הוא שכבת ביניים חכמה שיושבת בין אתה לבין כלי ה-AI שלך. הוא עושה את כל הדברים שאתה אמור לעשות ידנית — אוטומטית, בשקט, ברקע.

במקום להקליד `claude`, תקליד `cc` — וכל שאר הקסם קורה ברקע.

---

## ✨ מה CCSO עושה עבורך?

| פיצ'ר | תיאור | חיסכון משוער |
|---|---|---|
| **תרגום שקוף** | מקליד בעברית, קלוד מקבל אנגלית | עד 70% בטוקנים |
| **הסרת נימוסים** | "בבקשה", "תודה", "האם תוכל" — מוסרים אוטומטית | ~5% לפרומפט |
| **קיצוץ לוגים** | לוג ארוך? נשלחות רק 50 השורות האחרונות | עד 90% בלוגים |
| **קיצוץ תוכן גדול** | קבצים מעל 300 שורות מקוצצים חכם (ראש + זנב) | עד 60% בקבצים גדולים |
| **הסרת כפילויות** | שורות זהות מוסרות מהפרומפט | עד 20% |
| **דחיסת קוד** | הסרת הערות, console.log, רווחים מיותרים | 15–35% בבלוקי קוד |
| **רמז אורך תגובה** | שאלות פשוטות מקבלות הנחיית קיצור | חיסכון טוקני פלט |
| **ניתוב מודל חכם** | Haiku לשאלות פשוטות (10× זול), Opus למורכב | עד 90% לשאלות פשוטות |
| **מטמון תגובות** | אותו פרומפט = תגובה מהמטמון (ללא API) | 100% לפרומפטים חוזרים |
| **נתיבים מוחלטים** | "תקן auth.ts" → `/src/pages/auth.ts` | חוסך חיפוש |
| **ניטור עלויות** | שורת מצב חיה: עלות, פקודות, זמן, חיסכון | מודעות מלאה |
| **Handoff אוטומטי** | כשהסשן מתייקר — מסכם, מנקה, ומתחיל מחדש | 30–50% לסשן |
| **הזרקת הקשר Git** | מוסיף `git status` + `diff` אוטומטית לבאגים | פחות הלוך-חזור |
| **סורק סודות** | מזהיר לפני שאתה חושף API keys | אבטחה |
| **אזהרת שעות עומס** | מזהיר כשהשרתים עמוסים | מניעת Rate Limits |
| **inject לכל פלטפורמה** | מחיל חוקי חיסכון על Cursor, VS Code, Gemini, Firebase ועוד | חיסכון בכל כלי |
| **דשבורד בדפדפן** | סטטיסטיקות, גרפים, פלטפורמות, צ'אט | נראות מלאה |

---

## 🚀 התקנה (פקודה אחת)

**דרישות מוקדמות:** Node.js 18+ מותקן על המחשב.

```bash
# שלב 1: הורד את הפרויקט
git clone https://github.com/YOUR_USERNAME/ccso.git
cd ccso

# שלב 2: הרץ את המתקין החכם
node bin/install.js
```

המתקין יסרוק את המחשב שלך, יזהה אילו כלים מותקנים, ויתקין רק את מה שצריך.

לאחר ההתקנה, פתח טרמינל חדש ותקליד:

```bash
cc
```

**זהו. אתה מוכן.**

---

## 📖 שימוש

```bash
cc                    # פתיחת Smart REPL (במקום "claude")
cc --init             # אשף הגדרת פרויקט (CLAUDE.md + .claudeignore)
cc --dashboard        # דשבורד ויזואלי בדפדפן
cc --config           # שינוי הגדרות בתפריט אינטראקטיבי
cc --status           # הצגת הגדרות נוכחיות
cc --uninstall        # הסרה מלאה ונקייה
cc inject [path]      # הזרקת חוקי CCSO לכל הפלטפורמות בפרויקט
cc eject [path]       # הסרת חוקי CCSO מכל הפלטפורמות
cc help               # רשימת כל הפקודות
```

### פקודות בתוך ה-REPL

```
/handoff        — שמירת סיכום הסשן וניקוי ידני
/status         — הצגת עלות וסטטוס הסשן הנוכחי
/cache          — הצגת מספר רשומות במטמון
/cache clear    — ניקוי מטמון התגובות
/dashboard      — פתיחת הדשבורד בדפדפן
/history        — הצגת היסטוריית פרומפטים
/memory list    — הצגת זיכרון הפרויקט
/exit           — יציאה
```

### inject — חיסכון בכל הפלטפורמות

```bash
cd my-project
cc inject
```

יוצר את הקבצים הבאים אוטומטית:
- `CLAUDE.md` — Claude Code
- `.cursorrules` — Cursor
- `.windsurfrules` — Windsurf
- `.github/copilot-instructions.md` — GitHub Copilot / VS Code
- `.ccso_instruction` — Gemini Code Assist
- `.idx/dev.nix` — Firebase Studio / Project IDX

כל הקבצים מכילים חוקים לחיסכון טוקנים: קיצור תגובות, הימנעות מחזרות, עבודה בלוקים קטנים.

---

## ⚙️ הגדרות

ניתן לשנות הכל דרך `cc --config` או ישירות בקובץ `~/.config/claude-smart-optimizer/config.json`:

| הגדרה | ברירת מחדל | תיאור |
|---|---|---|
| `backend` | `claude` | `claude` או `codex` |
| `translate` | `true` | תרגום עברית לאנגלית |
| `stripPoliteness` | `true` | הסרת נימוסים |
| `resolvePaths` | `true` | המרת נתיבים מוחלטים |
| `trimLogs` | `true` | קיצוץ לוגים ל-50 שורות |
| `codeCompression` | `true` | דחיסת בלוקי קוד |
| `secretScanner` | `true` | סריקת API keys |
| `gitContext` | `true` | הזרקת הקשר Git |
| `smartRouting` | `true` | ניתוב מודל חכם |
| `promptCache` | `true` | מטמון תגובות (24h) |
| `cacheTTLHours` | `24` | זמן תפוגת מטמון (שעות) |
| `timeGuard` | `true` | אזהרת שעות עומס |
| `costThreshold` | `0.80` | סף עלות (USD) ל-Handoff אוטומטי |
| `commandThreshold` | `25` | מספר פקודות ל-Handoff אוטומטי |

---

## 🔧 תמיכה בפלטפורמות

| כלי | תמיכה | אופן עבודה |
|---|---|---|
| **Claude Code** | מלאה | REPL שקוף + CLAUDE.md |
| **Cursor** | מלאה | `cc inject` → .cursorrules |
| **Windsurf** | מלאה | `cc inject` → .windsurfrules |
| **VS Code + Copilot** | מלאה | `cc inject` → copilot-instructions.md |
| **Gemini Code Assist** | מלאה | `cc inject` → .ccso_instruction |
| **Firebase Studio / IDX** | מלאה | `cc inject` → .idx/dev.nix |
| **Android Studio** | חלקית | זיהוי אוטומטי + Gemini plugin |
| **Codex CLI** | מלאה | REPL שקוף |

---

## 🗺️ Roadmap

ראה [ROADMAP.md](ROADMAP.md) לרשימת הפיצ'רים המתוכננים. **מפתחים מוזמנים לאמץ פיצ'ר ולממש אותו!**

---

## 🤝 תרומה לפרויקט

CCSO הוא פרויקט קוד פתוח שמתוחזק על ידי הקהילה. ראה [CONTRIBUTING.md](CONTRIBUTING.md) לפרטים על איך להצטרף.

---

## 🗑️ הסרה

```bash
cc --uninstall
```

ההסרה נקייה לחלוטין. Claude Code ממשיך לעבוד כרגיל עם הפקודה `claude`.

---

## 📄 רישיון

MIT License — קוד פתוח לשימוש חופשי, לרבות שימוש מסחרי.
