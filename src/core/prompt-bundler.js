import { countTokens } from './token-utils.js';

const BULLET_REGEX = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;
const HEBREW_REGEX = /[\u0590-\u05FF]/;

function uniqItems(items = []) {
  const seen = new Set();
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export class PromptBundler {
  bundle(source = '') {
    const raw = String(source || '').trim();
    if (!raw) {
      return {
        bundled: false,
        itemCount: 0,
        prompt: '',
        reason: 'empty',
      };
    }

    const items = this._extractItems(raw);
    if (items.length < 2) {
      return {
        bundled: false,
        itemCount: items.length,
        prompt: raw,
        reason: 'need-multiple-items',
      };
    }

    const usesHebrew = HEBREW_REGEX.test(raw);
    const prompt = usesHebrew
      ? this._buildHebrewPrompt(items)
      : this._buildEnglishPrompt(items);

    return {
      bundled: true,
      itemCount: items.length,
      prompt,
      originalTokens: countTokens(raw),
      bundledTokens: countTokens(prompt),
    };
  }

  _extractItems(source = '') {
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const bulletItems = uniqItems(
      lines
        .map((line) => line.match(BULLET_REGEX)?.[1] || null)
        .filter(Boolean),
    );
    if (bulletItems.length >= 2) return bulletItems;

    const semicolonItems = uniqItems(
      source
        .split(/\s*;\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 4),
    );
    if (semicolonItems.length >= 2) return semicolonItems;

    if (lines.length >= 2) return uniqItems(lines);

    const questionItems = uniqItems(
      source
        .split(/(?<=\?)\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 6),
    );
    if (questionItems.length >= 2) return questionItems;

    const sentenceItems = uniqItems(
      source
        .split(/(?<=[.!])\s+(?=[A-Z\u0590-\u05FF])/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 8),
    );
    if (sentenceItems.length >= 2) return sentenceItems;

    return [source.trim()];
  }

  _buildHebrewPrompt(items) {
    return [
      'טפל בכל הסעיפים הבאים כבקשה אחת מאוגדת, כדי להשתמש באותו הקשר פעם אחת בלבד.',
      '',
      'סעיפים:',
      ...items.map((item, index) => `${index + 1}. ${item}`),
      '',
      'פורמט תשובה:',
      '- ענה לפי מספרי סעיפים.',
      '- השתמש באותו הקשר משותף במקום לחזור על רקע.',
      '- אם יש תלות או חסם בין סעיפים, ציין זאת קודם.',
    ].join('\n');
  }

  _buildEnglishPrompt(items) {
    return [
      'Handle the following as one bundled request so the shared context is loaded once.',
      '',
      'Tasks:',
      ...items.map((item, index) => `${index + 1}. ${item}`),
      '',
      'Response format:',
      '- Answer by task number.',
      '- Reuse the same shared context instead of repeating background.',
      '- Call out blockers or dependencies first.',
    ].join('\n');
  }
}

export function handleBundleCommand(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed.startsWith('/bundle')) return { handled: false };

  const rest = trimmed.replace('/bundle', '').trim();
  if (!rest) {
    return {
      handled: true,
      dispatch: false,
      message: '\n  שימוש: /bundle <כמה סעיפים או שאלות>\n  דוגמה: /bundle fix login bug; add tests; explain root cause\n',
      prompt: null,
    };
  }

  const bundler = new PromptBundler();
  const result = bundler.bundle(rest);

  if (!result.bundled) {
    return {
      handled: true,
      dispatch: false,
      message: '\n  צריך לפחות שני סעיפים ברורים כדי לאגד בקשה.\n  נסה להפריד עם `;` או שורות נפרדות.\n',
      prompt: rest,
    };
  }

  return {
    handled: true,
    dispatch: true,
    itemCount: result.itemCount,
    message: `\n  📦 אוגדו ${result.itemCount} סעיפים לבקשה אחת.\n`,
    prompt: result.prompt,
  };
}
