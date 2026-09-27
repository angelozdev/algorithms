/** Replaces the content between `<!-- auto:<name> -->` and the next `<!-- /auto -->`. null if the markers are missing or the section is unclosed (another auto opener comes first). */
export function replaceAuto(body: string, name: string, content: string): string | null {
  const open = `<!-- auto:${name} -->`;
  const start = body.indexOf(open);
  if (start < 0) return null;
  const end = body.indexOf("<!-- /auto -->", start + open.length);
  if (end < 0) return null;
  const nextOpen = body.indexOf("<!-- auto:", start + open.length);
  if (nextOpen >= 0 && nextOpen < end) return null;
  return `${body.slice(0, start)}${open}\n${content}\n${body.slice(end)}`;
}
