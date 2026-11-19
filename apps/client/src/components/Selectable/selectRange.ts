// Shift-click: adds every row from the last selected one to the clicked one
export function selectRange(selected: number[], index: number) {
  const last = selected.at(-1);
  if (last === undefined) {
    return [index];
  }
  const step = index < last ? -1 : 1;
  const added: number[] = [];
  for (let i = last; i !== index + step; i += step) {
    added.push(i);
  }
  return [...new Set([...selected, ...added])];
}
