/** Replaces the content between `<!-- auto:<name> -->` and the next `<!-- /auto -->`. null if the markers are missing. */
export function replaceAuto(body: string, name: string, content: string): string | null {
  const open = `<!-- auto:${name} -->`;
  const start = body.indexOf(open);
  if (start < 0) return null;
  const end = body.indexOf("<!-- /auto -->", start + open.length);
  if (end < 0) return null;
  return `${body.slice(0, start)}${open}\n${content}\n${body.slice(end)}`;
}
