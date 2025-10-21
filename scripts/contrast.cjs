const { ColorContrastAnalyzer } = require('@adobe/color-contrast-analyzer');
const fs = require('fs');

const theme = {
  'civic-blue': '#2155FF',
  'sunlight-gold': '#F7B339',
  'midnight-navy': '#1A2138',
  'slate-100': '#F5F7FA'
};

const pairs = [
  ['midnight-navy', 'slate-100'],
  ['slate-100', 'midnight-navy'],
  ['civic-blue', 'slate-100'],
  ['slate-100', 'civic-blue'],
  ['sunlight-gold', 'midnight-navy'],
  ['midnight-navy', 'sunlight-gold'],
  ['sunlight-gold', 'civic-blue'],
  ['civic-blue', 'sunlight-gold']
];

const results = pairs.map(([text, background]) => {
  const ratio = ColorContrastAnalyzer.getContrastRatio(theme[text], theme[background]);
  const aa = ColorContrastAnalyzer.isLevelAA(theme[text], theme[background]);
  const aaa = ColorContrastAnalyzer.isLevelAAA(theme[text], theme[background]);
  return { text, background, ratio: ratio.toFixed(2), AA: aa, AAA: aaa };
});

console.table(results);
fs.writeFileSync('contrast-results.json', JSON.stringify(results, null, 2));

