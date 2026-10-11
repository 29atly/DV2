// Lay out each analysis paragraph independently, with at most ten words per line.
const proseCanvas = document.createElement('canvas');
const proseContext = proseCanvas.getContext('2d');
const paragraphLayouts = [...document.querySelectorAll('.story-columns > p')].map(paragraph => {
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  let text = '';
  const emphasis = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    emphasis.push({ start: text.length, end: text.length + node.textContent.length, bold: !!node.parentElement.closest('strong') });
    text += node.textContent;
  }
  const words = [...text.matchAll(/\S+/g)].map(match => ({
    text: match[0],
    bold: emphasis.some(part => part.bold && part.start < match.index + match[0].length && part.end > match.index)
  }));
  return { paragraph, words, width: null };
});

function layoutParagraph(layout, force = false) {
  const { paragraph, words } = layout;
  const style = getComputedStyle(paragraph);
  const width = paragraph.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth) - 2;
  if (width <= 0 || (!force && width === layout.width)) return;
  layout.width = width;
  proseContext.font = `400 ${style.fontSize} ${style.fontFamily}`;
  const space = proseContext.measureText(' ').width;
  const lengths = words.map(word => {
    proseContext.font = `${word.bold ? '700' : '400'} ${style.fontSize} ${style.fontFamily}`;
    return proseContext.measureText(word.text).width;
  });
  const costs = Array(words.length + 1).fill(Infinity);
  const breaks = [];
  costs[words.length] = 0;
  for (let start = words.length - 1; start >= 0; start--) {
    let used = 0;
    for (let end = start; end < Math.min(words.length, start + 10); end++) {
      used += lengths[end] + (end > start ? space : 0);
      if (used > width && end > start) break;
      const count = end - start + 1;
      // Balance line lengths and strongly discourage isolated words.
      const cost = costs[end + 1] + width ** 2 + (width - used) ** 2 + (count === 1 ? width ** 2 * 20 : 0);
      if (cost < costs[start]) { costs[start] = cost; breaks[start] = end + 1; }
    }
  }
  const fragment = document.createDocumentFragment();
  for (let start = 0; start < words.length;) {
    const end = breaks[start] || start + 1;
    const line = document.createElement('span');
    line.className = 'analysis-line';
    words.slice(start, end).forEach((word, index) => {
      if (index) line.append(' ');
      if (word.bold) {
        const strong = document.createElement('strong');
        strong.textContent = word.text;
        line.append(strong);
      } else line.append(word.text);
    });
    fragment.append(line, document.createTextNode('\n'));
    start = end;
  }
  const textBlock = document.createElement('span');
  textBlock.className = 'analysis-text';
  textBlock.append(fragment);
  paragraph.replaceChildren(textBlock);
}

paragraphLayouts.forEach(layout => layoutParagraph(layout));
const proseObserver = new ResizeObserver(() => paragraphLayouts.forEach(layout => layoutParagraph(layout)));
paragraphLayouts.forEach(({ paragraph }) => proseObserver.observe(paragraph));
document.fonts.ready.then(() => paragraphLayouts.forEach(layout => layoutParagraph(layout, true)));
