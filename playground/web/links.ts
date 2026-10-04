import { exerciseIdFromFolder, problemIdFromFolder } from "../../lib/ids.ts";

/** Where an app link goes, typed against the router's routes. */
export type AppLink =
  | { to: "/" }
  | { to: "/p/$id"; params: { id: string } }
  | { to: "/e/$concept/$nn"; params: { concept: string; nn: string } }
  | { to: "/c/$slug"; params: { slug: string } };

/** Splits an exercise id ("hash-map/01") into its concept slug and number, or null for a problem id (no "/"). */
export function splitExerciseId(id: string): { concept: string; nn: string } | null {
  const slash = id.indexOf("/");
  if (slash < 0) return null;
  return { concept: id.slice(0, slash), nn: id.slice(slash + 1) };
}

/** Link to a problem (lc-0001) or an exercise (hash-map/01). */
export function targetLink(id: string): AppLink {
  const parts = splitExerciseId(id);
  if (!parts) return { to: "/p/$id", params: { id } };
  return { to: "/e/$concept/$nn", params: parts };
}

export type LinkTarget = { kind: "app"; link: AppLink } | { kind: "external"; href: string } | { kind: "none" };

/**
 * Where a link inside a README goes. Relative links resolve from the README's folder. READMEs of problems,
 * concepts and exercises become app routes, http(s) links stay external, and anything else (a solution
 * file, a folder, an anchor) is not a link.
 */
export function routeForLink(readmePath: string, href: string): LinkTarget {
  if (/^https?:\/\//i.test(href)) return { kind: "external", href };
  if (href === "" || href.startsWith("#") || href.startsWith("/") || /^[a-z][a-z\d+.-]*:/i.test(href)) return { kind: "none" };
  const url = new URL(href, `file:///repo/${readmePath}`);
  if (!url.pathname.startsWith("/repo/")) return { kind: "none" };
  const rel = decodeURIComponent(url.pathname.slice("/repo/".length));
  if (rel === "INDEX.md" || rel === "concepts/INDEX.md") return { kind: "app", link: { to: "/" } };
  const parts = rel.split("/");
  if (parts.at(-1) !== "README.md") return { kind: "none" };
  if (parts.length === 3 && parts[0] === "problems") return { kind: "app", link: targetLink(problemIdFromFolder(parts[1])) };
  if (parts.length === 3 && parts[0] === "concepts") return { kind: "app", link: { to: "/c/$slug", params: { slug: parts[1] } } };
  if (parts.length === 5 && parts[0] === "concepts" && parts[2] === "exercises") {
    return { kind: "app", link: targetLink(exerciseIdFromFolder(parts[1], parts[3])) };
  }
  return { kind: "none" };
}
