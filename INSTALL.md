# מדריך התקנה — CCSO

## דרישות מוקדמות

- Node.js 18 ומעלה
- Claude Code אם רוצים backend מלא ומדידה אמיתית

בדיקה:

```bash
node --version
claude --version
```

## התקנה

```bash
git clone https://github.com/igal2004/claude-smart-optimizer.git
cd claude-smart-optimizer
npm install
node bin/install.js
```

אחרי ההתקנה:

1. פתח טרמינל חדש
2. או הרץ `source ~/.zshrc` או `source ~/.bashrc` לפי ה-shell שלך

## התחלה

```bash
ccso
```

## דשבורד

```bash
ccso --dashboard
```

לשיתוף עם לינק ציבורי:

```bash
ccso --share-dashboard
```

הפקודה הזו יוצרת tunnel אל הדשבורד המקומי שלך, ולכן היא מתאימה יותר מ-deploy סטטי אם אתה רוצה לראות את כל הפונקציות האמיתיות.

או בלחיצה כפולה מתוך התיקייה:

```bash
./הפעל\ CCSO.command
```

ברירת המחדל:

```text
http://localhost:3847
```

## בדיקת תקינות

```bash
ccso --status
npm test
```

## אם `ccso` לא מזוהה

- פתח טרמינל חדש
- או הרץ את קובץ ה-shell שלך מחדש:

```bash
source ~/.zshrc
```

או:

```bash
source ~/.bashrc
```

## שינוי הגדרות

```bash
ccso --config
```

## הסרה

```bash
ccso --uninstall
```

## תקלות נפוצות

### `Backend "claude" not found`

Claude Code לא מותקן או לא נמצא ב-`PATH`.

### הדשבורד לא נפתח

נסה:

```bash
ccso --dashboard
```

אם פורט `3847` כבר תפוס, CCSO ינסה להתחבר לדשבורד שכבר רץ.

### אין חיסכון בדשבורד למרות שעבדת שעות

זה קורה בדרך כלל כשעבדת בעיקר בתוך IDE חיצוני כמו Cursor. CCSO יכול לעזור שם דרך rules/config, אבל הוא לא מודד את הצ'אט הפנימי של הכלי.
