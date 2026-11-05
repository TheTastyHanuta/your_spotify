// Fits a name into at most maxLines lines of the given width, for the share
// image. Tries each size from the largest: the first one where the name wraps
// into the lines without cutting wins. When even the smallest size does not
// fit, the last line ends with "…".
export interface FitResult {
  size: number;
  lines: string[];
}

// measure(text, size) is the width of the text at that font size
export type Measure = (text: string, size: number) => number;

function cut(text: string, width: number, size: number, measure: Measure) {
  if (measure(text, size) <= width) {
    return text;
  }
  let shorter = text;
  while (shorter.length > 1 && measure(`${shorter}…`, size) > width) {
    shorter = shorter.slice(0, -1);
  }
  return `${shorter.trimEnd()}…`;
}

// Greedy word wrap; a word wider than the line gets a line of its own
function wrap(text: string, width: number, size: number, measure: Measure) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

export function fitLines(
  text: string,
  width: number,
  maxLines: number,
  sizes: number[],
  measure: Measure,
): FitResult {
  for (const size of sizes) {
    const lines = wrap(text, width, size, measure);
    if (
      lines.length <= maxLines &&
      lines.every((line) => measure(line, size) <= width)
    ) {
      return { size, lines };
    }
  }
  const size = sizes[sizes.length - 1]!;
  const lines = wrap(text, width, size, measure);
  const kept = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    kept[maxLines - 1] = lines.slice(maxLines - 1).join(" ");
  }
  return { size, lines: kept.map((line) => cut(line, width, size, measure)) };
}
