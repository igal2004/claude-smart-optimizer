export function countTokens(str = '') {
  let count = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x0590 && cp <= 0x05FF) count += 2;
    else if (cp >= 0x0600 && cp <= 0x06FF) count += 2;
    else if (cp >= 0x4E00 && cp <= 0x9FFF) count += 2;
    else if (cp > 127) count += 1.5;
    else count += 0.25;
  }
  return Math.ceil(count);
}

export function sumSavedTokens(savings = [], kind = 'input') {
  return savings.reduce((sum, item) => {
    const itemKind = item?.kind || 'input';
    return itemKind === kind ? sum + (item.saved || 0) : sum;
  }, 0);
}
