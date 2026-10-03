// Id rules with no Node imports: the repo scanner and the browser share them.

/** "lc-0001-two-sum" → "lc-0001"; folders without a number keep their full name. */
export function problemIdFromFolder(folder: string): string {
  return /^([a-z]+-\d{4})-/.exec(folder)?.[1] ?? folder;
}

/** ("greedy", "01-coins") → "greedy/01" */
export function exerciseIdFromFolder(concept: string, folder: string): string {
  return `${concept}/${/^(\d{2})-/.exec(folder)?.[1] ?? folder}`;
}
