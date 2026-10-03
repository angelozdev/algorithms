/** Longest value text before it is cut with "…". The terminal keeps the default; the web app passes more. */
export const MAX_VALUE = 100;

export function truncate(text: string, max = MAX_VALUE): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Positional arguments as the user would write them: `[2,7,11,15], 9`. */
export function formatInput(input: unknown, max = MAX_VALUE): string {
  const text = Array.isArray(input) ? input.map((arg) => JSON.stringify(arg)).join(", ") : JSON.stringify(input);
  return truncate(text ?? "undefined", max);
}

/** Named arguments, `nums=[3,2,4], target=6`, when the input has one value per name; otherwise formatInput. */
export function formatNamedInput(names: readonly string[], input: unknown, max = MAX_VALUE): string {
  if (names.length === 0 || !Array.isArray(input) || input.length !== names.length) return formatInput(input, max);
  return truncate(input.map((arg, i) => `${names[i]}=${JSON.stringify(arg)}`).join(", "), max);
}

export function formatOutput(output: unknown, max = MAX_VALUE): string {
  if (output && typeof output === "object" && !Array.isArray(output) && "param" in output) {
    const { ret, param } = output as { ret: unknown; param: unknown };
    return truncate(`returned ${JSON.stringify(ret)}, array is now ${JSON.stringify(param)}`, max);
  }
  return truncate(JSON.stringify(output) ?? "undefined", max);
}
