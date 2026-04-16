# מדריך התקנה מהיר — בדיקות מקומיות

מדריך זה מיועד להתקנה מקומית לצורך בדיקות, לפני שחרור הפרויקט לציבור.

---

## דרישות מוקדמות

לפני ההתקנה, ודא שמותקן על המחשב שלך:

**Node.js גרסה 18 ומעלה.** לבדיקה הרץ:
```bash
node --version
```
אם הגרסה נמוכה מ-18, הורד מ-[nodejs.org](https://nodejs.org).

---

## שלב 1: הורד את הפרויקט

```bash
git clone https://github.com/YOUR_USERNAME/ccso.git
cd ccso
```

אם אין לך Git, אפשר גם להוריד ZIP מ-GitHub ולחלץ אותו.

---

## שלב 2: התקן תלויות

```bash
npm install
```

---

## שלב 3: הרץ את המתקין החכם

```bash
node bin/install.js
```

המתקין יסרוק את המחשב שלך ויזהה אילו כלים מותקנים. עקוב אחרי ההוראות על המסך.

---

## שלב 4: פתח טרמינל חדש

לאחר ההתקנה, **חובה** לפתוח טרמינל חדש (או להריץ `source ~/.bashrc`) כדי שה-Alias יכנס לתוקף.

---

## שלב 5: התחל לעבוד

```bash
cc
```

---

## בדיקת תקינות

כדי לוודא שהכל עובד:

```bash
cc --status
```

אמור להציג את ההגדרות הנוכחיות.

---

## שינוי הגדרות

```bash
cc --config
```

---

## הסרה

```bash
cc --uninstall
```

---

## פתרון בעיות נפוצות

**"cc: command not found" לאחר ההתקנה**
פתח טרמינל חדש, או הרץ: `source ~/.bashrc` (Linux/Mac) / `source ~/.zshrc` (Zsh).

**"Backend 'claude' not found"**
Claude Code לא מותקן. התקן מ-[claude.ai/code](https://claude.ai/code), ואז הרץ מחדש `cc --config` ובחר את ה-Backend הנכון.

**שגיאת Node.js "ERR_MODULE_NOT_FOUND"**
הרץ `npm install` בתיקיית הפרויקט.
